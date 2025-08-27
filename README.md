# 🎧 Song Uploader & Player

A tiny full‑stack web app to **upload songs** and **play them** in your browser with a simple playlist UI.

- Backend: **Node.js + Express + Multer**
- Frontend: **Vanilla HTML/CSS/JS**
- Stores files on disk in the `uploads/` folder and serves them from `/uploads/...`

---

## 🚀 Quick Start (Local)

1. **Download** this folder or unzip the archive.
2. Open a terminal in the project folder and run:

```bash
npm install
npm start
```

3. Open your browser at **http://localhost:3000**

---

## 📂 Project Structure

```
song-uploader-player/
├─ public/
│  ├─ index.html     # UI
│  ├─ styles.css     # Styling
│  └─ app.js         # Frontend logic
├─ uploads/          # Your uploaded audio files (created automatically)
├─ server.js         # Express server with upload/list/delete APIs
└─ package.json
```

---

## 🧠 Features

- Drag‑and‑drop upload or "Choose Files" button
- Upload **multiple** audio files (mp3, wav, ogg, m4a, aac, flac; ≤ 50MB each)
- See a **playlist** with sizes and quick **download** buttons
- Player controls: **play/pause, next/prev, volume, loop, shuffle**
- **Delete** tracks from the server
- Static hosting of files at `/uploads/*` so the `<audio>` element can stream them

---

## 🔒 Notes on Safety

- Server limits uploads to `audio/*` MIME types only
- Max file size is **50MB** per file (tweakable in `server.js`)
- Filenames are sanitized + made unique (e.g., `my-song-1700000000000.mp3`)

---

## 🌐 Deploy

This app expects a writable filesystem for the `uploads/` folder.

- **Render/Railway/Heroku (with persistent disk)**: Works out of the box
- **Vercel/Netlify**: Not suitable (serverless, read‑only filesystem)

---

## 🛠 API (Optional)

- `POST /api/upload` – `multipart/form-data` with one or more `songs` fields
- `GET /api/songs` – returns `{ ok: true, files: [{ filename, size, url }] }`
- `DELETE /api/songs/:filename` – removes file from `uploads/`

---

## ✅ License

MIT – do anything, just don’t hold me liable 🙂
