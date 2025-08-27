// DOM Helper Functions
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// DOM Elements
const audio = $('#audio');
const nowTitle = $('#now-title');
const trackInfo = $('#track-info');
const listMy = $('#list-my');
const listAll = $('#list-all');
const searchInput = $('#search-input');
const uploadStatus = $('#upload-status');
const uploadProgress = $('#upload-progress');
const toastContainer = $('#toast-container');

// Record Player Elements
const vinylRecord = $('#vinyl-record');
const vinylCover = $('#vinyl-cover');
const vinylPlaceholder = $('#vinyl-placeholder');
const tonearm = $('#tonearm');

// Tab Elements
const tabMy = $('#tab-my');
const tabAll = $('#tab-all');
const panelMy = $('#panel-my');
const panelAll = $('#panel-all');

// Lyrics Elements
const lyricsContent = $('#lyrics-content');
const lyricsModal = $('#lyrics-modal');
const lyricsTextarea = $('#lyrics-textarea');
const modalBackdrop = $('#modal-backdrop');

// Media Upload Elements
const coverInput = $('#cover-input');
const lyricsInput = $('#lyrics-input');
const lyricsTextBtn = $('#lyrics-text-btn');

// State Management
let allSongs = [];
let myUploads = [];
let publicUploads = [];
let currentTab = 'my';
let currentPlaylist = [];
let current = -1;
let searchTerm = '';
let currentLyrics = null;
let lyricsType = null;

// LocalStorage Management for Delete Tokens
function getDeleteTokens() {
  try {
    const stored = localStorage.getItem('deleteTokens');
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn('Failed to parse deleteTokens from localStorage:', e);
    return {};
  }
}

function saveDeleteTokens(tokens) {
  try {
    localStorage.setItem('deleteTokens', JSON.stringify(tokens));
  } catch (e) {
    console.warn('Failed to save deleteTokens to localStorage:', e);
  }
}

function addDeleteTokens(files) {
  const tokens = getDeleteTokens();
  files.forEach(file => {
    if (file.deleteToken) {
      tokens[file.filename] = file.deleteToken;
    }
  });
  saveDeleteTokens(tokens);
}

function hasDeleteToken(filename) {
  const tokens = getDeleteTokens();
  return tokens.hasOwnProperty(filename);
}

function getDeleteToken(filename) {
  const tokens = getDeleteTokens();
  return tokens[filename];
}

function removeDeleteToken(filename) {
  const tokens = getDeleteTokens();
  delete tokens[filename];
  saveDeleteTokens(tokens);
}

