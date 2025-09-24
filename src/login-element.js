import { LitElement, css, html } from 'lit'
import { storageService } from './storage-service.js'
import { DimoApiService } from './dimo-api-service.js'
import { ConfigUtils } from './config-utils.js'

/**
 * OAuth Login component for DIMO user authentication
 */
export class LoginElement extends LitElement {
  static get properties() {
    return {
      isLoading: { type: Boolean },
      error: { type: String },
      isConfigured: { type: Boolean },
      showClearConfirm: { type: Boolean }
    }
  }

  constructor() {
    super()
    this.isLoading = false
    this.error = ''
    this.isConfigured = false
    this.showClearConfirm = false
    this.dimoApiService = new DimoApiService()
  }

  async connectedCallback() {
    super.connectedCallback()
    await this.checkConfigurationStatus()
    this.checkForExistingSession()
    await this.checkForOAuthCallback()
  }

  async checkConfigurationStatus() {
    const { isConfigured, config, error } = await ConfigUtils.checkAppConfiguration()
    
    this.isConfigured = isConfigured
    
    // If app is not configured, redirect to configuration page
    if (!isConfigured) {
      console.log('App not configured, redirecting to configuration page')
       window.location.href = '/config'
      return
    }
    
    // Store the config for later use if available
    if (config) {
      this.appConfig = config
    }
  }

