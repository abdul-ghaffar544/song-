const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const audio    = $('#audio');
const list     = $('#list');
const nowTitle = $('#now-title');
const record   = $('#record');
const songCount = $('#song-count');
const totalDuration = $('#total-duration');
const currentTime = $('#current-time');
const totalTime = $('#total-time');
const searchResults = $('#search-results');
const searchResultsMain = $('#search-results-main');

let playlist   = [];
let current    = -1;
let currentTab = 'all';
let myUploadsSet = new Set();
let me = null;
let isPlaying = false;
let currentPage = 'home';

// Enhanced utility functions
function fmtBytes(bytes){
  const units=['B','KB','MB','GB']; let i=0;
  while(bytes>=1024 && i<units.length-1){ bytes/=1024; i++; }
  return `${bytes.toFixed(bytes>=10?0:1)} ${units[i]}`;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateStats() {
  songCount.textContent = playlist.length;
  
  // Calculate total duration (this would need actual audio metadata)
  const totalSecs = playlist.reduce((total, track) => {
    // For demo purposes, estimate duration based on file size
    // In a real app, you'd get this from audio metadata
    const estimatedDuration = Math.max(30, Math.floor(track.size / 100000)); // Rough estimate
    return total + estimatedDuration;
  }, 0);
  
  totalDuration.textContent = formatTime(totalSecs);
}

// Update fixed audio bar display
function updateFixedAudioBar() {
  // Update track title and artist
  if ($('#now-title-fixed')) {
    $('#now-title-fixed').textContent = nowTitle.textContent || 'No song selected';
  }
  
  // Update time displays
  if ($('#current-time-fixed')) {
    $('#current-time-fixed').textContent = currentTime?.textContent || '0:00';
  }
  if ($('#total-time-fixed')) {
    $('#total-time-fixed').textContent = totalTime?.textContent || '0:00';
  }
  
  // Update progress bar
  if (audio && $('#progress-fill-fixed')) {
    const progress = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
    $('#progress-fill-fixed').style.width = `${progress}%`;
  }
  
  // Update play/pause button
  updateFixedPlayPauseButton();
}

function updateFixedPlayPauseButton() {
  const playPauseBtn = $('#playpause-fixed');
  if (playPauseBtn) {
    if (isPlaying) {
      playPauseBtn.innerHTML = '<span class="icon">⏸</span>';
      playPauseBtn.title = 'Pause';
      playPauseBtn.classList.add('playing');
    } else {
      playPauseBtn.innerHTML = '<span class="icon">▶</span>';
      playPauseBtn.title = 'Play';
      playPauseBtn.classList.remove('playing');
    }
  }
}

// Navigation Functions
function showPage(pageName) {
  // Hide all pages
  $$('.page-content').forEach(page => {
    page.classList.remove('active');
  });
  
  // Remove active class from all nav links
  $$('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Show selected page
  const targetPage = $(`#${pageName}-page`);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // Activate corresponding nav link
  const activeLink = $(`[data-page="${pageName}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
  
  currentPage = pageName;
  
  // Update page title
  const titles = {
    home: 'MusicPro • Home',
    search: 'MusicPro • Search',
    library: 'MusicPro • Library',
    account: 'MusicPro • Account'
  };
  document.title = titles[pageName] || 'MusicPro';
  
  // Handle page-specific logic
  switch(pageName) {
    case 'home':
      // Home page is already loaded
      break;
    case 'search':
      // Focus on search input
      setTimeout(() => {
        $('#search-main')?.focus();
      }, 100);
      break;
    case 'library':
      // Refresh library data
      renderList();
      break;
    case 'account':
      // Update account information
      updateAccountInfo();
      break;
  }
}

function updateAccountInfo() {
  if (me) {
    $('#user-email').textContent = me.email;
    $('#member-since').textContent = 'Today'; // This would come from user data
    $('#total-uploads').textContent = playlist.filter(track => track.ownerId === me.id).length;
  } else {
    $('#user-email').textContent = 'Not logged in';
    $('#member-since').textContent = '-';
    $('#total-uploads').textContent = '0';
  }
}

async function getMe(){
  const res = await fetch('/api/auth/me');
  const json = await res.json();
  me = json.user;
  const authbox = $('#authbox');
  const logout = $('#logout');
  if(me){
    authbox.innerHTML = `<span class="email">${me.email}</span>`;
    if(logout){ 
      logout.style.display='inline-block';
      logout.onclick = async () => {
        await fetch('/api/auth/logout', { method:'POST' });
        location.reload();
      };
    }
    // Update account info if on account page
    if (currentPage === 'account') {
      updateAccountInfo();
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
  try {
  const res = await fetch('/api/songs');
  const json = await res.json();
  if(!json.ok) throw new Error(json.error || 'Failed to load songs');
  playlist = json.files;
  updateMyUploadsSet(playlist);
    updateStats();
    updateQuickStats();
    updateRecentActivity();
  renderList();
  } catch (error) {
    console.error('Error fetching songs:', error);
    showMessage('Error loading songs. Please try again.', 'error');
  }
}

function visibleList(){
  const q = ($('#search')?.value || '').toLowerCase();
  let files = playlist;
  if(currentTab === 'my' && me){
    files = playlist.filter(f => myUploadsSet.has(f.filename));
  }
  if(q) files = files.filter(f => f.filename.toLowerCase().includes(q));
  
  // Update search results display
  if (searchResults) {
    if (q) {
      searchResults.textContent = `Found ${files.length} song${files.length !== 1 ? 's' : ''} for "${q}"`;
    } else {
      searchResults.textContent = `Showing ${files.length} song${files.length !== 1 ? 's' : ''}`;
    }
  }
  
  return files;
}

function renderList(){
  const files = visibleList();
  list.innerHTML = '';
  
  if(files.length === 0){
    const emptyMessage = currentTab === 'my' ? 
      'No songs in your collection yet. Start uploading!' : 
      'No songs found.';
    list.innerHTML = `<li class="empty-state">${emptyMessage}</li>`;
    return;
  }
  
  files.forEach((track, index) => {
    const isCurrent = (playlist.findIndex(p => p.filename === track.filename) === current);
    const canDelete = me && track.ownerId === me.id;
    const li = document.createElement('li');
    
    li.innerHTML = `
      <div class="meta">
        <button class="icon-btn play-btn ${isCurrent ? 'playing' : ''}" data-play="${track.filename}" title="${isCurrent ? 'Now Playing' : 'Play'}">
          ${isCurrent ? '▶︎' : '►'}
        </button>
        <div class="track-info">
        <span class="title">${track.filename}</span>
          <span class="track-meta">
        <span class="size">${fmtBytes(track.size)}</span>
            ${track.ownerId === me?.id ? '<span class="owner-badge">👤</span>' : ''}
          </span>
        </div>
      </div>
      <div class="actions">
        <a class="icon-btn" href="${track.url}" download title="Download">
          <span class="icon">⬇</span>
          <span class="label">Download</span>
        </a>
        ${canDelete ? `
          <button class="icon-btn danger" data-del="${track.filename}" title="Delete">
            <span class="icon">🗑</span>
            <span class="label">Delete</span>
          </button>
        ` : ''}
      </div>
    `;
    
    // Add staggered animation
    li.style.animationDelay = `${index * 0.05}s`;
    list.appendChild(li);
  });
}

// Search functionality for main search page
function performSearch(query) {
  if (!query.trim()) {
    $('#search-list').innerHTML = '<li class="empty-state">Start typing to search for music...</li>';
    if (searchResultsMain) {
      searchResultsMain.textContent = 'Start typing to search...';
    }
    return;
  }
  
  const results = playlist.filter(track => 
    track.filename.toLowerCase().includes(query.toLowerCase())
  );
  
  if (searchResultsMain) {
    searchResultsMain.textContent = `Found ${results.length} song${results.length !== 1 ? 's' : ''} for "${query}"`;
  }
  
  renderSearchResults(results);
}

function renderSearchResults(results) {
  const searchList = $('#search-list');
  searchList.innerHTML = '';
  
  if (results.length === 0) {
    searchList.innerHTML = '<li class="empty-state">No songs found matching your search.</li>';
    return;
  }
  
  results.forEach((track, index) => {
    const li = document.createElement('li');
    li.className = 'search-result-item';
    
    li.innerHTML = `
      <div class="meta">
        <button class="icon-btn play-btn" data-play="${track.filename}" title="Play">
          ►
        </button>
        <div class="track-info">
          <span class="title">${track.filename}</span>
          <span class="track-meta">
            <span class="size">${fmtBytes(track.size)}</span>
            ${track.ownerId === me?.id ? '<span class="owner-badge">👤</span>' : ''}
          </span>
        </div>
      </div>
      <div class="actions">
        <a class="icon-btn" href="${track.url}" download title="Download">
          <span class="icon">⬇</span>
          <span class="label">Download</span>
        </a>
        ${track.ownerId === me?.id ? `
          <button class="icon-btn danger" data-del="${track.filename}" title="Delete">
            <span class="icon">🗑</span>
            <span class="label">Delete</span>
          </button>
        ` : ''}
      </div>
    `;
    
    li.style.animationDelay = `${index * 0.05}s`;
    searchList.appendChild(li);
  });
}

function playByFilename(name){
  const idx = playlist.findIndex(t => t.filename === name);
  if(idx === -1) return;
  
  current = idx;
  const track = playlist[current];
  
  // Update UI
  audio.src = track.url;
  nowTitle.textContent = track.filename;
  
  // Update record animation
  record.classList.add('spin');
  
  // Play audio
  audio.play().then(() => {
    isPlaying = true;
    updatePlayPauseButton();
    // Update fullscreen display if open
    if (isFullscreenOpen) {
      updateFullscreenDisplay();
    }
  }).catch(error => {
    console.error('Error playing audio:', error);
    showMessage('Error playing audio. Please try again.', 'error');
  });
  
  // Re-render list to update play button states
  renderList();
  
  // Switch to home page to show player
  showPage('home');
}

function updatePlayPauseButton() {
  const playPauseBtn = $('#playpause');
  if (isPlaying) {
    playPauseBtn.innerHTML = '<span class="icon">⏸</span><span class="label">Pause</span>';
    playPauseBtn.title = 'Pause';
  } else {
    playPauseBtn.innerHTML = '<span class="icon">▶</span><span class="label">Play</span>';
    playPauseBtn.title = 'Play';
  }
}

function showMessage(message, type = 'info') {
  const status = $('#upload-status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    status.textContent = '';
    status.className = 'status';
  }, 5000);
}

// Audio event handlers
audio.addEventListener('play', () => {
  isPlaying = true;
  updatePlayPauseButton();
  updateFixedPlayPauseButton(); // Sync with fixed bar
  updateFullscreenPlayPauseButton(); // Sync with fullscreen
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  updatePlayPauseButton();
  updateFixedPlayPauseButton(); // Sync with fixed bar
  updateFullscreenPlayPauseButton(); // Sync with fullscreen
});

audio.addEventListener('ended', () => {
  isPlaying = false;
  updatePlayPauseButton();
  updateFixedPlayPauseButton(); // Sync with fixed bar
  updateFullscreenPlayPauseButton(); // Sync with fullscreen
  record.classList.remove('spin');
  
  // Auto-play next if not on loop
  if (!$('#loop').checked && current < playlist.length - 1) {
    playNext();
  }
});

audio.addEventListener('timeupdate', () => {
  if (currentTime) currentTime.textContent = formatTime(audio.currentTime);
  if (totalTime) totalTime.textContent = formatTime(audio.duration);
  updateFixedAudioBar(); // Sync with fixed bar
  updateFullscreenDisplay(); // Sync with fullscreen
});

audio.addEventListener('loadedmetadata', () => {
  if (totalTime) totalTime.textContent = formatTime(audio.duration);
  updateFixedAudioBar(); // Sync with fixed bar
  updateFullscreenDisplay(); // Sync with fullscreen
});

// Handle when audio source changes
audio.addEventListener('loadstart', () => {
  updateFullscreenDisplay(); // Sync with fullscreen
});

// Control button handlers
$('#playpause').onclick = () => {
  if (current === -1 && playlist.length > 0) {
    playByFilename(playlist[0].filename);
  } else if (isPlaying) {
    audio.pause();
  } else {
    audio.play();
  }
};

$('#prev').onclick = playPrev;
$('#next').onclick = playNext;

function playPrev() {
  if (playlist.length === 0) return;
  if (current <= 0) {
    current = playlist.length - 1;
  } else {
    current--;
  }
  playByFilename(playlist[current].filename);
}

function playNext() {
  if (playlist.length === 0) return;
  if (current >= playlist.length - 1) {
    current = 0;
  } else {
    current++;
  }
  playByFilename(playlist[current].filename);
}

// Volume control
$('#volume').oninput = (e) => {
  audio.volume = e.target.value;
};

// Loop and shuffle
$('#loop').onchange = (e) => {
  audio.loop = e.target.checked;
};

$('#shuffle').onchange = (e) => {
  // Implement shuffle logic here
  console.log('Shuffle:', e.target.checked);
};

// Tab switching
$$('.tab').forEach(tab => {
  tab.onclick = () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderList();
  };
});

// Search functionality
$('#search').oninput = () => {
  renderList();
};

// Main search functionality
$('#search-main').oninput = (e) => {
  performSearch(e.target.value);
};

// Filter functionality
$('#genre-filter').onchange = () => {
  // Implement genre filtering
  console.log('Genre filter:', $('#genre-filter').value);
};

$('#duration-filter').onchange = () => {
  // Implement duration filtering
  console.log('Duration filter:', $('#duration-filter').value);
};

// Playlist item interactions
  list.addEventListener('click', (e) => {
  const target = e.target.closest('[data-play], [data-del]');
  if (!target) return;
  
  if (target.dataset.play) {
    playByFilename(target.dataset.play);
  } else if (target.dataset.del) {
    deleteSong(target.dataset.del);
  }
});

// Search results interactions
$('#search-list').addEventListener('click', (e) => {
  const target = e.target.closest('[data-play], [data-del]');
  if (!target) return;
  
  if (target.dataset.play) {
    playByFilename(target.dataset.play);
  } else if (target.dataset.del) {
    deleteSong(target.dataset.del);
  }
});

async function deleteSong(filename) {
  if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
  
  try {
    const res = await fetch(`/api/songs/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      // Remove from playlist
      playlist = playlist.filter(t => t.filename !== filename);
      updateStats();
    renderList();
      
      // Update search results if on search page
      if (currentPage === 'search') {
        performSearch($('#search-main').value);
      }
      
      showMessage(`"${filename}" deleted successfully`, 'success');
      
      // If deleted song was playing, stop audio
      if (current !== -1 && playlist[current]?.filename === filename) {
        audio.pause();
        current = -1;
        nowTitle.textContent = 'No song selected';
        record.classList.remove('spin');
      }
    } else {
      throw new Error('Failed to delete song');
    }
  } catch (error) {
    console.error('Error deleting song:', error);
    showMessage('Error deleting song. Please try again.', 'error');
  }
}

// File upload handling
const dropzone = $('#dropzone');
const fileInput = $('#file-input');

dropzone.onclick = () => fileInput.click();

dropzone.ondragover = (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
};

dropzone.ondragleave = () => {
  dropzone.classList.remove('drag');
};

dropzone.ondrop = (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  handleFiles(e.dataTransfer.files);
};

fileInput.onchange = () => {
  handleFiles(fileInput.files);
};

async function handleFiles(files) {
  if (files.length === 0) return;
  
  const uploadProgress = $('#upload-progress');
  const progressFill = $('#progress-fill');
  const progressText = $('#progress-text');
  
  uploadProgress.style.display = 'block';
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (!file.type.startsWith('audio/')) {
      showMessage(`"${file.name}" is not an audio file`, 'warning');
      continue;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      showMessage(`"${file.name}" is too large (max 50MB)`, 'warning');
      continue;
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Simulate upload progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress > 90) progress = 90;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
      }, 200);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      
      if (res.ok) {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        showMessage(`"${file.name}" uploaded successfully!`, 'success');
        
        // Refresh playlist
        await fetchSongs();
        
        // Reset progress after a delay
        setTimeout(() => {
          uploadProgress.style.display = 'none';
          progressFill.style.width = '0%';
          progressText.textContent = '0%';
        }, 2000);
        
      } else {
        throw new Error('Upload failed');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      showMessage(`Error uploading "${file.name}"`, 'error');
    }
  }
}

