# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create tmp directory for file storage
RUN mkdir -p tmp

# Create dist directory for frontend files
RUN mkdir -p dist

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/config', (res) => { process.exit(res.statusCode === 200 || res.statusCode === 404 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
