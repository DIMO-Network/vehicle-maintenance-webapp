/**
 * Shared storage service for managing localStorage across the application
 */
export class StorageService {
  constructor() {
    this.listeners = new Set()
  }

  // Storage keys
  static KEYS = {
    DIMO_JWT: 'dimo_jwt',
    DIMO_JWT_TIMESTAMP: 'dimo_jwt_timestamp',
    USER_JWT: 'user_jwt',
    USER_JWT_TIMESTAMP: 'user_jwt_timestamp',
    OAUTH_STATE: 'oauth_state'
  }

  /**
   * Set a value in localStorage and notify listeners
   */
  setItem(key, value) {
    localStorage.setItem(key, value)
    this.notifyListeners(key, value)
  }

  /**
   * Get a value from localStorage
   */
  getItem(key) {
    return localStorage.getItem(key)
  }

  /**
   * Remove a value from localStorage and notify listeners
   */
  removeItem(key) {
    localStorage.removeItem(key)
    this.notifyListeners(key, null)
  }

  /**
   * Clear all app-related localStorage items
   */
  clearAll() {
    Object.values(StorageService.KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
    this.notifyListeners('all', null)
  }

  /**
   * Clear only user session data (keep app configuration)
   */
  clearUserSession() {
    this.removeItem(StorageService.KEYS.USER_JWT)
    this.removeItem(StorageService.KEYS.USER_JWT_TIMESTAMP)
    this.removeItem(StorageService.KEYS.OAUTH_STATE)
  }


  /**
   * Check if user is authenticated
   */
  isUserAuthenticated() {
    const userJwt = this.getItem(StorageService.KEYS.USER_JWT)
    
    if (!userJwt) {
      return false
    }

    // Check JWT expiration using the actual exp claim
    return this.isJWTValid(userJwt)
  }

  /**
   * Check if JWT is valid and not expired
   */
  isJWTValid(jwt) {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      console.error('Failed to validate JWT:', error)
      return false
    }
  }


  /**
   * Get user JWT
   */
  getUserJwt() {
    return this.getItem(StorageService.KEYS.USER_JWT)
  }

  /**
   * Get user wallet address
   */
  getUserWalletAddress() {
    return this.getItem('user_wallet_address')
  }

  /**
   * Get user email
   */
  getUserEmail() {
    return this.getItem('user_email')
  }


  /**
   * Set user session
   */
  setUserSession(userSession) {
    const now = Date.now()
    
    // Handle both old format (just JWT string) and new format (object with JWT and additional info)
    if (typeof userSession === 'string') {
      this.setItem(StorageService.KEYS.USER_JWT, userSession)
      this.setItem(StorageService.KEYS.USER_JWT_TIMESTAMP, now.toString())
    } else if (typeof userSession === 'object' && userSession.jwt) {
      this.setItem(StorageService.KEYS.USER_JWT, userSession.jwt)
      this.setItem(StorageService.KEYS.USER_JWT_TIMESTAMP, userSession.timestamp ? userSession.timestamp.toString() : now.toString())
      
      // Store additional user info if available
      if (userSession.walletAddress) {
        this.setItem('user_wallet_address', userSession.walletAddress)
      }
      if (userSession.email) {
        this.setItem('user_email', userSession.email)
      }
    }
  }

  /**
   * Set OAuth state
   */
  setOAuthState(state) {
    this.setItem(StorageService.KEYS.OAUTH_STATE, state)
  }

  /**
   * Get OAuth state
   */
  getOAuthState() {
    return this.getItem(StorageService.KEYS.OAUTH_STATE)
  }

  /**
   * Clear OAuth state
   */
  clearOAuthState() {
    this.removeItem(StorageService.KEYS.OAUTH_STATE)
  }

  /**
   * Add a listener for storage changes
   */
  addListener(callback) {
    this.listeners.add(callback)
  }

  /**
   * Remove a listener
   */
  removeListener(callback) {
    this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of storage changes
   */
  notifyListeners(key, value) {
    this.listeners.forEach(callback => {
      try {
        callback(key, value)
      } catch (error) {
        console.error('Storage listener error:', error)
      }
    })
  }

  /**
   * Get current app state
   */
  getAppState() {
    return {
      isAuthenticated: this.isUserAuthenticated(),
      userJwt: this.getUserJwt()
    }
  }
}

// Create a singleton instance
export const storageService = new StorageService()