// Account page functionality
$('#save-preferences').onclick = () => {
  const preferences = {
    autoPlay: $('#auto-play').checked,
    showNotifications: $('#show-notifications').checked,
    darkMode: $('#dark-mode').checked
  };
  
  // Save preferences (in a real app, this would go to the server)
  localStorage.setItem('musicpro-preferences', JSON.stringify(preferences));
  showMessage('Preferences saved successfully!', 'success');
};

$('#export-data').onclick = () => {
  const userData = {
    email: me?.email || 'Not logged in',
    totalUploads: playlist.filter(track => track.ownerId === me?.id).length,
    preferences: JSON.parse(localStorage.getItem('musicpro-preferences') || '{}')
  };
  
  const dataStr = JSON.stringify(userData, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = 'musicpro-data.json';
  link.click();
  
  URL.revokeObjectURL(url);
  showMessage('Data exported successfully!', 'success');
};

$('#delete-account').onclick = () => {
  if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
    showMessage('Account deletion requested. Please contact support.', 'warning');
  }
};

// Load saved preferences
function loadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem('musicpro-preferences') || '{}');
    $('#auto-play').checked = saved.autoPlay || false;
    $('#show-notifications').checked = saved.showNotifications || false;
    $('#dark-mode').checked = saved.darkMode || false;
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

