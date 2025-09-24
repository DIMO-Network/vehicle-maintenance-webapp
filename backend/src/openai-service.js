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
   * Generate maintenance recommendations based on vehicle data
   * @param {Object} vehicleData - Vehicle information and history
   * @returns {Promise<Object>} Maintenance recommendations
   */
  async generateMaintenanceRecommendations(vehicleData) {
    const prompt = `Based on the following vehicle information, provide maintenance recommendations:
    
    Vehicle: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}
    Current Mileage: ${vehicleData.odometerReading} miles
    Vehicle Age: ${vehicleData.age} years
    
    Recent Maintenance History:
    ${vehicleData.maintenanceHistory ? vehicleData.maintenanceHistory.map(service => 
      `- ${service.date}: ${service.service} ($${service.amount})`
    ).join('\n') : 'No maintenance history available'}
    
    Please provide:
    1. Immediate maintenance needs (if any)
    2. Upcoming maintenance recommendations
    3. Cost estimates for recommended services
    4. Priority levels for each recommendation
    
    Format the response as a structured JSON object.`
    
    return await this.processPrompt(prompt, 'gpt-4', 1500)
  }
}

// Factory function to create OpenAIService instance
export function createOpenAIService(apiKey) {
  return new OpenAIService(apiKey)
}
