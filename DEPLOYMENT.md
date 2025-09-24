# Vehicle Reports - Deployment Guide

Although this can be deployed to the cloud, it can also just be deployed locally. Below are instructions for this aimed at our target customers that use windoze.

## Creating Windows Distribution

To create a Windows distribution package, run the deployment script:

```bash
./deploy-local.sh
```

This will create a `vehicle-reports-windows.zip` file (approximately 21MB) that contains everything needed to run the application on Windows.

## What's Included

The deployment package includes:

- **Frontend**: Built and ready-to-serve static files
- **Backend**: Complete Node.js application with all dependencies
- **Windows Scripts**:
  - `start-server.bat` - Main script to start the application
  - `setup.bat` - Initial setup script (installs dependencies)
- **Documentation**:
  - `README-Windows.md` - Instructions for Windows users
  - `SSL-SETUP.md` - SSL certificate setup instructions (if needed)
- **Dependencies**: All `node_modules` included for offline installation

## Distribution Instructions

1. **Create the package**: Run `./deploy.sh` on your Mac
2. **Distribute**: Send the `vehicle-reports-windows.zip` file to Windows users
3. **Windows Setup**: Users should:
   - Extract the zip file
   - Run `setup.bat` (installs dependencies)
   - Run `start-server.bat` (starts the application)
   - Open browser to `https://localhost:3443`

## Windows User Requirements

- Node.js (version 16 or higher)
- npm (comes with Node.js)
- Windows 10 or later

## SSL Certificates

The deployment script will:
- Include existing mkcert certificates if they exist
- Create SSL setup instructions if certificates are missing
- Provide fallback to HTTP if HTTPS setup fails

## File Structure

```
vehicle-reports-windows.zip
├── dist/                    # Frontend static files
├── backend/                 # Backend Node.js application
│   ├── src/
│   ├── node_modules/        # All dependencies included
│   ├── package.json
│   └── ...
├── start-server.bat         # Main startup script
├── setup.bat               # Initial setup script
├── README-Windows.md       # User instructions
├── SSL-SETUP.md           # SSL certificate instructions
└── package.json           # Root package.json
```

## Troubleshooting

- If the zip file is too large, consider excluding `node_modules` and having users run `npm install`
- SSL certificate issues can be resolved by following `SSL-SETUP.md`
- Windows Firewall may need to allow the application through
- Port 3443 should be available (no other applications using it)
