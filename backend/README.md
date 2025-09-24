# Vehicle Reports Backend

Express.js backend API for the DIMO Vehicle Reports application.

## Features

- 🔐 **DIMO Authentication**: Handles developer and vehicle JWT tokens
- 🚗 **Vehicle Data**: Fetches vehicle information from DIMO API
- 📊 **Report Generation**: Generates CSV reports with vehicle telemetry data
- 🤖 **AI Integration**: OpenAI ChatGPT for document processing and maintenance recommendations
- 📁 **File Storage**: Stores configuration and reports in tmp directory
- 🐳 **Docker Ready**: Containerized for easy deployment

## API Endpoints

### Configuration
- `GET /api/config` - Get app configuration
- `POST /api/config` - Save app configuration

### Authentication
- `POST /api/auth/developer` - Get developer JWT token
- `POST /api/auth/vehicle` - Get vehicle JWT token

### Vehicles
- `GET /api/vehicles` - Get user's vehicles
- `GET /api/vehicle-details-info/:tokenId` - Get vehicle telemetry data

### AI Features
- `POST /api/ai/process-image` - Process images with AI
- `POST /api/ai/process-pdf` - Process PDFs with AI
- `POST /api/ai/extract-maintenance` - Extract maintenance info from documents
- `POST /api/ai/maintenance-recommendations` - Generate AI maintenance recommendations
- `POST /api/ai/prompt` - Simple text prompts

### Reports
- `POST /api/reports/generate` - Generate CSV report
- `GET /api/reports/download/:filename` - Download report
- `GET /api/reports` - List available reports

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment configuration
npm run setup

# Edit .env file with your API keys
# Then start the server
npm start
```

## Environment Configuration

The backend uses a `.env` file for configuration. Run `npm run setup` to create the template file.

### Required Variables
- `DIMO_CLIENT_ID` - Your DIMO client ID
- `DIMO_API_KEY` - Your DIMO API key  
- `DIMO_REDIRECT_URI` - Your redirect URI

### Optional Variables
- `OPENAI_API_KEY` - OpenAI API key for AI features
- `PORT` - Server port (default: 3001)
- `HTTPS_PORT` - HTTPS port (default: 3443)
- `USE_HTTPS` - Use HTTPS (default: true)

## File Storage

The backend stores data in the `tmp/` directory:
- `app-config.json` - Application configuration
- `*.csv` - Generated reports

## Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build backend only
docker build -t vehicle-reports-backend .
docker run -p 3001:3001 vehicle-reports-backend
```
