// JWT Manager for handling DIMO authentication tokens
// Note: This simplified version doesn't use the DIMO SDK to avoid Node.js dependencies

/**
 * JWT Manager for handling DIMO authentication tokens
 */
export class JWTManager {
  constructor() {
    this.jwt = null
    this.jwtTimestamp = null
    this.jwtExpirationTime = 3600000 // 1 hour in milliseconds
  }

  /**
   * Load credentials and JWT from localStorage
   */
  loadFromStorage() {
    this.jwt = localStorage.getItem('dimo_jwt')
    this.jwtTimestamp = localStorage.getItem('dimo_jwt_timestamp')
    
    return {
      hasJWT: !!this.jwt,
      isJWTValid: this.isJWTValid()
    }
  }

  /**
   * Check if the current JWT is still valid
   */
  isJWTValid() {
    if (!this.jwt || !this.jwtTimestamp) {
      return false
    }

    const now = Date.now()
    const tokenAge = now - parseInt(this.jwtTimestamp)
    
    // Consider JWT expired if it's older than 50 minutes (leaving 10 minutes buffer)
    return tokenAge < (this.jwtExpirationTime - 600000)
  }

  /**
   * Get a valid JWT, refreshing if necessary
   */
  async getValidJWT() {
    // Load from storage first
    this.loadFromStorage()

    // If we don't have credentials, throw error
    if (!this.clientId || !this.apiKey) {
      throw new Error('No DIMO credentials found. Please login first.')
    }

    // If JWT is valid, return it
    if (this.isJWTValid()) {
      return this.jwt
    }

    // Otherwise, refresh the JWT
    return await this.refreshJWT()
  }

  /**
   * Refresh the JWT using stored credentials
   * Note: This is a simplified version that doesn't actually refresh the JWT
   * In a real implementation, you would make an API call to refresh the token
   */
  async refreshJWT() {
  
    // For now, we'll just return the existing JWT if it exists
    // In a real implementation, you would make an API call to refresh the token
    if (this.jwt) {
      return this.jwt
    }

    throw new Error('No JWT available to refresh. Please login again.')
  }

  /**
   * Clear all stored credentials and JWT
   */
  clearCredentials() {
    this.jwt = null
    this.jwtTimestamp = null

    localStorage.removeItem('dimo_jwt')
    localStorage.removeItem('dimo_jwt_timestamp')
  }

  /**
   * Get current authentication status
   */
  getAuthStatus() {
    this.loadFromStorage()
    
    return {
      hasValidJWT: this.isJWTValid(),
      jwt: this.jwt
    }
  }
}

// Create a singleton instance
export const jwtManager = new JWTManager()
