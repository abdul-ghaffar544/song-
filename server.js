/**
 * MusicPro: Uploader/Player with Auth (Express + PostgreSQL on Render)
 * Requires env:
 *   - DATABASE_URL   (Render Postgres External Database URL)
 *   - SESSION_SECRET (any long random string)
 * Optional:
 *   - PORT (Render sets this automatically)
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

console.log("🚀 Starting MusicPro server...");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("DATABASE_URL present:", !!process.env.DATABASE_URL);
console.log("SESSION_SECRET present:", !!process.env.SESSION_SECRET);

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- DB (safe init: do NOT crash if missing) ----------
const hasDb = !!process.env.DATABASE_URL;
const pool = hasDb
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : null;

async function initDb() {
  if (!pool) {
    console.warn('⚠️ DATABASE_URL not set. Running without DB. Auth & ownership features will be disabled.');
    return;
  }
  console.log('🗄️  Initializing database...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads_meta (
      filename TEXT PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      size BIGINT,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log('✅ DB ready.');
}
initDb().catch(err => {
  console.error('❌ DB init failed:', err);
  // Do not exit; keep serving static files so we can debug via logs.
});

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  httpOnly: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
}));

// Static files
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders: (res) => {
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!pool) return res.status(500).json({ ok:false, error:'Server DB not configured. Set DATABASE_URL.' });
  if (req.session?.user) return next();
  return res.status(401).json({ ok:false, error:'Not authenticated' });
}
function slugify(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\.-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

// Multer upload (audio only)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext);
    cb(null, `${slugify(base) || 'audio'}-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    if ((file.mimetype || '').startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed.'));
  }
});

// ---------- Routes: pages ----------
app.get('/login', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

// ---------- Routes: auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ ok:false, error:'Server DB not configured. Set DATABASE_URL.' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok:false, error:'Email and password required' });
    const hash = await bcrypt.hash(password, 12);
    const out = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id,email',
      [email, hash]
    );
    req.session.user = { id: out.rows[0].id, email: out.rows[0].email };
    res.json({ ok:true, user: req.session.user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ ok:false, error:'Email already registered' });
    console.error(e);
    res.status(500).json({ ok:false, error:'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ ok:false, error:'Server DB not configured. Set DATABASE_URL.' });
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ ok:false, error:'Email and password required' });
    const q = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!q.rowCount) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ ok:false, error:'Invalid credentials' });
    req.session.user = { id: user.id, email: user.email };
    res.json({ ok:true, user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok:true });
});

app.get('/api/auth/me', (req, res) => {
  const user = req.session?.user || null;
  res.json({ ok:true, user });
});

// ---------- Routes: upload/list/delete ----------
app.post('/api/upload', requireAuth, upload.array('songs', 20), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const files = (req.files || []).map(f => ({
      filename: path.basename(f.filename),
      originalName: f.originalname,
      size: f.size,
      url: `/uploads/${path.basename(f.filename)}`,
      uploadedAt: new Date().toISOString()
    }));
    const client = await pool.connect();
    try {
      for (const f of files) {
        await client.query(
          `INSERT INTO uploads_meta (filename, owner_id, size, uploaded_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (filename) DO UPDATE SET owner_id=EXCLUDED.owner_id, size=EXCLUDED.size`,
          [f.filename, userId, f.size]
        );
      }
    } finally { client.release(); }
    res.json({ ok:true, files });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Upload failed' });
  }
});

app.get('/api/songs', async (_req, res) => {
  try {
    const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile())
      .map(e => path.join(UPLOAD_DIR, e.name))
      .filter(f => ['.mp3','.wav','.ogg','.m4a','.aac','.flac'].includes(path.extname(f).toLowerCase()))
      .map(f => {
        const stat = fs.statSync(f);
        return {
          filename: path.basename(f),
          size: stat.size,
          url: `/uploads/${path.basename(f)}`
        };
      });
    // Join owner info if DB available
    if (pool) {
      const metaQ = await pool.query('SELECT filename, owner_id FROM uploads_meta');
      const metaMap = Object.fromEntries(metaQ.rows.map(r => [r.filename, r.owner_id]));
      return res.json({ ok:true, files: files.map(f => ({ ...f, ownerId: metaMap[f.filename] || null })) });
    }
    res.json({ ok:true, files: files.map(f => ({ ...f, ownerId: null })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Failed to list songs' });
  }
});

app.delete('/api/songs/:filename', requireAuth, async (req, res) => {
  try {
    const base = path.basename(req.params.filename);
    const target = path.join(UPLOAD_DIR, base);
    const q = await pool.query('SELECT owner_id FROM uploads_meta WHERE filename=$1', [base]);
    if (!q.rowCount) return res.status(403).json({ ok:false, error:'Delete not allowed (no owner)' });
    const ownerId = q.rows[0].owner_id;
    if (ownerId !== req.session.user.id) return res.status(403).json({ ok:false, error:'Only the uploader can delete this file' });

    fs.unlink(target, async (err) => {
      if (err) return res.status(404).json({ ok:false, error:'File not found' });
      await pool.query('DELETE FROM uploads_meta WHERE filename=$1', [base]);
      res.json({ ok:true, removed: base });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Delete failed' });
  }
});

// ---------- Catch-all: serve app ----------
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// ---------- Start ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
