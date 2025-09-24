import { LitElement, css, html } from 'lit'
import { dimoApiService } from './dimo-api-service.js'
import { ConfigUtils } from './config-utils.js'

/**
 * App Configuration component for DIMO credentials
 */
export class AppConfigurationComponent extends LitElement {
  static get properties() {
    return {
      clientId: { type: String },
      apiKey: { type: String },
      isLoading: { type: Boolean },
      error: { type: String },
      success: { type: String }
    }
  }

  constructor() {
    super()
    this.clientId = ''
    this.apiKey = ''
    this.isLoading = false
    this.error = ''
    this.success = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this.checkExistingConfiguration()
  }

  async checkExistingConfiguration() {
    this.isLoading = true
    
    const { isConfigured, config, error } = await ConfigUtils.checkAppConfiguration()
    
    if (isConfigured) {
      console.log('App is already configured, redirecting to login...')
      window.location.href = '/login'
      return
    }
    
    // App is not configured, show the configuration form
    this.isLoading = false
  }

  render() {
    // Show loading state while checking configuration
    if (this.isLoading) {
      return html`
        <div class="login-container">
          <div class="login-card">
            <div class="loading">
              <div class="spinner"></div>
              <p>Checking configuration...</p>
            </div>
          </div>
        </div>
      `
    }

    return html`
      <div class="login-container">
        <div class="login-card">
          <h2>App Configuration</h2>
          <p class="subtitle">Please configure your application before proceeding</p>
          <p class="config-text">Enter your DIMO credentials to configure the Odometer Reporting Tool</p>
          
          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          ${this.success ? html`<div class="success">${this.success}</div>` : ''}
          
          <form @submit=${this._handleSubmit}>
            <div class="form-group">
              <label for="clientId">DIMO Client ID</label>
              <input
                type="text"
                id="clientId"
                .value=${this.clientId}
                @input=${this._handleClientIdChange}
                placeholder="0x8CFd006E6B73dbF00e700C85c32CE5C9aBD591a0"
                required
                ?disabled=${this.isLoading}
              />
            </div>
            
            <div class="form-group">
              <label for="apiKey">DIMO API Key</label>
              <input
                type="password"
                id="apiKey"
                .value=${this.apiKey}
                @input=${this._handleApiKeyChange}
                placeholder="Enter your DIMO API Key"
                required
                ?disabled=${this.isLoading}
              />
            </div>
            
            <button type="submit" ?disabled=${this.isLoading}>
              ${this.isLoading ? 'Configuring...' : 'Configure App'}
            </button>
          </form>
          
          <div class="help-text">
            <p style="font-weight: bold;">You'll need to create a Redirect URI in your DIMO Console with the following value:</p>
            <p><code>${window.location.origin + '/login'}</code></p>
            <p>Get your credentials from <a href="https://console.dimo.org" target="_blank">console.dimo.org</a></p>
          </div>
        </div>
      </div>
    `
  }

  _handleClientIdChange(e) {
    this.clientId = e.target.value
  }

  _handleApiKeyChange(e) {
    this.apiKey = e.target.value
  }

  async _handleSubmit(e) {
    e.preventDefault()
    this.isLoading = true
    this.error = ''

    try {
      // Store credentials using backend API
      const result = await dimoApiService.saveConfig({
        clientId: this.clientId,
        apiKey: this.apiKey,
        redirectUri: window.location.origin + '/login'
      })

      console.log('App configuration saved successfully:', result)

      // Dispatch configuration success event
      this.dispatchEvent(new CustomEvent('config-success', {
        detail: { clientId: this.clientId },
        bubbles: true
      }))

      console.log('Config success event dispatched')
      
      // Show success message
      this.success = 'Configuration saved successfully! Redirecting to login...'
      this.error = '' // Clear any previous errors
      
      // Redirect to login page after successful configuration
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000) // Give user time to see the success message

    } catch (error) {
      console.error('Configuration failed:', error)
      this.error = error.message || 'Configuration failed. Please check your credentials.'
    } finally {
      this.isLoading = false
    }
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
      }

      h2 {
        text-align: center;
        color: #2c3e50;
        margin-bottom: 0.5rem;
        font-size: 2rem;
      }

      .subtitle {
        text-align: center;
        color: #6c757d;
        margin-bottom: 1rem;
        font-size: 0.95rem;
        font-weight: 500;
      }

      .config-text {
        text-align: center;
        color: #6c757d;
        margin-bottom: 2rem;
        font-size: 0.9rem;
      }

      .form-group {
        margin-bottom: 1.5rem;
      }

      label {
        display: block;
        margin-bottom: 0.5rem;
        color: #495057;
        font-weight: 500;
      }

      input {
        width: 100%;
        padding: 0.75rem;
        border: 2px solid #e9ecef;
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      input:focus {
        outline: none;
        border-color: #667eea;
      }

      input:disabled {
        background-color: #f8f9fa;
        cursor: not-allowed;
      }

      button {
        width: 100%;
        padding: 0.75rem;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      .error {
        background-color: #f8d7da;
        color: #721c24;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        border: 1px solid #f5c6cb;
      }

      .success {
        background-color: #d4edda;
        color: #155724;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        border: 1px solid #c3e6cb;
      }

      .help-text {
        margin-top: 1.5rem;
        text-align: center;
      }

      .help-text p {
        color: #6c757d;
        font-size: 0.9rem;
        margin: 0;
      }

      .help-text a {
        color: #667eea;
        text-decoration: none;
      }

      .help-text a:hover {
        text-decoration: underline;
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

        .config-text {
          color: #adb5bd;
        }

        label {
          color: #e9ecef;
        }

        input {
          background-color: #495057;
          border-color: #6c757d;
          color: #e9ecef;
        }

        input:focus {
          border-color: #667eea;
        }

        input:disabled {
          background-color: #343a40;
        }

        .error {
          background-color: #721c24;
          color: #f8d7da;
          border-color: #f5c6cb;
        }

        .success {
          background-color: #155724;
          color: #d4edda;
          border-color: #c3e6cb;
        }

        .help-text p {
          color: #adb5bd;
        }
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
    `
  }
}

window.customElements.define('app-configuration', AppConfigurationComponent)
