/**
 * DIMO API Service - Backend API calls
 * Calls our Express.js backend which handles DIMO SDK integration
 */

import { ApiConfig } from './api-config.js'

export class DimoApiService {
  constructor() {
    this.baseUrl = ApiConfig.getBaseUrl()
    console.log('DimoApiService initialized with baseUrl:', this.baseUrl)
  }

  /**
   * Get Developer JWT token
   * @param {Object} credentials - DIMO credentials
   * @param {string} credentials.clientId - DIMO Client ID
   * @param {string} credentials.domain - Redirect URI domain
   * @param {string} credentials.privateKey - DIMO API Key
   * @returns {Promise<Object>} JWT response
   */
  async getDeveloperJwt(credentials) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/developer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in
      }
    } catch (error) {
      console.error('Failed to get Developer JWT:', error)
      throw new Error(`Failed to authenticate with DIMO: ${error.message}`)
    }
  }

  /**
   * Get Vehicle JWT token
   * @param {Object} params - Parameters for vehicle JWT
   * @param {string} params.access_token - Developer JWT token
   * @param {string} params.tokenId - Vehicle token ID
   * @returns {Promise<Object>} Vehicle JWT response
   */
  async getVehicleJwt(params) {
    try {
      const response = await fetch(`${this.baseUrl}/auth/vehicle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId: params.tokenId,
          developerJwt: params.access_token,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return {
        token: data.token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in
      }
    } catch (error) {
      console.error(`Failed to get Vehicle JWT for token ${params.tokenId}:`, error)
      throw new Error(`Failed to get vehicle access for token ${params.tokenId}: ${error.message}`)
    }
  }

  /**
   * Query vehicle telemetry data
   * @param {Object} params - Query parameters
   * @param {string} params.token - Vehicle JWT token
   * @param {string} params.query - GraphQL query
   * @param {Object} params.variables - GraphQL variables
   * @returns {Promise<Object>} Query response
   */
  async queryTelemetry(params) {
    try {
      const response = await fetch(`${this.baseUrl}/telemetry/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.token}`,
        },
        body: JSON.stringify({
          query: params.query,
          variables: params.variables || {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to query telemetry:', error)
      throw new Error(`Failed to query vehicle data: ${error.message}`)
    }
  }

  /**
   * Check if JWT token is valid and not expired
   * @param {string} jwt - JWT token to validate
   * @returns {boolean} True if token is valid
   */
  isJwtValid(jwt) {
    if (!jwt) return false
    
    try {
      // Decode JWT payload to check expiration
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp && payload.exp > now
    } catch (error) {
      console.error('Error validating JWT:', error)
      return false
    }
  }

  /**
   * Get JWT expiration time
   * @param {string} jwt - JWT token
   * @returns {number|null} Expiration timestamp or null if invalid
   */
  getJwtExpiration(jwt) {
    if (!jwt) return null
    
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]))
      return payload.exp ? payload.exp * 1000 : null // Convert to milliseconds
    } catch (error) {
      console.error('Error getting JWT expiration:', error)
      return null
    }
  }

  /**
   * Get app configuration
   * @returns {Promise<Object>} Configuration object
   */
  async getConfig() {
    try {
      const response = await fetch(`${this.baseUrl}/config`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null // No configuration found
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get configuration:', error)
      throw new Error(`Failed to get configuration: ${error.message}`)
    }
  }

  /**
   * Save app configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<Object>} Saved configuration
   */
  async saveConfig(config) {
    try {
      const response = await fetch(`${this.baseUrl}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to save configuration:', error)
      throw new Error(`Failed to save configuration: ${error.message}`)
    }
  }

  /**
   * Delete app configuration
   * @returns {Promise<Object>} Deletion result
   */
  async deleteConfig() {
    try {
      const response = await fetch(`${this.baseUrl}/config`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to delete configuration:', error)
      throw new Error(`Failed to delete configuration: ${error.message}`)
    }
  }

  /**
   * Generate vehicle report
   * @param {Object} params - Report parameters
   * @param {Array} params.vehicleTokenIds - Array of vehicle token IDs
   * @param {string} params.startDate - Start date (YYYY-MM-DD)
   * @param {string} params.endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} Report generation result
   */
  async generateReport(params) {
    try {
      const response = await fetch(`${this.baseUrl}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to generate report:', error)
      throw new Error(`Failed to generate report: ${error.message}`)
    }
  }

  /**
   * Download report file
   * @param {string} filename - Report filename
   * @returns {Promise<Blob>} Report file blob
   */
  async downloadReport(filename) {
    try {
      const response = await fetch(`${this.baseUrl}/reports/download/${filename}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Failed to download report:', error)
      throw new Error(`Failed to download report: ${error.message}`)
    }
  }

  /**
   * Get vehicle details info using DIMO telemetry API
   * @param {string} tokenId - Vehicle token ID
   * @returns {Promise<Object>} Vehicle details with telemetry data
   */
  async getVehicleDetailsInfo(tokenId) {
    try {
      const response = await fetch(`${this.baseUrl}/vehicle-details-info/${tokenId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to get vehicle details info:', error)
      throw new Error(`Failed to get vehicle details info: ${error.message}`)
    }
  }

  /**
   * Extract maintenance information from uploaded document
   * @param {File} document - The document file to process
   * @returns {Promise<Object>} Extracted maintenance information
   */
  async extractMaintenanceInfo(document, tokenId, vehicleJwt) {
    try {
      const formData = new FormData()
      formData.append('document', document)
      if (tokenId != null) {
        formData.append('tokenId', String(tokenId))
      }

      const response = await fetch(`${this.baseUrl}/ai/extract-maintenance`, {
        method: 'POST',
        body: formData,
        headers: vehicleJwt ? { 'Authorization': `Bearer ${vehicleJwt}` } : undefined
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Maintenance extraction successful:', data)
      return data
    } catch (error) {
      console.error('Failed to extract maintenance info:', error)
      throw new Error(`Failed to extract maintenance info: ${error.message}`)
    }
  }

  /**
   * Get maintenance records from backend DB for a vehicle token
   * @param {number|string} tokenId
   * @param {string} vehicleJwt - vehicle JWT for auth
   */
  async getMaintenanceRecords(tokenId, vehicleJwt) {
    try {
      console.log('Getting maintenance records for token:', tokenId)
      const response = await fetch(`${this.baseUrl}/maintenance/${tokenId}`, {
        headers: {
          'Authorization': `Bearer ${vehicleJwt}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to get maintenance records:', error)
      throw new Error(`Failed to get maintenance records: ${error.message}`)
    }
  }
}

// Create a singleton instance
export const dimoApiService = new DimoApiService()