// Utility Functions
function fmtBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(bytes >= 10 ? 0 : 1)} ${units[i]}`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'toastIn 0.3s ease reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }
  }, 4000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Record Player Animation Functions
function startVinylAnimation() {
  vinylRecord.classList.remove('spinning-down');
  vinylRecord.classList.add('spinning-up');
  tonearm.classList.add('playing');
  
  setTimeout(() => {
    vinylRecord.classList.remove('spinning-up');
    vinylRecord.classList.add('spinning');
  }, 300);
}

function stopVinylAnimation() {
  vinylRecord.classList.remove('spinning');
  vinylRecord.classList.add('spinning-down');
  tonearm.classList.remove('playing');
  
  setTimeout(() => {
    vinylRecord.classList.remove('spinning-down');
  }, 300);
}

function updateVinylCover(coverUrl) {
  if (coverUrl) {
    vinylCover.src = coverUrl;
    vinylCover.style.display = 'block';
    vinylPlaceholder.style.display = 'none';
  } else {
    vinylCover.style.display = 'none';
    vinylPlaceholder.style.display = 'flex';
  }
}

// Lyrics Functions
function parseLRC(content) {
  const lines = content.split('\n');
  const lyrics = [];
  
  lines.forEach(line => {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const centiseconds = parseInt(match[3]);
      const time = minutes * 60 + seconds + centiseconds / 100;
      const text = match[4].trim();
      
      if (text) {
        lyrics.push({ time, text });
      }
    }
  });
  
  return lyrics.sort((a, b) => a.time - b.time);
}

function displayLyrics(content, type) {
  lyricsContent.innerHTML = '';
  
  if (!content) {
    lyricsContent.innerHTML = `
      <div class="lyrics-placeholder">
        <span class="lyrics-icon">🎤</span>
        <p>No lyrics available</p>
        <small>Upload lyrics for the current track</small>
      </div>
    `;
    return;
  }
  
  if (type === 'lrc') {
    currentLyrics = parseLRC(content);
    lyricsType = 'lrc';
    
    const lyricsDiv = document.createElement('div');
    lyricsDiv.className = 'lyrics-text';
    
    currentLyrics.forEach((lyric, index) => {
      const line = document.createElement('span');
      line.className = 'lyrics-line';
      line.textContent = lyric.text;
      line.dataset.time = lyric.time;
      line.dataset.index = index;
      lyricsDiv.appendChild(line);
    });
    
    lyricsContent.appendChild(lyricsDiv);
  } else {
    lyricsType = 'txt';
    const lyricsDiv = document.createElement('div');
    lyricsDiv.className = 'lyrics-text';
    lyricsDiv.textContent = content;
    lyricsContent.appendChild(lyricsDiv);
  }
}

function updateLyricsHighlight(currentTime) {
  if (lyricsType !== 'lrc' || !currentLyrics) return;
  
  const lines = $$('.lyrics-line');
  let activeIndex = -1;
  
  // Find the active line
  for (let i = 0; i < currentLyrics.length; i++) {
    if (currentTime >= currentLyrics[i].time) {
      activeIndex = i;
    } else {
      break;
    }
  }
  
  // Update highlights
  lines.forEach((line, index) => {
    if (index === activeIndex) {
      line.classList.add('active');
      // Scroll into view
      line.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      line.classList.remove('active');
    }
  });
}

async function loadLyrics(filename) {
  try {
    const baseName = filename.split('.')[0];
    const response = await fetch(`/api/lyrics/${baseName}.lrc`);
    
    if (response.ok) {
      const data = await response.json();
      displayLyrics(data.content, data.type);
      return;
    }
    
    // Try .txt if .lrc not found
    const txtResponse = await fetch(`/api/lyrics/${baseName}.txt`);
    if (txtResponse.ok) {
      const data = await txtResponse.json();
      displayLyrics(data.content, data.type);
      return;
    }
    
    // No lyrics found
    displayLyrics(null, null);
  } catch (error) {
    console.warn('Failed to load lyrics:', error);
    displayLyrics(null, null);
  }
}

// Modal Functions
function showLyricsModal() {
  lyricsModal.style.display = 'flex';
  modalBackdrop.style.display = 'block';
  lyricsTextarea.value = '';
  lyricsTextarea.focus();
}

function hideLyricsModal() {
  lyricsModal.style.display = 'none';
  modalBackdrop.style.display = 'none';
}

async function saveLyricsText() {
  const lyricsText = lyricsTextarea.value.trim();
  if (!lyricsText) {
    showToast('Please enter lyrics text', 'error');
    return;
  }
  
  if (current === -1 || !currentPlaylist[current]) {
    showToast('Please select a track first', 'error');
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('filename', currentPlaylist[current].filename);
    formData.append('lyrics', lyricsText);
    
    const response = await fetch('/api/lyrics', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (result.ok) {
      showToast('Lyrics saved successfully!', 'success');
      hideLyricsModal();
      await fetchSongs();
      displayLyrics(lyricsText, lyricsText.includes('[') ? 'lrc' : 'txt');
    } else {
      throw new Error(result.error || 'Failed to save lyrics');
    }
  } catch (error) {
    console.error('Failed to save lyrics:', error);
    showToast(`Failed to save lyrics: ${error.message}`, 'error');
  }
}

// Data Fetching and Processing
async function fetchSongs() {
  try {
    const res = await fetch('/api/songs');
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Failed to load songs');
    
    allSongs = json.files;
    processSongs();
    renderCurrentTab();
  } catch (error) {
    console.error('Failed to fetch songs:', error);
    showToast('Failed to load playlist', 'error');
  }
}

function processSongs() {
  const deleteTokens = getDeleteTokens();
  
  myUploads = allSongs.filter(song => 
    deleteTokens.hasOwnProperty(song.filename)
  );
  
  publicUploads = allSongs.filter(song => 
    !deleteTokens.hasOwnProperty(song.filename)
  );
}

function filterSongs(songs, term) {
  if (!term) return songs;
  const lowerTerm = term.toLowerCase();
  return songs.filter(song =>
    song.filename.toLowerCase().includes(lowerTerm)
  );
}

function getCurrentPlaylist() {
  const songs = currentTab === 'my' ? myUploads : publicUploads;
  return filterSongs(songs, searchTerm);
}

// Rendering Functions
function renderList(listElement, songs, isMyUploads = false) {
  listElement.innerHTML = '';
  
  if (songs.length === 0) {
    return; // CSS handles empty state
  }

  songs.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'playlist-item';
    
    const isCurrent = (currentPlaylist[current] && currentPlaylist[current].filename === track.filename);
    
    li.innerHTML = `
      <div class="track-info">
        <button class="play-btn ${isCurrent ? 'playing' : ''}" data-play="${i}" aria-label="Play ${track.filename}">
          ${isCurrent ? '⏸' : '▶'}
        </button>
        <div class="track-details">
          <div class="track-name">${track.filename}</div>
          <div class="track-size">${fmtBytes(track.size)}</div>
        </div>
      </div>
      <div class="track-actions">
        <a class="action-btn" href="${track.url}" download title="Download ${track.filename}" aria-label="Download ${track.filename}">⬇</a>
        ${isMyUploads ? 
          `<button class="action-btn danger" data-del="${track.filename}" title="Delete ${track.filename}" aria-label="Delete ${track.filename}">🗑</button>` :
          ''
        }
      </div>
    `;
    
    if (isCurrent) {
      li.classList.add('current');
    }
    
    li.style.animationDelay = `${i * 50}ms`;
    listElement.appendChild(li);
  });
}

function renderCurrentTab() {
  const filteredMy = filterSongs(myUploads, searchTerm);
  const filteredAll = filterSongs(publicUploads, searchTerm);
  
  renderList(listMy, filteredMy, true);
  renderList(listAll, filteredAll, false);
  
  currentPlaylist = getCurrentPlaylist();
}

// Tab Management
function switchTab(tab) {
  if (currentTab === tab) return;
  
  currentTab = tab;
  
  tabMy.classList.toggle('active', tab === 'my');
  tabAll.classList.toggle('active', tab === 'all');
  tabMy.setAttribute('aria-selected', tab === 'my');
  tabAll.setAttribute('aria-selected', tab === 'all');
  
  panelMy.classList.toggle('active', tab === 'my');
  panelAll.classList.toggle('active', tab === 'all');
  
  currentPlaylist = getCurrentPlaylist();
  
  if (current >= 0 && currentPlaylist[current] && 
      !currentPlaylist.some(track => track.filename === (allSongs[current] && allSongs[current].filename))) {
    current = -1;
  }
  
  renderCurrentTab();
}

// Audio Player Functions
function findTrackIndex(filename) {
  return currentPlaylist.findIndex(track => track.filename === filename);
}

function playIndex(i) {
  if (i < 0 || i >= currentPlaylist.length) return;
  
  current = i;
  const track = currentPlaylist[current];
  audio.src = track.url;
  nowTitle.textContent = track.filename;
  
  // Update track info
  trackInfo.textContent = `${fmtBytes(track.size)} • ${currentTab === 'my' ? 'My Upload' : 'Public'}`;
  
  // Update vinyl cover
  updateVinylCover(track.coverUrl);
  
  // Load lyrics
  loadLyrics(track.filename);
  
  // Update title scrolling
  if (track.filename.length > 30) {
    nowTitle.classList.add('scrolling');
  } else {
    nowTitle.classList.remove('scrolling');
  }
  
  $('#playpause').textContent = '⏸';
  
  audio.play().catch(e => {
    console.error('Failed to play audio:', e);
    showToast('Failed to play audio', 'error');
  });
  
  renderCurrentTab();
  showToast(`Now playing: ${track.filename}`, 'success');
}

function playNext() {
  if (currentPlaylist.length === 0) return;
  
  if ($('#shuffle').checked) {
    const candidates = currentPlaylist.map((_, idx) => idx).filter(idx => idx !== current);
    if (candidates.length) {
      const randomIndex = candidates[Math.floor(Math.random() * candidates.length)];
      playIndex(randomIndex);
      return;
    }
  }
  
  const next = (current + 1) % currentPlaylist.length;
  playIndex(next);
}

function playPrev() {
  if (currentPlaylist.length === 0) return;
  
  const prev = (current - 1 + currentPlaylist.length) % currentPlaylist.length;
  playIndex(prev);
}

function togglePlayPause() {
  if (audio.paused) {
    if (current === -1 && currentPlaylist.length > 0) {
      playIndex(0);
    } else {
      audio.play().catch(e => {
        console.error('Failed to play audio:', e);
        showToast('Failed to play audio', 'error');
      });
    }
  } else {
    audio.pause();
  }
}

// Delete Function with Secure Authorization
async function deleteSong(filename) {
  const confirmed = confirm(`Delete "${filename}" from server?`);
  if (!confirmed) return;
  
  const token = getDeleteToken(filename);
  if (!token) {
    showToast('You can only delete your own uploads', 'error');
    return;
  }

  try {
    const items = $$('.playlist-item');
    const itemToDelete = items.find(item => {
      const delBtn = item.querySelector('[data-del]');
      return delBtn && delBtn.getAttribute('data-del') === filename;
    });
    
    if (itemToDelete) {
      itemToDelete.classList.add('li-exit');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const res = await fetch(`/api/songs/${encodeURIComponent(filename)}`, { 
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const json = await res.json();
    
    if (!json.ok) {
      throw new Error(json.error || 'Unknown error');
    }
    
    removeDeleteToken(filename);
    await fetchSongs();
    showToast('Track deleted successfully', 'success');
    
    if (currentPlaylist[current] && currentPlaylist[current].filename === filename) {
      if (currentPlaylist.length <= 1) {
        audio.pause();
        audio.src = '';
        nowTitle.textContent = 'No song selected';
        trackInfo.textContent = '';
        $('#playpause').textContent = '▶';
        updateVinylCover(null);
        displayLyrics(null, null);
        stopVinylAnimation();
        current = -1;
      } else {
        playNext();
      }
    }
  } catch (error) {
    console.error('Failed to delete song:', error);
    showToast(`Failed to delete: ${error.message}`, 'error');
  }
}

// Upload Functions
function createProgressBar(filename) {
  const progressContainer = document.createElement('div');
  progressContainer.className = 'progress-container';
  progressContainer.innerHTML = `
    <div class="progress-label">${filename}</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
  `;
  return progressContainer;
}

async function uploadFiles(fileList, statusEl) {
  const files = Array.from(fileList);
  if (!files.length) return;

  const audios = files.filter(f => (f.type || '').startsWith('audio/'));
  if (!audios.length) {
    showToast('Please select audio files only', 'error');
    return;
  }

  statusEl.innerHTML = '<div class="spinner"></div>Preparing upload...';
  uploadProgress.innerHTML = '';

  const uploadedFiles = [];
  let uploadedCount = 0;

  try {
    for (const file of audios) {
      const progressBar = createProgressBar(file.name);
      uploadProgress.appendChild(progressBar);
      const progressFill = progressBar.querySelector('.progress-fill');

      await new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('songs', file);
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${percent}%`;
            statusEl.innerHTML = `<div class="spinner"></div>Uploading "${file.name}"... ${percent}%`;
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.ok && response.files) {
                uploadedFiles.push(...response.files);
                uploadedCount++;
                progressFill.style.width = '100%';
                resolve();
              } else {
                reject(new Error(response.error || 'Upload failed'));
              }
            } catch (e) {
              reject(new Error('Invalid server response'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText || 'Upload failed'}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timeout'));
        
        xhr.timeout = 60000;
        xhr.open('POST', '/api/upload');
        xhr.send(form);
      }).catch(err => {
        console.error(`Failed to upload ${file.name}:`, err);
        showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
        progressFill.style.background = 'var(--danger)';
      });
    }

    if (uploadedFiles.length > 0) {
      addDeleteTokens(uploadedFiles);
      
      statusEl.innerHTML = `✅ Uploaded ${uploadedCount}/${audios.length} files. Refreshing...`;
      await fetchSongs();
      
      switchTab('my');
      
      statusEl.textContent = `🎉 Upload complete! Added ${uploadedFiles.length} tracks.`;
      showToast(`Successfully uploaded ${uploadedFiles.length} tracks!`, 'success');
    } else {
      statusEl.textContent = '❌ No files were uploaded successfully.';
    }

    setTimeout(() => {
      uploadProgress.innerHTML = '';
      statusEl.textContent = '';
    }, 3000);

  } catch (error) {
    console.error('Upload error:', error);
    statusEl.textContent = `❌ Upload failed: ${error.message}`;
    showToast('Upload failed', 'error');
  }
}

