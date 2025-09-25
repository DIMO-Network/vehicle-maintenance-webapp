import OpenAI from 'openai'
import fs from 'fs/promises'
import fsSync from 'fs'

/**
 * OpenAI API Service for ChatGPT integration
 */
export class OpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.client = this.apiKey ? new OpenAI({
      apiKey: this.apiKey
    }) : null
  }

  /**
   * Process an image with a prompt using OpenAI's vision model
   * @param {string} imagePath - Path to the image file
   * @param {string} prompt - The prompt to send with the image
   * @param {string} model - The model to use (default: 'gpt-4o')
   * @returns {Promise<Object>} OpenAI response
   */
  async processImageWithPromptAndModel(imagePath, prompt, model = 'gpt-4o') {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
        }
      }

      // Read the image file
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
      
      // Determine the image type
      const imageType = this.getImageType(imagePath)
      
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })

      return {
        success: true,
        content: response.choices[0].message.content,
        usage: response.usage
      }
    } catch (error) {
      console.error('OpenAI image processing error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Process a PDF document with a prompt using OpenAI's Responses API with file upload
   * @param {string} pdfPath - Path to the PDF file
   * @param {string} prompt - The prompt to send with the PDF
   * @param {string} model - The model to use (default: 'gpt-4o')
   * @returns {Promise<Object>} OpenAI response
   */
  async processPDFWithPromptAndModel(pdfPath, prompt, model = 'gpt-4o') {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
        }
      }

      // Upload the PDF to OpenAI Files API
      const uploaded = await this.client.files.create({
        file: fsSync.createReadStream(pdfPath),
        purpose: 'assistants'
      })

      // Create a response referencing the uploaded file
      const response = await this.client.responses.create({
        model: model,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_file', file_id: uploaded.id }
            ]
          }
        ]
      })

      return {
        success: true,
        content: response, // return full response; frontend logs it
        usage: response.usage || null
      }
    } catch (error) {
      console.error('OpenAI PDF processing error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Send a text prompt to OpenAI without any images
   * @param {string} prompt - The text prompt
   * @param {string} model - The model to use (default: 'gpt-3.5-turbo')
   * @param {number} maxTokens - Maximum tokens to generate (default: 1000)
   * @returns {Promise<Object>} OpenAI response
   */
  async processPrompt(prompt, model = 'gpt-3.5-turbo', maxTokens = 1000) {
    try {
      if (!this.client) {
        return {
          success: false,
          error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
        }
      }

      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      })

      return {
        success: true,
        content: response.choices[0].message.content,
        usage: response.usage
      }
    } catch (error) {
      console.error('OpenAI prompt processing error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get the MIME type for an image file based on its extension
   * @param {string} filePath - Path to the image file
   * @returns {string} MIME type
   */
  getImageType(filePath) {
    const extension = filePath.toLowerCase().split('.').pop()
    const imageTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'bmp': 'image/bmp'
    }
    return imageTypes[extension] || 'image/jpeg'
  }

  /**
   * Extract maintenance information from a service document
   * @param {string} documentPath - Path to the document (PDF or image)
   * @returns {Promise<Object>} Extracted maintenance information
   */
  async extractMaintenanceInfo(documentPath) {
    const prompt = `Please analyze this vehicle maintenance service document and extract the following information in JSON format:
    {
      "date": "service date",
      "serviceType": "type of service performed",
      "description": "detailed description of work done",
      "parts": ["list of parts replaced"],
      "labor": "labor cost",
      "partsCost": "parts cost",
      "totalCost": "total cost",
      "mileage": "vehicle mileage at time of service",
      "nextService": "recommended next service",
      "notes": "any additional notes"
    }
    
    If any information is not available, use null for that field.`
    
    const isPDF = documentPath.toLowerCase().endsWith('.pdf')
    
    if (isPDF) {
      return await this.processPDFWithPromptAndModel(documentPath, prompt)
    } else {
      return await this.processImageWithPromptAndModel(documentPath, prompt)
    }
  }

  /**
   * Generate upcoming services for the next 60k miles
   * @param {Object} params
   * @param {number} params.currentMileage - current vehicle mileage
   * @param {Array} params.history - maintenance history items with {serviceDate, description, totalCost}
   * @param {number} params.horizonMiles - how many miles ahead (default 60000)
   * @returns {Promise<Object>} Structured JSON with upcoming services
   */
  async generateUpcomingServices({ currentMileage, history, horizonMiles = 60000, make, model, year }) {
    const vehicleLine = make && model && year ? `${year} ${make} ${model}` : 'Unknown Vehicle'
    const prompt = `You are a professional auto service advisor. Using the vehicle info, maintenance history, and current mileage, propose a practical maintenance schedule for the next ${horizonMiles.toLocaleString()} miles.
    
    Provide JSON only in this exact structure:
    {
      "plan": [
        { "mileage": number, "services": [string, ...], "estimatedCost": number }
      ]
    }
    
    Rules:
    - mileage should be thresholds ahead of current mileage (e.g., every 5k/10k/15k miles as appropriate)
    - estimatedCost is a reasonable numeric estimate in USD (no symbols)
    - Use history context to avoid repeating very recent services unnecessarily. The history includes mileage when service was performed, so take that into account.
    - Limit plan to 6-12 entries across the horizon
    
    Vehicle: ${vehicleLine}
    CurrentMileage: ${Math.round(currentMileage)}
    History (most recent first):
    ${Array.isArray(history) && history.length ? history.slice(0, 20).map(h => `- Service Date: ${h.serviceDate || 'unknown'}. Mileage: ${h.mileage || 'unknown'}. Description: ${h.description || 'service'}. Total Cost: ($${h.totalCost ?? 'n/a'})`).join('\n') : 'No history'}
    `

    // Use a capable model for structured output
    const response = await this.processPrompt(prompt, 'gpt-4o-mini', 1200)
    if (!response.success) return response

    // Try to parse JSON from the response content
    const raw = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
    const cleaned = raw.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')

    let parsed = null
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch {}
      }
    }

    if (!parsed || !Array.isArray(parsed.plan)) {
      return { success: false, error: 'Failed to parse upcoming services JSON', content: response.content }
    }

    return { success: true, content: parsed }
  }
}

// Factory function to create OpenAIService instance
export function createOpenAIService(apiKey) {
  return new OpenAIService(apiKey)
}
