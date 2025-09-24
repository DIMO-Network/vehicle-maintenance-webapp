# Odometer Reporting Tool

A web application for tracking and reporting odometer readings using DIMO's authentication system.

## Features

- **App Configuration**: Configure DIMO Client ID and API Key
- **OAuth Authentication**: Secure login with DIMO accounts
- **Vehicle Management**: View and manage vehicle data
- **HTTPS Support**: Secure local development with mkcert

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `https://localhost:5173`

## HTTPS Setup

This project uses `vite-plugin-mkcert` to automatically generate and manage local SSL certificates for secure development. The plugin handles:

- Automatic mkcert installation
- Local CA setup
- Certificate generation
- HTTPS server configuration

No manual setup required - just run `npm run dev` and HTTPS will be automatically configured!

## Project Structure

```
src/
├── app-configuration.js    # App configuration component
├── login-element.js        # OAuth login component
├── vehicles-page.js        # Vehicles display page
├── jwt-manager.js          # JWT token management
└── my-element.js           # Main app component

# SSL certificates are automatically managed by vite-plugin-mkcert
```

## Authentication Flow

1. **Configuration**: User enters DIMO Client ID and API Key
2. **OAuth Login**: User authenticates with DIMO via OAuth
3. **Vehicle Access**: User can view their vehicles and data

## Testing

- **Main App**: `https://localhost:5173`
- **OAuth Test**: `https://localhost:5173/test-oauth.html`
- **Config Test**: `https://localhost:5173/test-auth.html`

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```