// Cover Image Upload
async function uploadCover(file) {
  if (current === -1 || !currentPlaylist[current]) {
    showToast('Please select a track first', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', currentPlaylist[current].filename);

    const response = await fetch('/api/cover', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.ok) {
      showToast('Cover image uploaded successfully!', 'success');
      await fetchSongs();
      updateVinylCover(result.file.coverUrl);
    } else {
      throw new Error(result.error || 'Failed to upload cover');
    }
  } catch (error) {
    console.error('Failed to upload cover:', error);
    showToast(`Failed to upload cover: ${error.message}`, 'error');
  }
}

// Lyrics File Upload
async function uploadLyricsFile(file) {
  if (current === -1 || !currentPlaylist[current]) {
    showToast('Please select a track first', 'error');
    return;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', currentPlaylist[current].filename);

    const response = await fetch('/api/lyrics', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.ok) {
      showToast('Lyrics uploaded successfully!', 'success');
      await fetchSongs();
      loadLyrics(currentPlaylist[current].filename);
    } else {
      throw new Error(result.error || 'Failed to upload lyrics');
    }
  } catch (error) {
    console.error('Failed to upload lyrics:', error);
    showToast(`Failed to upload lyrics: ${error.message}`, 'error');
  }
}

// Event Binding Functions
function bindControls() {
  $('#prev').addEventListener('click', playPrev);
  $('#next').addEventListener('click', playNext);
  $('#playpause').addEventListener('click', togglePlayPause);
  $('#volume').addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
  });
  $('#loop').addEventListener('change', (e) => {
    audio.loop = e.target.checked;
  });
  $('#refresh').addEventListener('click', fetchSongs);

  // Audio events
  audio.addEventListener('ended', () => {
    if (!audio.loop) playNext();
  });

  audio.addEventListener('play', () => {
    $('#playpause').textContent = '⏸';
    startVinylAnimation();
    renderCurrentTab();
  });

  audio.addEventListener('pause', () => {
    $('#playpause').textContent = '▶';
    stopVinylAnimation();
    renderCurrentTab();
  });

  // Lyrics sync for LRC files
  audio.addEventListener('timeupdate', () => {
    updateLyricsHighlight(audio.currentTime);
  });

  // Tab switching
  tabMy.addEventListener('click', () => switchTab('my'));
  tabAll.addEventListener('click', () => switchTab('all'));

  // Search functionality
  const debouncedSearch = debounce((term) => {
    searchTerm = term;
    currentPlaylist = getCurrentPlaylist();
    renderCurrentTab();
  }, 300);

  searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
  });

  // Playlist interactions
  document.addEventListener('click', (e) => {
    const playBtn = e.target.closest('[data-play]');
    const delBtn = e.target.closest('[data-del]');

    if (playBtn) {
      const index = parseInt(playBtn.getAttribute('data-play'), 10);
      playIndex(index);
    } else if (delBtn) {
      const filename = delBtn.getAttribute('data-del');
      deleteSong(filename);
    }
  });

  // Media upload controls
  coverInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadCover(e.target.files[0]);
      e.target.value = '';
    }
  });

  lyricsInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadLyricsFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  lyricsTextBtn.addEventListener('click', showLyricsModal);

  // Modal controls
  $('#lyrics-modal-close').addEventListener('click', hideLyricsModal);
  $('#lyrics-cancel').addEventListener('click', hideLyricsModal);
  $('#lyrics-save').addEventListener('click', saveLyricsText);
  modalBackdrop.addEventListener('click', hideLyricsModal);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'j':
        e.preventDefault();
        playPrev();
        break;
      case 'k':
        e.preventDefault();
        playNext();
        break;
      case 'l':
        e.preventDefault();
        $('#loop').checked = !$('#loop').checked;
        audio.loop = $('#loop').checked;
        showToast(`Loop ${audio.loop ? 'enabled' : 'disabled'}`, 'success');
        break;
      case 's':
        e.preventDefault();
        $('#shuffle').checked = !$('#shuffle').checked;
        showToast(`Shuffle ${$('#shuffle').checked ? 'enabled' : 'disabled'}`, 'success');
        break;
    }
  });
}

function bindUploader() {
  const dropzone = $('#dropzone');
  const fileInput = $('#file-input');

  const highlight = () => dropzone.classList.add('drag');
  const unhighlight = () => dropzone.classList.remove('drag');

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      highlight();
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      unhighlight();
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length) {
      uploadFiles(files, uploadStatus);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      uploadFiles(e.target.files, uploadStatus);
      e.target.value = '';
    }
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎵 MusicPro Enhanced initializing...');
  
  try {
    bindControls();
    bindUploader();
    await fetchSongs();
    
    switchTab('my');
    
    console.log('🎵 MusicPro Enhanced ready!');
    showToast('MusicPro Enhanced loaded successfully!', 'success');
  } catch (error) {
    console.error('Failed to initialize MusicPro:', error);
    showToast('Failed to initialize app', 'error');
  }
});
