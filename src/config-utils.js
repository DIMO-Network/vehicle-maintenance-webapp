/**
 * Shared Configuration Utilities
 * Provides consistent configuration checking logic across components
 */

import { DimoApiService } from './dimo-api-service.js'

export class ConfigUtils {
  static dimoApiService = new DimoApiService()

  /**
   * Check if the app is properly configured
   * @returns {Promise<{isConfigured: boolean, config: Object|null, error: string|null}>}
   */
  static async checkAppConfiguration() {
    try {
      const config = await this.dimoApiService.getConfig()
      
      // Check if config exists and has required fields
      const isConfigured = config && 
                          config.clientId && 
                          config.apiKey && 
                          config.clientId.trim() !== '' && 
                          config.apiKey.trim() !== ''
      
      return {
        isConfigured,
        config: isConfigured ? config : null,
        error: null
      }
    } catch (error) {
      console.error('Failed to check configuration status:', error)
      return {
        isConfigured: false,
        config: null,
        error: error.message
      }
    }
  }
}