// Music Tiles Functionality
function initMusicTiles() {
  // Filter tabs functionality
  $$('.filter-tab').forEach(tab => {
    tab.onclick = () => {
      // Remove active class from all tabs
      $$('.filter-tab').forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      tab.classList.add('active');
      
      const filter = tab.dataset.filter;
      filterTiles(filter);
    };
  });
  
  // Tile click handlers
  $$('.tile').forEach(tile => {
    tile.onclick = () => {
      const category = tile.dataset.category;
      handleTileClick(category);
    };
  });
  
  // Update stats
  updateQuickStats();
  updateRecentActivity();
}

function filterTiles(filter) {
  const tiles = $$('.tile');
  
  tiles.forEach(tile => {
    if (filter === 'all' || tile.dataset.category === filter) {
      tile.style.display = 'block';
      tile.style.animation = 'fadeIn 0.3s ease-out';
    } else {
      tile.style.display = 'none';
    }
  });
  
  // Update filter message
  const message = filter === 'all' ? 'Showing all categories' : `Showing ${filter} categories`;
  showMessage(message, 'info');
}

function handleTileClick(category) {
  const actions = {
    'recent': () => {
      showMessage('Showing recent uploads...', 'success');
      setTimeout(() => showPage('library'), 500);
    },
    'collection': () => {
      showMessage('Opening your collection...', 'success');
      setTimeout(() => showPage('library'), 500);
    },
    'all-music': () => {
      showMessage('Showing all community music...', 'success');
      setTimeout(() => showPage('library'), 500);
    },
    'upload': () => {
      showMessage('Opening upload section...', 'success');
      // Scroll to uploader section
      document.querySelector('.uploader').scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  if (actions[category]) {
    actions[category]();
  }
}

function updateQuickStats() {
  // Update total songs
  if ($('#total-songs')) {
    $('#total-songs').textContent = playlist.length;
  }
  
  // Update my uploads
  if ($('#my-uploads')) {
    const myUploads = playlist.filter(track => track.ownerId === me?.id).length;
    $('#my-uploads').textContent = myUploads;
  }
  
  // Update total duration
  if ($('#total-duration-display')) {
    const totalSecs = playlist.reduce((total, track) => {
      const estimatedDuration = Math.max(30, Math.floor(track.size / 100000));
      return total + estimatedDuration;
    }, 0);
    $('#total-duration-display').textContent = formatTime(totalSecs);
  }
}

function updateRecentActivity() {
  const activityList = $('#activity-list');
  if (!activityList) return;
  
  // Clear existing activities
  activityList.innerHTML = '';
  
  // Add welcome message
  const welcomeItem = document.createElement('div');
  welcomeItem.className = 'activity-item';
  welcomeItem.innerHTML = `
    <span class="activity-icon">🎵</span>
    <span class="activity-text">Welcome to MusicPro!</span>
  `;
  activityList.appendChild(welcomeItem);
  
  // Add recent uploads if any
  if (playlist.length > 0) {
    const recentItem = document.createElement('div');
    recentItem.className = 'activity-item';
    recentItem.innerHTML = `
      <span class="activity-icon">📁</span>
      <span class="activity-text">${playlist.length} song${playlist.length !== 1 ? 's' : ''} in your library</span>
    `;
    activityList.appendChild(recentItem);
  }
  
  // Add upload activity if user has uploaded
  if (me && playlist.some(track => track.ownerId === me.id)) {
    const uploadItem = document.createElement('div');
    uploadItem.className = 'activity-item';
    uploadItem.innerHTML = `
      <span class="activity-icon">📤</span>
      <span class="activity-text">You've uploaded music to the community</span>
    `;
    activityList.appendChild(uploadItem);
  }
}

// Full Screen Player Functionality
let isFullscreenOpen = false;

function openFullscreenPlayer() {
  const fullscreenPlayer = $('#fullscreen-player');
  if (fullscreenPlayer) {
    fullscreenPlayer.classList.add('active');
    isFullscreenOpen = true;
    document.body.style.overflow = 'hidden';
    
    // Sync with current audio state
    updateFullscreenDisplay();
    
    // Add keyboard event listener for ESC key
    document.addEventListener('keydown', handleFullscreenKeydown);
    
    // Focus on the fullscreen player for better accessibility
    fullscreenPlayer.focus();
  }
}

function closeFullscreenPlayer() {
  const fullscreenPlayer = $('#fullscreen-player');
  if (fullscreenPlayer) {
    fullscreenPlayer.classList.remove('active');
    isFullscreenOpen = false;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleFullscreenKeydown);
  }
}

function handleFullscreenKeydown(e) {
  if (e.key === 'Escape') {
    closeFullscreenPlayer();
  }
}

function updateFullscreenDisplay() {
  if (!isFullscreenOpen) return;
  
  // Update song info
  if ($('#song-title-fullscreen')) {
    $('#song-title-fullscreen').textContent = nowTitle.textContent || 'No song selected';
  }
  if ($('#song-artist-fullscreen')) {
    $('#song-artist-fullscreen').textContent = 'MusicPro Artist';
  }
  if ($('#song-album-fullscreen')) {
    $('#song-album-fullscreen').textContent = 'Unknown Album';
  }
  
  // Update time displays
  if ($('#current-time-fullscreen')) {
    $('#current-time-fullscreen').textContent = currentTime?.textContent || '0:00';
  }
  if ($('#total-time-fullscreen')) {
    $('#total-time-fullscreen').textContent = totalTime?.textContent || '0:00';
  }
  
  // Update progress bar
  if (audio && $('#progress-fill-fullscreen')) {
    const progress = audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
    $('#progress-fill-fullscreen').style.width = `${progress}%`;
  }
  
  // Update play/pause button
  updateFullscreenPlayPauseButton();
  
  // Update cover art
  updateFullscreenCoverArt();
}

function updateFullscreenPlayPauseButton() {
  const playPauseBtn = $('#playpause-fullscreen');
  if (playPauseBtn) {
    if (isPlaying) {
      playPauseBtn.innerHTML = '<span class="icon">⏸</span>';
      playPauseBtn.title = 'Pause';
      playPauseBtn.classList.add('playing');
    } else {
      playPauseBtn.innerHTML = '<span class="icon">▶</span>';
      playPauseBtn.title = 'Play';
      playPauseBtn.classList.remove('playing');
    }
  }
}

function updateFullscreenCoverArt() {
  const coverContainer = $('#cover-art-container');
  if (!coverContainer) return;
  coverContainer.classList.remove('has-cover');
}

// Update fullscreen player when page becomes visible
function handleVisibilityChange() {
  if (!document.hidden && isFullscreenOpen) {
    updateFullscreenDisplay();
  }
}

// Initialize app
async function init() {
  // Set up navigation
  $$('.nav-link').forEach(link => {
    link.onclick = () => {
      const page = link.dataset.page;
      showPage(page);
    };
  });
  
  // Initialize music tiles
  initMusicTiles();
  
  // Initialize fixed audio bar controls
  $('#playpause-fixed').onclick = () => {
    if (current === -1 && playlist.length > 0) {
      playByFilename(playlist[0].filename);
    } else if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };
  
  $('#prev-fixed').onclick = playPrev;
  $('#next-fixed').onclick = playNext;
  
  // Volume control for fixed bar
  $('#volume-fixed').oninput = (e) => {
    audio.volume = e.target.value;
    // Sync with main volume control if it exists
    if ($('#volume')) {
      $('#volume').value = e.target.value;
    }
  };
  
  // Loop and shuffle controls for fixed bar
  $('#loop-fixed').onclick = () => {
    $('#loop-fixed').classList.toggle('active');
  };
  
  $('#shuffle-fixed').onclick = () => {
    $('#shuffle-fixed').classList.toggle('active');
  };
  
  // Full Screen Player Event Listeners
  $('#audio-bar').onclick = openFullscreenPlayer;
  
  $('#close-fullscreen').onclick = closeFullscreenPlayer;
  
  // Full screen control buttons
  $('#playpause-fullscreen').onclick = () => {
    if (current === -1 && playlist.length > 0) {
      playByFilename(playlist[0].filename);
    } else if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };
  
  $('#prev-fullscreen').onclick = playPrev;
  $('#next-fullscreen').onclick = playNext;
  
  // Full screen volume control
  $('#volume-fullscreen').oninput = (e) => {
    audio.volume = e.target.value;
    // Sync with other volume controls
    if ($('#volume')) {
      $('#volume').value = e.target.value;
    }
    if ($('#volume-fixed')) {
      $('#volume-fixed').value = e.target.value;
    }
  };
  
  // Full screen loop and shuffle
  $('#loop-fullscreen').onclick = () => {
    $('#loop-fullscreen').classList.toggle('active');
    $('#loop-fixed').classList.toggle('active');
  };
  
  $('#shuffle-fullscreen').onclick = () => {
    $('#shuffle-fullscreen').classList.toggle('active');
    $('#shuffle-fixed').classList.toggle('active');
  };
  
  // Progress bar click handler for full screen
  $('#progress-bar-fullscreen').onclick = (e) => {
    if (!audio.duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    audio.currentTime = percentage * audio.duration;
  };
  
  // Add visibility change listener for fullscreen player
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Handle window resize for fullscreen player
  window.addEventListener('resize', () => {
    if (isFullscreenOpen) {
      // Small delay to ensure DOM is updated
      setTimeout(updateFullscreenDisplay, 100);
    }
  });
  
  // Load preferences
  loadPreferences();
  
  await getMe();
  await fetchSongs();
  
  // Add some visual polish
  document.body.classList.add('loaded');
  
  showPage(currentPage); // Ensure initial page is shown
}

// Start the app
init().catch(console.error);