  checkForExistingSession() {
    // Check if user already has a valid JWT session
    const userJwt = storageService.getUserJwt()
    if (userJwt && this.isJWTValid(userJwt)) {
      console.log('Valid JWT found, redirecting to vehicles page')
      // Dispatch login success event to redirect to vehicles
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { 
          jwt: userJwt,
          walletAddress: storageService.getUserWalletAddress(),
          email: storageService.getUserEmail()
        },
        bubbles: true
      }))
    }
  }

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

  async checkForOAuthCallback() {
    // Check if we're returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    const walletAddress = urlParams.get('walletAddress')
    const email = urlParams.get('email')
    const error = urlParams.get('error')

    if (error) {
      this.error = `OAuth error: ${error}`
      return
    }

    if (token && walletAddress) {
      await this.handleOAuthCallback(token, walletAddress, email)
    }
  }

  async handleOAuthCallback(token, walletAddress, email) {
    console.log('OAuth callback received:', { token: token?.substring(0, 20) + '...', walletAddress, email })
    this.isLoading = true
    this.error = ''

    try {
      // Get the client ID from stored config or fetch if not available
      let config = this.appConfig
      if (!config) {
        const { config: fetchedConfig } = await ConfigUtils.checkAppConfiguration()
        config = fetchedConfig
      }
      
      if (!config || !config.clientId) {
        throw new Error('No client ID found. Please configure the app first.')
      }
      const clientId = config.clientId

      // Validate the JWT token (basic validation)
      if (!this.isValidJWT(token)) {
        throw new Error('Invalid JWT token received')
      }

      // Store the user session with token and additional info
      const userSession = {
        jwt: token,
        walletAddress: walletAddress,
        email: email,
        timestamp: Date.now()
      }
      
      storageService.setUserSession(userSession)

      // Clear OAuth state
      storageService.clearOAuthState()

      // Clean up URL parameters after successful login
      const url = new URL(window.location)
      url.searchParams.delete('token')
      url.searchParams.delete('walletAddress')
      url.searchParams.delete('email')
      window.history.replaceState({}, '', url.pathname)

      // Dispatch login success event
      console.log('Dispatching login-success event')
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { 
          jwt: token,
          walletAddress: walletAddress,
          email: email
        },
        bubbles: true
      }))

    } catch (error) {
      console.error('OAuth callback failed:', error)
      this.error = error.message || 'Login failed. Please try again.'
    } finally {
      this.isLoading = false
    }
  }

  isValidJWT(token) {
    return true
    try {
      // Basic JWT structure validation (header.payload.signature)
      const parts = token.split('.')
      if (parts.length !== 3) {
        return false
      }

      // Decode the header to check if it's a valid JWT
      const header = JSON.parse(atob(parts[0]))
      if (!header.alg || !header.typ) {
        return false
      }

      // Decode the payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const now = Math.floor(Date.now() / 1000)
      
      if (payload.exp && payload.exp < now) {
        return false
      }

      return true
    } catch (error) {
      console.error('JWT validation error:', error)
      return false
    }
  }

  async initiateLogin() {
    this.isLoading = true
    this.error = ''

    try {
      // Get the client ID from stored config or fetch if not available
      let config = this.appConfig
      if (!config) {
        const { config: fetchedConfig } = await ConfigUtils.checkAppConfiguration()
        config = fetchedConfig
      }
      
      if (!config || !config.clientId) {
        throw new Error('No client ID found. Please configure the app first.')
      }
      const clientId = config.clientId

      // Generate state parameter for security
      const state = Math.random().toString(36).substring(2, 15)
      storageService.setOAuthState(state)

      // Build OAuth URL
      const loginBaseUrl = 'https://login.dimo.org'
      const redirectUri = encodeURIComponent(window.location.origin + "/login")
      const oauthUrl = `${loginBaseUrl}?` +
        `clientId=${encodeURIComponent(clientId)}&` +
        `redirectUri=${redirectUri}&` +
        `entryState=VEHICLE_MANAGER&permissions=11111100`

      // Redirect to OAuth provider
      window.location.href = oauthUrl

    } catch (error) {
      console.error('Login initiation failed:', error)
      this.error = error.message || 'Failed to initiate login'
      this.isLoading = false
    }
  }

  showClearConfiguration() {
    this.showClearConfirm = true
    this.requestUpdate()
  }

  cancelClearConfiguration() {
    this.showClearConfirm = false
    this.requestUpdate()
  }

  async clearConfiguration() {
    try {
      // Clear app configuration from backend
      await this.dimoApiService.deleteConfig()
      
      // Update configuration status
      this.isConfigured = false
      this.showClearConfirm = false
      
      // Clear any error messages
      this.error = ''
      
      console.log('App configuration cleared successfully')
      
      // Dispatch configuration cleared event
      this.dispatchEvent(new CustomEvent('config-cleared', {
        detail: { message: 'App configuration has been cleared' },
        bubbles: true
      }))
      
      // Redirect to configuration page
      setTimeout(() => {
        window.location.href = '/'
      }, 1000) // Small delay to show the cleared message
      
    } catch (error) {
      console.error('Failed to clear configuration:', error)
      this.error = 'Failed to clear configuration. Please try again.'
    }
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="login-container">
          <div class="login-card">
            <div class="loading">
              <div class="spinner"></div>
              <p>Processing login...</p>
            </div>
          </div>
        </div>
      `
    }

    // If app is not configured, show redirecting message
    if (!this.isConfigured) {
      return html`
        <div class="login-container">
          <div class="login-card">
            <div class="loading">
              <div class="spinner"></div>
              <p>Redirecting to configuration...</p>
            </div>
          </div>
        </div>
      `
    }

    return html`
      <div class="login-container">
        <div class="login-card">
          <h2>User Login</h2>
          <p class="subtitle">Sign in with your DIMO account to access your vehicles</p>
          
          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          
          <!-- Configuration Status -->
          <div class="config-status">
            <div class="status-indicator ${this.isConfigured ? 'configured' : 'not-configured'}">
              <svg class="status-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                ${this.isConfigured ? html`
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor"/>
                ` : html`
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                `}
              </svg>
              <span class="status-text">
                ${this.isConfigured ? 'App is configured' : 'App not configured'}
              </span>
            </div>
          </div>
          
          <div class="login-options">
            <button @click=${this.initiateLogin} class="login-btn" ?disabled=${!this.isConfigured}>
              <svg class="login-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 9H14V4H5V21H19V9Z" fill="currentColor"/>
              </svg>
              ${this.isConfigured ? 'Sign in with DIMO' : 'Configure App First'}
            </button>
          </div>
          
          <!-- Clear Configuration Section -->
          ${this.isConfigured ? html`
            <div class="config-actions">
              <button @click=${this.showClearConfiguration} class="clear-btn">
                <svg class="clear-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
                </svg>
                Clear Configuration
              </button>
            </div>
          ` : ''}
          
          <!-- Clear Confirmation Dialog -->
          ${this.showClearConfirm ? html`
            <div class="clear-confirm">
              <div class="confirm-content">
                <h3>Clear Configuration?</h3>
                <p>This will remove your DIMO API credentials. You'll need to reconfigure the app to use it again.</p>
                <div class="confirm-buttons">
                  <button @click=${this.clearConfiguration} class="confirm-btn confirm-yes">
                    Yes, Clear
                  </button>
                  <button @click=${this.cancelClearConfiguration} class="confirm-btn confirm-no">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ` : ''}
          
          <div class="help-text">
            <p>${this.isConfigured ? 'You\'ll be redirected to DIMO\'s secure login page' : 'Please configure the app with your DIMO credentials first'}</p>
          </div>
        </div>
      </div>
    `
  }

  static get styles() {
    return css`
      .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      .login-card {
        background: white;
        padding: 3rem;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        width: 100%;
        max-width: 400px;
        text-align: center;
      }

      h2 {
        color: #2c3e50;
        margin-bottom: 0.5rem;
        font-size: 2rem;
        font-weight: 600;
      }

      .subtitle {
        color: #6c757d;
        margin-bottom: 2rem;
        font-size: 0.95rem;
      }

      .login-options {
        margin-bottom: 2rem;
      }

      .login-btn {
        width: 100%;
        padding: 1rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .login-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
      }

      .login-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .login-icon {
        width: 20px;
        height: 20px;
      }

      .config-status {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e9ecef;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        font-weight: 500;
      }

      .status-indicator.configured {
        color: #28a745;
      }

      .status-indicator.not-configured {
        color: #dc3545;
      }

      .status-icon {
        width: 16px;
        height: 16px;
      }

      .config-actions {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e9ecef;
      }

      .clear-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.9rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: background-color 0.2s;
        margin: 0 auto;
      }

      .clear-btn:hover {
        background: #c82333;
      }

      .clear-icon {
        width: 16px;
        height: 16px;
      }

      .clear-confirm {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .confirm-content {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        width: 90%;
        text-align: center;
      }

      .confirm-content h3 {
        margin: 0 0 1rem 0;
        color: #2c3e50;
        font-size: 1.25rem;
      }

      .confirm-content p {
        margin: 0 0 1.5rem 0;
        color: #6c757d;
        line-height: 1.5;
      }

      .confirm-buttons {
        display: flex;
        gap: 1rem;
        justify-content: center;
      }

      .confirm-btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .confirm-yes {
        background: #dc3545;
        color: white;
      }

      .confirm-yes:hover {
        background: #c82333;
      }

      .confirm-no {
        background: #6c757d;
        color: white;
      }

      .confirm-no:hover {
        background: #5a6268;
      }

      .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        border: 1px solid #f5c6cb;
      }

      .help-text {
        margin-top: 1.5rem;
      }

      .help-text p {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
      }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(102, 126, 234, 0.3);
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      @media (prefers-color-scheme: dark) {
        .login-card {
          background: #2c3e50;
          color: #e9ecef;
        }

        h2 {
          color: #e9ecef;
        }

        .subtitle {
          color: #adb5bd;
        }

        .config-status {
          background: #343a40;
          border-color: #495057;
        }

        .status-indicator.configured {
          color: #28a745;
        }

        .status-indicator.not-configured {
          color: #dc3545;
        }

        .config-actions {
          border-top-color: #495057;
        }

        .confirm-content {
          background: #2c3e50;
          color: #e9ecef;
        }

        .confirm-content h3 {
          color: #e9ecef;
        }

        .confirm-content p {
          color: #adb5bd;
        }

        .help-text p {
          color: #adb5bd;
        }

        .error {
          background-color: #721c24;
          color: #f8d7da;
          border-color: #f5c6cb;
        }
      }
    `
  }
}

window.customElements.define('login-element', LoginElement)
