#!/bin/bash

# Vehicle Reports Deployment Script
# Creates a zip file for Windows distribution

set -e

echo "🚀 Creating Vehicle Reports deployment package..."

# Configuration
DEPLOY_DIR="vehicle-reports-deploy"
ZIP_NAME="vehicle-reports-windows.zip"
FRONTEND_DIST="dist"
BACKEND_DIR="backend"

# Clean up any existing deployment directory
if [ -d "$DEPLOY_DIR" ]; then
    echo "🧹 Cleaning up existing deployment directory..."
    rm -rf "$DEPLOY_DIR"
fi

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p "$DEPLOY_DIR"

# Build frontend
echo "🔨 Building frontend..."
npm run build

# Copy frontend dist to deployment directory
echo "📦 Copying frontend files..."
cp -r "$FRONTEND_DIST" "$DEPLOY_DIR/"

# Copy backend files
echo "📦 Copying backend files..."
cp -r "$BACKEND_DIR" "$DEPLOY_DIR/"

# Create Windows batch file to start the server
echo "📝 Creating Windows batch file..."
cat > "$DEPLOY_DIR/start-server.bat" << 'EOF'
@echo off
title Vehicle Reports Server
color 0A

echo ========================================
echo    Vehicle Reports Backend Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js (which includes npm) from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Navigate to backend directory
cd backend
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Could not find backend directory
    echo Make sure you extracted the zip file correctly
    echo.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully!
    echo.
)

echo Starting server...
echo.
echo The server will be available at:
echo   - HTTPS: https://localhost:3443
echo   - HTTP:  http://localhost:3443 (if HTTPS fails)
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

REM Start the server
npm start

echo.
echo Server stopped.
pause
EOF

# Create README for Windows users
echo "📝 Creating README for Windows users..."
cat > "$DEPLOY_DIR/README-Windows.md" << 'EOF'
# Vehicle Reports - Windows Installation

## Prerequisites
- Node.js (version 16 or higher)
- npm (comes with Node.js)

## Installation & Setup

1. **Extract the zip file** to a folder on your computer (e.g., `C:\vehicle-reports\`)

2. **Open Command Prompt as Administrator**:
   - Press `Win + R`, type `cmd`, press `Ctrl + Shift + Enter`
   - Or right-click Start button → "Windows PowerShell (Admin)"

3. **Navigate to the extracted folder**:
   ```cmd
   cd C:\vehicle-reports
   ```

4. **Install dependencies**:
   ```cmd
   cd backend
   npm install
   ```

5. **Start the application**:
   - **Option A**: Double-click `start-server.bat`
   - **Option B**: Run in Command Prompt:
     ```cmd
     cd backend
     npm start
     ```

6. **Open your browser** and go to: `https://localhost:3443`

## Configuration

The application will prompt you to configure DIMO credentials on first run.

## Troubleshooting

- If you get certificate errors, you may need to install the mkcert certificates
- Make sure no other application is using port 3443
- Check Windows Firewall settings if the application doesn't start

## Stopping the Application

Press `Ctrl + C` in the command prompt window to stop the server.
EOF

# Create package.json for the deployment (includes all dependencies)
echo "📝 Creating deployment package.json..."
cat > "$DEPLOY_DIR/package.json" << 'EOF'
{
  "name": "vehicle-reports-deployment",
  "version": "1.0.0",
  "description": "Vehicle Reports Application - Windows Deployment",
  "scripts": {
    "start": "cd backend && npm start",
    "install-deps": "cd backend && npm install"
  },
  "keywords": ["vehicle", "reports", "dimo"],
  "author": "DIMO Network",
  "license": "MIT"
}
EOF

# Copy mkcert certificates if they exist
if [ -d ".mkcert" ]; then
    echo "📦 Copying SSL certificates..."
    cp -r ".mkcert" "$DEPLOY_DIR/"
else
    echo "⚠️  No SSL certificates found. Creating instructions for Windows users..."
    cat > "$DEPLOY_DIR/SSL-SETUP.md" << 'EOF'
# SSL Certificate Setup for Windows

The application requires SSL certificates to run on HTTPS. You have two options:

## Option 1: Use HTTP (Simpler)
Edit the backend/src/server.js file and change:
```javascript
const USE_HTTPS = process.env.USE_HTTPS !== 'false'
```
to:
```javascript
const USE_HTTPS = false
```

Then run: `npm start`

## Option 2: Generate SSL Certificates (Recommended)
1. Install mkcert: https://github.com/FiloSottile/mkcert
2. Run these commands in Command Prompt:
   ```cmd
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   ```
3. Move the generated files to the backend directory:
   ```cmd
   move localhost+2.pem backend/cert.pem
   move localhost+2-key.pem backend/dev.pem
   ```
4. Run: `npm start`

The application will then be available at https://localhost:3443
EOF
fi

# Create a simple setup script for Windows
echo "📝 Creating Windows setup script..."
cat > "$DEPLOY_DIR/setup.bat" << 'EOF'
@echo off
echo Vehicle Reports Setup
echo ====================
echo.
echo This will install the required dependencies and set up the application.
echo.
echo Press any key to continue...
pause > nul

echo Installing backend dependencies...
cd backend
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies.
    echo Please make sure Node.js and npm are installed.
    echo.
    pause
    exit /b 1
)

echo.
echo Setup complete! You can now run start-server.bat to start the application.
echo.
pause
EOF

# Create the zip file
echo "🗜️  Creating zip file..."
if command -v zip >/dev/null 2>&1; then
    zip -r "$ZIP_NAME" "$DEPLOY_DIR"
else
    echo "❌ zip command not found. Please install zip or use a different compression tool."
    echo "The deployment directory is ready at: $DEPLOY_DIR"
    exit 1
fi

# Clean up deployment directory
echo "🧹 Cleaning up..."
rm -rf "$DEPLOY_DIR"

echo "✅ Deployment package created successfully!"
echo "📦 File: $ZIP_NAME"
echo "📏 Size: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""
echo "You can now distribute this zip file to Windows users."
echo "They should extract it and run setup.bat first, then start-server.bat"
