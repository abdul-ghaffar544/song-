#!/bin/bash

echo "🎵 Starting MusicPro..."
echo "📦 Installing dependencies..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "🚀 Starting server..."
echo "📱 Open http://localhost:3000 in your browser"
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start 