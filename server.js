/**
 * MusicPro - Enhanced Audio Uploader + Player server
 * Features: Secure deletes, cover images, lyrics, metadata management
 * Run: npm install && npm start
 * Opens on http://localhost:3000
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Directory paths
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const COVERS_DIR = path.join(UPLOAD_DIR, 'covers');
const LYRICS_DIR = path.join(UPLOAD_DIR, 'lyrics');
const PUBLIC_DIR = path.join(__dirname, 'public');
const METADATA_FILE = path.join(UPLOAD_DIR, 'metadata.json');

// Ensure all directories exist
const ensureDirs = async () => {
  for (const dir of [UPLOAD_DIR, COVERS_DIR, LYRICS_DIR]) {
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
};

// Initialize directories
ensureDirs().catch(console.error);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Metadata management
async function loadMetadata() {
  try {
    if (!fsSync.existsSync(METADATA_FILE)) {
      return [];
    }
    const data = await fs.readFile(METADATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to load metadata:', error.message);
    return [];
  }
}

async function saveMetadata(metadata) {
  try {
    const tempFile = METADATA_FILE + '.tmp';
    await fs.writeFile(tempFile, JSON.stringify(metadata, null, 2));
    await fs.rename(tempFile, METADATA_FILE);
  } catch (error) {
    console.error('Failed to save metadata:', error);
    throw error;
  }
}

async function findMetadataEntry(filename) {
  const metadata = await loadMetadata();
  return metadata.find(entry => entry.filename === filename);
}

async function updateMetadataEntry(filename, updates) {
  const metadata = await loadMetadata();
  const index = metadata.findIndex(entry => entry.filename === filename);
  if (index >= 0) {
    metadata[index] = { ...metadata[index], ...updates };
    await saveMetadata(metadata);
    return metadata[index];
  }
  return null;
}

async function removeMetadataEntry(filename) {
  const metadata = await loadMetadata();
  const filtered = metadata.filter(entry => entry.filename !== filename);
  await saveMetadata(filtered);
}

// Security helpers
function generateDeleteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

function validateMimeType(file, allowedTypes) {
  return allowedTypes.some(type => file.mimetype.startsWith(type));
}

// Audio upload storage configuration
const audioStorage = multer.diskStorage({
  destination: function(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function(_req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext);
    const safe = slugify(base) || 'audio';
    const stamp = Date.now();
    cb(null, `${safe}-${stamp}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (validateMimeType(file, ['audio/'])) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed.'));
    }
  }
});

// Cover image storage configuration
const coverStorage = multer.diskStorage({
  destination: function(_req, _file, cb) {
    cb(null, COVERS_DIR);
  },
  filename: function(req, file, cb) {
    const audioFilename = req.body.filename;
    if (!audioFilename) {
      return cb(new Error('Audio filename is required'));
    }
    const ext = path.extname(file.originalname) || '.jpg';
    const baseName = path.parse(audioFilename).name;
    cb(null, `${baseName}${ext}`);
  }
});

const coverUpload = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (validateMimeType(file, ['image/'])) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
});

// Lyrics storage (memory for text, disk for files)
const lyricsUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 }, // 500 KB
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.lrc', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .lrc and .txt files are allowed.'));
    }
  }
});

// Routes

// Upload audio files with secure delete tokens
app.post('/api/upload', audioUpload.array('songs', 20), async (req, res) => {
  try {
    const files = (req.files || []).map(f => {
      const deleteToken = generateDeleteToken();
      const deleteTokenHash = hashToken(deleteToken);
      
      return {
        filename: path.basename(f.filename),
        originalName: f.originalname,
        size: f.size,
        url: `/uploads/${path.basename(f.filename)}`,
        uploadedAt: new Date().toISOString(),
        deleteToken, // Return to client
        deleteTokenHash // Store on server
      };
    });

    // Save metadata (without deleteToken)
    const metadata = await loadMetadata();
    for (const file of files) {
      const { deleteToken, ...metadataEntry } = file;
      metadata.push(metadataEntry);
    }
    await saveMetadata(metadata);

    res.json({ 
      ok: true, 
      files: files.map(f => ({
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        url: f.url,
        uploadedAt: f.uploadedAt,
        deleteToken: f.deleteToken // Include token for client
      }))
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Upload cover image
app.post('/api/cover', coverUpload.single('file'), async (req, res) => {
  try {
    const { filename: audioFilename } = req.body;
    const file = req.file;

    if (!audioFilename || !file) {
      return res.status(400).json({ ok: false, error: 'Audio filename and image file required' });
    }

    // Check if audio file exists in metadata
    const entry = await findMetadataEntry(audioFilename);
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'Audio file not found' });
    }

    const coverUrl = `/uploads/covers/${file.filename}`;
    const updatedEntry = await updateMetadataEntry(audioFilename, { coverUrl });

    res.json({ ok: true, file: updatedEntry });
  } catch (error) {
    console.error('Cover upload error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Upload lyrics (file or text)
app.post('/api/lyrics', lyricsUpload.single('file'), async (req, res) => {
  try {
    const { filename: audioFilename, lyrics: lyricsText } = req.body;
    const file = req.file;

    if (!audioFilename) {
      return res.status(400).json({ ok: false, error: 'Audio filename required' });
    }

    if (!file && !lyricsText) {
      return res.status(400).json({ ok: false, error: 'Lyrics file or text required' });
    }

    // Check if audio file exists in metadata
    const entry = await findMetadataEntry(audioFilename);
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'Audio file not found' });
    }

    let lyricsFilename, lyricsContent;
    const baseName = path.parse(audioFilename).name;

    if (file) {
      // File upload
      const ext = path.extname(file.originalname) || '.txt';
      lyricsFilename = `${baseName}${ext}`;
      lyricsContent = file.buffer.toString('utf8');
    } else {
      // Text upload
      lyricsFilename = `${baseName}.txt`;
      lyricsContent = lyricsText;
    }

    const lyricsPath = path.join(LYRICS_DIR, lyricsFilename);
    await fs.writeFile(lyricsPath, lyricsContent, 'utf8');

    const lyricsUrl = `/uploads/lyrics/${lyricsFilename}`;
    const updatedEntry = await updateMetadataEntry(audioFilename, { lyricsUrl });

    res.json({ ok: true, file: updatedEntry });
  } catch (error) {
    console.error('Lyrics upload error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Get lyrics content
app.get('/api/lyrics/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const lyricsPath = path.join(LYRICS_DIR, filename);

    if (!fsSync.existsSync(lyricsPath)) {
      return res.status(404).json({ ok: false, error: 'Lyrics not found' });
    }

    const content = await fs.readFile(lyricsPath, 'utf8');
    const ext = path.extname(filename).toLowerCase();
    const type = ext === '.lrc' ? 'lrc' : 'txt';

    res.json({ ok: true, type, content });
  } catch (error) {
    console.error('Lyrics fetch error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// List all songs with metadata
app.get('/api/songs', async (_req, res) => {
  try {
    const metadata = await loadMetadata();
    
    // Filter out deleteTokenHash from response
    const files = metadata.map(({ deleteTokenHash, ...entry }) => entry);
    
    res.json({ ok: true, files });
  } catch (error) {
    console.error('Songs list error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Delete a song (requires authorization token)
app.delete('/api/songs/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(403).json({ ok: false, error: 'Authorization token required' });
    }

    const token = authHeader.substring(7);
    const tokenHash = hashToken(token);

    // Find metadata entry
    const entry = await findMetadataEntry(filename);
    if (!entry) {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }

    // Verify token
    if (entry.deleteTokenHash !== tokenHash) {
      return res.status(403).json({ ok: false, error: 'Invalid authorization token' });
    }

    // Delete main audio file
    const audioPath = path.join(UPLOAD_DIR, filename);
    if (fsSync.existsSync(audioPath)) {
      await fs.unlink(audioPath);
    }

    // Delete cover if exists
    if (entry.coverUrl) {
      const coverFilename = path.basename(entry.coverUrl);
      const coverPath = path.join(COVERS_DIR, coverFilename);
      if (fsSync.existsSync(coverPath)) {
        await fs.unlink(coverPath);
      }
    }

    // Delete lyrics if exists
    if (entry.lyricsUrl) {
      const lyricsFilename = path.basename(entry.lyricsUrl);
      const lyricsPath = path.join(LYRICS_DIR, lyricsFilename);
      if (fsSync.existsSync(lyricsPath)) {
        await fs.unlink(lyricsPath);
      }
    }

    // Remove from metadata
    await removeMetadataEntry(filename);

    res.json({ ok: true, removed: filename });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ ok: false, error: 'File too large' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ ok: false, error: error.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 MusicPro Server running at http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log(`🖼️  Covers directory: ${COVERS_DIR}`);
  console.log(`📝 Lyrics directory: ${LYRICS_DIR}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`🚀 Ready to rock! 🎶`);
});
