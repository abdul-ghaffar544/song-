# 🎵 MusicPro - Modern Music Upload & Player

A beautiful, modern web application for uploading and playing audio files with a sleek dark theme and smooth animations.

![MusicPro Screenshot](https://via.placeholder.com/800x400/121a24/59a6ff?text=MusicPro+Interface)

## ✨ Features

### 🎨 **Modern UI/UX**
- **Dark Theme**: Elegant dark interface with smooth gradients
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Micro-interactions**: Smooth animations and hover effects
- **Card-based Layout**: Clean, organized interface

### 🎵 **Music Management**
- **Dual Playlist System**: 
  - **My Uploads**: Tracks you've uploaded (persisted in browser)
  - **Public Uploads**: All tracks on the server
- **Smart Upload**: Drag & drop or click to upload audio files
- **Real-time Progress**: Visual upload progress with shimmer effects
- **Search & Filter**: Instant search across your music library

### 🎮 **Player Features**
- **Full Audio Controls**: Play, pause, next, previous, volume, loop, shuffle
- **Keyboard Shortcuts**: 
  - `Space`: Play/Pause
  - `J`: Previous track
  - `K`: Next track
  - `L`: Toggle loop
  - `S`: Toggle shuffle
- **Visual Feedback**: Current track highlighting and status indicators
- **Marquee Text**: Long filenames scroll smoothly

### 🔧 **Technical Features**
- **Vanilla JavaScript**: No frameworks, pure performance
- **Local Storage**: Persistent "My Uploads" tracking
- **Toast Notifications**: Success/error feedback
- **File Management**: Download and delete capabilities
- **Accessibility**: Full ARIA support and keyboard navigation

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/musicpro.git
   cd musicpro
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🌐 Deployment

### Deploy to Heroku

1. **Create a Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### Deploy to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

### Deploy to Railway

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically on push**

## 📁 Project Structure

```
musicpro/
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   ├── styles.css         # Modern CSS with animations
│   └── app.js             # Vanilla JavaScript functionality
├── uploads/               # Uploaded audio files
├── server.js              # Express server
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🎨 Supported Audio Formats

- **MP3** - Most common format
- **WAV** - Uncompressed audio
- **OGG** - Open source format
- **M4A** - Apple format
- **AAC** - Advanced Audio Coding
- **FLAC** - Lossless compression

**File Size Limit**: 50MB per file

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Serve the main application |
| `POST` | `/api/upload` | Upload audio files |
| `GET` | `/api/songs` | Get list of all songs |
| `DELETE` | `/api/songs/:filename` | Delete a specific song |
| `GET` | `/uploads/:filename` | Stream audio files |

## 🎯 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
4. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request**

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ using vanilla JavaScript, Node.js, and Express
- Icons and emojis for enhanced user experience
- Modern CSS animations and transitions
- Responsive design principles

## 🐛 Bug Reports & Feature Requests

Please use the [GitHub Issues](https://github.com/yourusername/musicpro/issues) page to report bugs or request features.

## 📊 Browser Support

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Mobile browsers

---

**Made with 🎵 by [Your Name]**

> Transform your music experience with MusicPro - where modern design meets powerful functionality!
