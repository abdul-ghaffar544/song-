const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const audio    = $('#audio');
const list     = $('#list');
const nowTitle = $('#now-title');
const record   = $('#record');

let playlist   = [];
let current    = -1;
let currentTab = 'all';
let myUploadsSet = new Set();
let me = null;

function fmtBytes(bytes){
  const units=['B','KB','MB','GB']; let i=0;
  while(bytes>=1024 && i<units.length-1){ bytes/=1024; i++; }
  return `${bytes.toFixed(bytes>=10?0:1)} ${units[i]}`;
}

async function getMe(){
  const res = await fetch('/api/auth/me');
  const json = await res.json();
  me = json.user;
  const authbox = $('#authbox');
  const logout = $('#logout');
  if(me){
    authbox.innerHTML = `<span class="email">${me.email}</span>`;
    if(logout){ logout.style.display='inline-block';
      logout.onclick = async () => {
        await fetch('/api/auth/logout', { method:'POST' });
        location.reload();
      };
    }
  } else {
    authbox.innerHTML = `<a class="btn-outline sm" href="/login">Login</a>`;
    if(logout) logout.style.display='none';
  }
}

function updateMyUploadsSet(files){
  // Server returns ownerId per file; "My Uploads" = ownerId === me.id
  myUploadsSet = new Set(
    files.filter(f => me && f.ownerId === me.id).map(f => f.filename)
  );
}

async function fetchSongs(){
  const res = await fetch('/api/songs');
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Failed to load songs');
  playlist = json.files;
  updateMyUploadsSet(playlist);
  renderList();
}

function visibleList(){
  const q = ($('#search')?.value || '').toLowerCase();
  let files = playlist;
  if(currentTab === 'my' && me){
    files = playlist.filter(f => myUploadsSet.has(f.filename));
  }
  if(q) files = files.filter(f => f.filename.toLowerCase().includes(q));
  return files;
}

function renderList(){
  const files = visibleList();
  list.innerHTML = '';
  if(files.length === 0){
    list.innerHTML = '<li class="muted">No songs found.</li>';
    return;
  }
  files.forEach((track) => {
    const isCurrent = (playlist.findIndex(p => p.filename === track.filename) === current);
    const canDelete = me && track.ownerId === me.id;
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="meta">
        <button class="icon-btn" data-play="${track.filename}">${isCurrent?'▶︎':'►'}</button>
        <span class="title">${track.filename}</span>
        <span class="size">${fmtBytes(track.size)}</span>
      </div>
      <div class="actions">
        <a class="icon-btn" href="${track.url}" download title="Download">⬇</a>
        ${canDelete ? `<button class="icon-btn danger" data-del="${track.filename}" title="Delete">🗑</button>` : ''}
      </div>
    `;
    list.appendChild(li);
  });
}

function playByFilename(name){
  const idx = playlist.findIndex(t => t.filename === name);
  if(idx === -1) return;
  current = idx;
  const track = playlist[current];
  audio.src = track.url;
  nowTitle.textContent = track.filename;
  audio.play();
  renderList();
}

function playNext(){
  if(!playlist.length) return;
  const next = (current + 1) % playlist.length;
  playByFilename(playlist[next].filename);
}

function playPrev(){
  if(!playlist.length) return;
  const prev = (current - 1 + playlist.length) % playlist.length;
  playByFilename(playlist[prev].filename);
}

async function deleteSong(filename){
  if(!confirm(`Delete "${filename}"?`)) return;
  const res = await fetch(`/api/songs/${encodeURIComponent(filename)}`, { method:'DELETE' });
  const json = await res.json();
  if(!json.ok){ alert('Failed: ' + (json.error || 'Unknown error')); return; }
  await fetchSongs();
  if(playlist.length === 0){
    audio.pause(); audio.src=''; nowTitle.textContent='No song selected';
  }
}

function bindControls(){
  $('#prev').addEventListener('click', playPrev);
  $('#next').addEventListener('click', playNext);
  $('#playpause').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('#volume').addEventListener('input', (e) => { audio.volume = parseFloat(e.target.value); });
  $('#loop').addEventListener('change', (e) => { audio.loop = e.target.checked; });

  audio.addEventListener('play',  () => record.classList.add('spin'));
  audio.addEventListener('pause', () => record.classList.remove('spin'));
  audio.addEventListener('ended', () => {
    record.classList.remove('spin');
    if(!audio.loop) playNext();
  });

  list.addEventListener('click', (e) => {
    const playName = e.target.getAttribute('data-play');
    const delName  = e.target.getAttribute('data-del');
    if(playName) playByFilename(playName);
    else if(delName) deleteSong(delName);
  });

  // Tabs
  $$('.tab').forEach(btn => btn.addEventListener('click', () => {
    $$('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderList();
  }));

  // Search
  $('#search').addEventListener('input', renderList);
}

function bindUploader(){
  const dz = $('#dropzone');
  const input = $('#file-input');
  const status = $('#upload-status');

  const highlight = () => dz.classList.add('drag');
  const unhighlight = () => dz.classList.remove('drag');

  ['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation(); highlight();
  }));
  ['dragleave','drop'].forEach(evt => dz.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation(); unhighlight();
  }));

  dz.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if(files && files.length) uploadFiles(files, status);
  });
  input.addEventListener('change', (e) => {
    if(e.target.files && e.target.files.length) uploadFiles(e.target.files, status);
  });
}

async function uploadFiles(fileList, statusEl){
  const files = Array.from(fileList);
  if(!files.length) return;

  const audios = files.filter(f => (f.type || '').startsWith('audio/'));
  if(!audios.length){ alert('Please select audio files only.'); return; }

  if(!me){
    statusEl.textContent = 'Please login first to upload.';
    return;
  }

  statusEl.textContent = `Uploading ${audios.length} file(s)...`;

  let uploadedCount = 0;
  for(const f of audios){
    await new Promise((resolve,reject) => {
      const form = new FormData();
      form.append('songs', f);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.upload.addEventListener('progress', (e) => {
        if(e.lengthComputable){
          const pct = Math.round((e.loaded / e.total) * 100);
          statusEl.textContent = `Uploading "${f.name}"… ${pct}%`;
        }
      });
      xhr.onload = () => {
        if(xhr.status >= 200 && xhr.status < 300){ uploadedCount++; resolve(); }
        else {
          try {
            const err = JSON.parse(xhr.responseText);
            alert(err.error || 'Upload failed');
          } catch { alert('Upload failed'); }
          reject(new Error('Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    }).catch(() => {});
  }

  statusEl.textContent = `Uploaded ${uploadedCount}/${audios.length}. Refreshing…`;
  await fetchSongs();
  statusEl.textContent = 'Done.';
}

document.addEventListener('DOMContentLoaded', async () => {
  await getMe();
  bindControls();
  bindUploader();
  await fetchSongs();
});
