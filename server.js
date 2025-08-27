/**
 * Simple Audio Uploader + Player server
 * Run: npm install && npm start
 * Opens on http://localhost:3000
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    // Hint browser to stream audio
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Helper to slugify filename safely
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

const storage = multer.diskStorage({
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

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    // Accept audio only
    if ((file.mimetype || '').startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed.'));
    }
  }
});

// Upload multiple files
app.post('/api/upload', upload.array('songs', 20), (req, res) => {
  const files = (req.files || []).map(f => ({
    filename: path.basename(f.filename),
    originalName: f.originalname,
    size: f.size,
    url: `/uploads/${path.basename(f.filename)}`,
    uploadedAt: new Date().toISOString()
  }));
  res.json({ ok: true, files });
});

// List songs
app.get('/api/songs', (_req, res) => {
  fs.readdir(UPLOAD_DIR, { withFileTypes: true }, (err, entries) => {
    if (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
    const files = entries
      .filter(e => e.isFile())
      .map(e => path.join(UPLOAD_DIR, e.name))
      .filter(f => {
        // basic filter by extension
        const ext = path.extname(f).toLowerCase();
        return ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext);
      })
      .map(f => {
        const stat = fs.statSync(f);
        return {
          filename: path.basename(f),
          size: stat.size,
          mtime: stat.mtimeMs,
          url: `/uploads/${path.basename(f)}`
        };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .map(({mtime, ...rest}) => rest);
    res.json({ ok: true, files });
  });
});

// Delete a song
app.delete('/api/songs/:filename', (req, res) => {
  const base = path.basename(req.params.filename);
  const target = path.join(UPLOAD_DIR, base);
  // Ensure file is inside upload dir
  if (!target.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ ok: false, error: 'Invalid path' });
    }
  fs.unlink(target, (err) => {
    if (err) {
      return res.status(404).json({ ok: false, error: 'File not found' });
    }
    res.json({ ok: true, removed: base });
  });
});

app.listen(PORT, () => {
  console.log(`🎵 Server running at http://localhost:${PORT}`);
});
