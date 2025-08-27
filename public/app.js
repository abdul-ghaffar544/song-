const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const audio = $('#audio');
const list = $('#list');
const nowTitle = $('#now-title');

let playlist = [];
let current = -1;

function fmtBytes(bytes) {
  const units = ['B','KB','MB','GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024; i++;
  }
  return `${bytes.toFixed( bytes >= 10 ? 0 : 1)} ${units[i]}`;
}

async function fetchSongs() {
  const res = await fetch('/api/songs');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Failed to load songs');
  playlist = json.files;
  renderList();
}

function renderList() {
  list.innerHTML = '';
  if (playlist.length === 0) {
    list.innerHTML = '<li class="muted">No songs uploaded yet.</li>';
    return;
  }
  playlist.forEach((track, i) => {
    const li = document.createElement('li');
    const isCurrent = (i === current);
    li.innerHTML = `
      <div class="meta">
        <button class="icon-btn" data-play="${i}">${isCurrent ? '▶︎' : '►'}</button>
        <span class="title">${track.filename}</span>
        <span class="size">${fmtBytes(track.size)}</span>
      </div>
      <div class="actions">
        <a class="icon-btn" href="${track.url}" download title="Download">⬇</a>
        <button class="icon-btn danger" data-del="${track.filename}" title="Delete">🗑</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function playIndex(i) {
  if (i < 0 || i >= playlist.length) return;
  current = i;
  const track = playlist[current];
  audio.src = track.url;
  nowTitle.textContent = track.filename;
  audio.play();
  renderList();
}

function playNext() {
  if ($('#shuffle').checked) {
    const candidates = playlist.map((_, idx) => idx).filter(idx => idx !== current);
    if (candidates.length) {
      const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
      playIndex(randomIndex);
      return;
    }
  }
  const next = (current + 1) % playlist.length;
  playIndex(next);
}

function playPrev() {
  const prev = (current - 1 + playlist.length) % playlist.length;
  playIndex(prev);
}

async function deleteSong(filename) {
  const yes = confirm(`Delete "${filename}" from server?`);
  if (!yes) return;
  const res = await fetch(`/api/songs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  const json = await res.json();
  if (!json.ok) {
    alert('Failed to delete: ' + (json.error || 'Unknown error'));
    return;
  }
  await fetchSongs();
  if (playlist.length === 0) {
    audio.pause();
    audio.src = '';
    nowTitle.textContent = 'No song selected';
  }
}

function bindControls() {
  $('#prev').addEventListener('click', playPrev);
  $('#next').addEventListener('click', playNext);
  $('#playpause').addEventListener('click', () => audio.paused ? audio.play() : audio.pause());
  $('#volume').addEventListener('input', (e) => { audio.volume = parseFloat(e.target.value); });
  $('#loop').addEventListener('change', (e) => { audio.loop = e.target.checked; });
  $('#refresh').addEventListener('click', fetchSongs);

  audio.addEventListener('ended', () => {
    if (!audio.loop) playNext();
  });

  list.addEventListener('click', (e) => {
    const playIdx = e.target.getAttribute('data-play');
    const delName = e.target.getAttribute('data-del');
    if (playIdx !== null) {
      playIndex(parseInt(playIdx, 10));
    } else if (delName) {
      deleteSong(delName);
    }
  });
}

function bindUploader() {
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
    if (files && files.length) uploadFiles(files, status);
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) uploadFiles(e.target.files, status);
  });
}

async function uploadFiles(fileList, statusEl) {
  const files = Array.from(fileList);
  if (!files.length) return;

  // Filter to audio only on client side too
  const audios = files.filter(f => (f.type || '').startsWith('audio/'));
  if (!audios.length) {
    alert('Please select audio files only.');
    return;
  }

  statusEl.textContent = `Uploading ${audios.length} file(s)...`;

  // Use XMLHttpRequest for progress (per file)
  let uploadedCount = 0;
  for (const f of audios) {
    await new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('songs', f);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          statusEl.textContent = `Uploading "${f.name}"... ${pct}%`;
        }
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          uploadedCount++;
          resolve();
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    }).catch(err => {
      console.error(err);
      alert(`Failed to upload ${f.name}: ${err.message}`);
    });
  }

  statusEl.textContent = `Uploaded ${uploadedCount}/${audios.length}. Refreshing list...`;
  await fetchSongs();
  statusEl.textContent = `Done.`;
}

document.addEventListener('DOMContentLoaded', async () => {
  bindControls();
  bindUploader();
  await fetchSongs();
});
