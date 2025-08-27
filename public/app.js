// DOM Helper Functions
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// DOM Elements
const audio = $('#audio');
const nowTitle = $('#now-title');
const listMy = $('#list-my');
const listPublic = $('#list-public');
const searchInput = $('#search-input');
const uploadStatus = $('#upload-status');
const uploadProgress = $('#upload-progress');
const toastContainer = $('#toast-container');

// Tab Elements
const tabMy = $('#tab-my');
const tabPublic = $('#tab-public');
const panelMy = $('#panel-my');
const panelPublic = $('#panel-public');

// State Management
let allSongs = [];
let myUploads = [];
let publicUploads = [];
let currentTab = 'my';
let currentPlaylist = [];
let current = -1;
let searchTerm = '';

// LocalStorage Management
function getMyUploadsFromStorage() {
  try {
    const stored = localStorage.getItem('myUploads');
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.warn('Failed to parse myUploads from localStorage:', e);
    return [];
  }
}

function saveMyUploadsToStorage(filenames) {
  try {
    localStorage.setItem('myUploads', JSON.stringify(filenames));
  } catch (e) {
    console.warn('Failed to save myUploads to localStorage:', e);
  }
}

function addToMyUploads(filenames) {
  const existing = getMyUploadsFromStorage();
  const updated = [...new Set([...existing, ...filenames])];
  saveMyUploadsToStorage(updated);
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

  // Auto remove after 4 seconds
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
  const myUploadFilenames = getMyUploadsFromStorage();
  
  myUploads = allSongs.filter(song => 
    myUploadFilenames.includes(song.filename)
  );
  
  publicUploads = allSongs.filter(song => 
    !myUploadFilenames.includes(song.filename)
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
  // Clear existing items
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
        <button class="action-btn danger" data-del="${track.filename}" title="Delete ${track.filename}" aria-label="Delete ${track.filename}">🗑</button>
      </div>
    `;
    
    if (isCurrent) {
      li.classList.add('current');
    }
    
    // Add entrance animation
    li.style.animationDelay = `${i * 50}ms`;
    
    listElement.appendChild(li);
  });
}

function renderCurrentTab() {
  const filteredMy = filterSongs(myUploads, searchTerm);
  const filteredPublic = filterSongs(publicUploads, searchTerm);
  
  renderList(listMy, filteredMy, true);
  renderList(listPublic, filteredPublic, false);
  
  // Update current playlist
  currentPlaylist = getCurrentPlaylist();
}

// Tab Management
function switchTab(tab) {
  if (currentTab === tab) return;
  
  currentTab = tab;
  
  // Update tab buttons
  tabMy.classList.toggle('active', tab === 'my');
  tabPublic.classList.toggle('active', tab === 'public');
  tabMy.setAttribute('aria-selected', tab === 'my');
  tabPublic.setAttribute('aria-selected', tab === 'public');
  
  // Update panels
  panelMy.classList.toggle('active', tab === 'my');
  panelPublic.classList.toggle('active', tab === 'public');
  
  // Update current playlist
  currentPlaylist = getCurrentPlaylist();
  
  // Reset current index if not in new playlist
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
  
  // Update play button text
  $('#playpause').textContent = '⏸';
  
  audio.play().catch(e => {
    console.error('Failed to play audio:', e);
    showToast('Failed to play audio', 'error');
  });
  
  renderCurrentTab();
  
  // Show now playing toast
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

// Delete Function with Animation
async function deleteSong(filename) {
  const confirmed = confirm(`Delete "${filename}" from server?`);
  if (!confirmed) return;
  
  try {
    // Find and animate the item being deleted
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
      method: 'DELETE' 
    });
    const json = await res.json();
    
    if (!json.ok) {
      throw new Error(json.error || 'Unknown error');
    }
    
    // Remove from localStorage if it was in My Uploads
    const myUploadFilenames = getMyUploadsFromStorage();
    const updatedMyUploads = myUploadFilenames.filter(f => f !== filename);
    saveMyUploadsToStorage(updatedMyUploads);
    
    await fetchSongs();
    showToast('Track deleted successfully', 'success');
    
    // Handle currently playing track deletion
    if (currentPlaylist[current] && currentPlaylist[current].filename === filename) {
      if (currentPlaylist.length <= 1) {
        audio.pause();
        audio.src = '';
        nowTitle.textContent = 'No song selected';
        $('#playpause').textContent = '▶';
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

  // Filter to audio only
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
                uploadedFiles.push(...response.files.map(f => f.filename));
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
        
        xhr.timeout = 60000; // 60 second timeout
        xhr.open('POST', '/api/upload');
        xhr.send(form);
      }).catch(err => {
        console.error(`Failed to upload ${file.name}:`, err);
        showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
        progressFill.style.background = 'var(--danger)';
      });
    }

    // Add uploaded files to My Uploads
    if (uploadedFiles.length > 0) {
      addToMyUploads(uploadedFiles);
      
      statusEl.innerHTML = `✅ Uploaded ${uploadedCount}/${audios.length} files. Refreshing...`;
      await fetchSongs();
      
      // Switch to My Uploads tab to show new uploads
      switchTab('my');
      
      statusEl.textContent = `🎉 Upload complete! Added ${uploadedFiles.length} tracks.`;
      showToast(`Successfully uploaded ${uploadedFiles.length} tracks!`, 'success');
    } else {
      statusEl.textContent = '❌ No files were uploaded successfully.';
    }

    // Clear progress bars after delay
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

// Event Binding Functions
function bindControls() {
  // Player controls
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
    renderCurrentTab();
  });

  audio.addEventListener('pause', () => {
    $('#playpause').textContent = '▶';
    renderCurrentTab();
  });

  // Tab switching
  tabMy.addEventListener('click', () => switchTab('my'));
  tabPublic.addEventListener('click', () => switchTab('public'));

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

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
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

  // Drag and drop events
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

  // File input change
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      uploadFiles(e.target.files, uploadStatus);
      e.target.value = ''; // Reset input
    }
  });

  // Click to select files
  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  // Keyboard support for dropzone
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🎵 MusicPro initializing...');
  
  try {
    bindControls();
    bindUploader();
    await fetchSongs();
    
    // Initialize with My Uploads tab
    switchTab('my');
    
    console.log('🎵 MusicPro ready!');
    showToast('MusicPro loaded successfully!', 'success');
  } catch (error) {
    console.error('Failed to initialize MusicPro:', error);
    showToast('Failed to initialize app', 'error');
  }
});
