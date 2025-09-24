#!/bin/bash

# Build script for Vehicle Reports Application
# This script builds the frontend and prepares the backend for Docker deployment

set -e

echo "🚀 Building Vehicle Reports Application..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Create backend dist directory if it doesn't exist
mkdir -p backend/dist

# Copy frontend build to backend
echo "📁 Copying frontend build to backend..."
cp -r dist/* backend/dist/

echo "✅ Build complete!"
echo ""
echo "🐳 To run with Docker:"
echo "   docker-compose up --build"
echo ""
echo "🔧 To run backend in development:"
echo "   cd backend && npm run dev"
echo ""
echo "🌐 Application will be available at:"
echo "   https://localhost:3443"
