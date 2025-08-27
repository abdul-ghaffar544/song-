@echo off
echo 🎵 Starting MusicPro...
echo 📦 Installing dependencies...

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    npm install
)

echo 🚀 Starting server...
echo 📱 Open http://localhost:3000 in your browser
echo ⏹️  Press Ctrl+C to stop the server
echo.

REM Start the server
npm start 