// Import URLPattern polyfill before any other modules
import 'urlpattern-polyfill'
import { LitElement, css, html } from 'lit'
import { Router } from '@lit-labs/router'
import { storageService } from './storage-service.js'
import { ConfigUtils } from './config-utils.js'

/**
 * Odometer Reporting Tool main component
 */
export class MyElement extends LitElement {
  static get properties() {
    return {
      isConfigured: { type: Boolean },
      isAuthenticated: { type: Boolean },
      isLoading: { type: Boolean },
      authStatus: { type: Object },
      clientId: { type: String }
    }
  }

  constructor() {
    super()
    this.isConfigured = false
    this.isAuthenticated = false
    this.isLoading = true
    this.authStatus = {}
    this.clientId = ''
    
    // Initialize the router
    this.router = new Router(this, [
      {
        path: '/',
        render: () => this.renderConfig()
      },
      {
        path: '/config',
        render: () => this.renderConfig()
      },
      {
        path: '/login',
        render: () => this.renderLogin()
      },
      {
        path: '/vehicles',
        render: () => this.renderVehicles()
      },
      {
        path: '/vehicles/:tokenId',
        render: ({ tokenId }) => this.renderVehicleDetails(tokenId)
      }
    ])
  }

  connectedCallback() {
    super.connectedCallback()
    
    // Add router as a controller
    this.addController(this.router)
    
    // Load client ID from backend config
    this.loadClientId()
    
    // Listen for configuration success events
    this.addEventListener('config-success', this._handleConfigSuccess)
    // Listen for login success events
    this.addEventListener('login-success', this._handleLoginSuccess)
    
    // Set initial state and navigate to appropriate route
    this.updateAppState()
    
    // Use setTimeout to ensure router is fully connected before navigation
    setTimeout(() => {
    //  this.navigateToCurrentRoute()
    }, 0)
  }

  async loadClientId() {
    try {
      const { config } = await ConfigUtils.checkAppConfiguration()
      if (config && config.clientId) {
        this.clientId = config.clientId
      }
    } catch (error) {
      console.error('Failed to load client ID:', error)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener('config-success', this._handleConfigSuccess)
    this.removeEventListener('login-success', this._handleLoginSuccess)
  }

  updateAppState() {
    const state = storageService.getAppState()
    this.isAuthenticated = state.isAuthenticated
    this.authStatus = state
    this.isLoading = false
  }

  async navigateToCurrentRoute() {
    let targetRoute = '/'
    
    // Check configuration status from backend
    const { isConfigured } = await ConfigUtils.checkAppConfiguration()
    
    if (!isConfigured) {
      targetRoute = '/config'
    } else if (!this.isAuthenticated) {
      targetRoute = '/login'
    } else {
      targetRoute = '/vehicles'
    }
    
    // Use both router.goto and history.pushState to ensure URL updates
    this.router.goto(targetRoute)
    if (window.location.pathname !== targetRoute) {
      window.history.pushState({}, '', targetRoute)
    }
  }

  _handleConfigSuccess() {
    this.updateAppState()
    this.router.goto('/login')
  }

  _handleLoginSuccess() {
    console.log('Login success event received, redirecting to vehicles page')
    this.updateAppState()
    this.router.goto('/vehicles')
  }

  _handleLogout() {
    // Clear user session but keep app configuration
    storageService.clearUserSession()
    this.updateAppState()
    this.router.goto('/login')
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading...</p>
        </div>
      `
    }

    // The router will render into this outlet
    return html`${this.router.outlet()}`
  }

  renderConfig() {
    return html`<app-configuration></app-configuration>`
  }

  renderLogin() {
    return html`<login-element></login-element>`
  }

  renderVehicles() {
    return html`
      <div class="app-container">
        <header class="app-header">
          <h1>Vehicle Maintenance & Ownership Cost</h1>
          <div class="user-info">
            <button @click=${this._handleLogout} class="logout-btn">Logout</button>
          </div>
        </header>
        
        <main class="app-main">
          <vehicles-page></vehicles-page>
        </main>
      </div>
    `
  }

  renderVehicleDetails(tokenId) {
    return html`
      <div class="app-container">
        <header class="app-header">
          <h1>Vehicle Details</h1>
          <div class="user-info">
            <button @click=${() => this.router.goto('/vehicles')} class="back-btn">Back to Vehicles</button>
            <button @click=${this._handleLogout} class="logout-btn">Logout</button>
          </div>
        </header>
        
        <main class="app-main">
          <vehicle-details-page .tokenId=${tokenId}></vehicle-details-page>
        </main>
      </div>
    `
  }

  static get styles() {
    return css`
      :host {
        display: block;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .loading {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-top: 4px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .app-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .app-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }

      .app-header h1 {
        margin: 0;
        font-size: 1.8rem;
        font-weight: 600;
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .client-id {
        font-size: 0.9rem;
        opacity: 0.9;
        font-family: monospace;
      }

      .back-btn,
      .logout-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: background-color 0.2s;
      }

      .back-btn:hover,
      .logout-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .app-main {
        flex: 1;
        padding: 2rem;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
      }

      .welcome {
        text-align: center;
        padding: 3rem 2rem;
        background-color: #f8f9fa;
        border-radius: 12px;
        border: 1px solid #e9ecef;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      }

      .welcome p {
        font-size: 1.2em;
        color: #495057;
        margin: 0.5rem 0;
      }

      .welcome p:first-child {
        font-weight: 600;
        color: #2c3e50;
        font-size: 1.5em;
        margin-bottom: 1rem;
      }

      .status-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 1.5rem;
        padding: 0.75rem 1.5rem;
        background-color: #d4edda;
        color: #155724;
        border-radius: 6px;
        border: 1px solid #c3e6cb;
        font-weight: 500;
      }

      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }

      .status-dot.valid {
        background-color: #28a745;
      }

      @media (prefers-color-scheme: dark) {
        .welcome {
          background-color: #343a40;
          border-color: #495057;
        }

        .welcome p {
          color: #e9ecef;
        }

        .welcome p:first-child {
          color: #ffffff;
        }

        .status-indicator {
          background-color: #1e7e34;
          color: #d4edda;
          border-color: #28a745;
        }
      }

      @media (max-width: 768px) {
        .app-header {
          flex-direction: column;
          gap: 1rem;
          text-align: center;
        }

        .app-main {
          padding: 1rem;
        }

        .welcome {
          padding: 2rem 1rem;
        }
      }
    `
  }
}

window.customElements.define('my-element', MyElement)
