/**
 * API Configuration Utility
 * Automatically determines the correct API base URL based on the environment
 * 
 * Development Mode (ports 5173, 3000): Uses separate backend port (3443)
 * Production Mode (other ports): Uses same port as frontend
 * 
 * Usage:
 * - Import: import { ApiConfig } from './api-config.js'
 * - Get base URL: ApiConfig.getBaseUrl()
 * - Get full config: ApiConfig.getConfig()
 */

export class ApiConfig {
  static getBaseUrl() {
    const currentUrl = window.location
    
    // Check if we're in development mode (separate frontend/backend ports)
    const isDevelopment = currentUrl.port === '5173' || currentUrl.port === '3000'
    
    if (isDevelopment) {
      // Local development: use separate backend port
      return `${currentUrl.protocol}//${currentUrl.hostname}:3443/api`
    } else {
      // Production: use same port as frontend
      return `${currentUrl.protocol}//${currentUrl.host}/api`
    }
  }
  
  static getConfig() {
    return {
      baseUrl: this.getBaseUrl(),
      isDevelopment: window.location.port === '5173' || window.location.port === '3000'
    }
  }
}

// Export a singleton instance for easy use
export const apiConfig = ApiConfig.getConfig()
