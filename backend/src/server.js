import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { DIMO } from '@dimo-network/data-sdk'
import fs from 'fs/promises'
import { createObjectCsvWriter } from 'csv-writer'
import https from 'https'
import multer from 'multer'
import { createOpenAIService } from './openai-service.js'
import pkg from 'pg'
const { Pool } = pkg
import { runMigrations } from './migrations.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env file
dotenv.config({ path: path.join(path.dirname(__dirname), '.env') })

// Check for required environment variables
const requiredEnvVars = ['DIMO_CLIENT_ID', 'DIMO_API_KEY', 'DIMO_REDIRECT_URI']
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.warn('⚠️  Missing required environment variables:', missingEnvVars.join(', '))
  console.warn('📝 Please create a .env file in the backend directory using env.template as a guide')
}

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set - AI features will be disabled')
  console.warn('📝 Add OPENAI_API_KEY to your .env file to enable AI features')
}

// Create OpenAI service instance with API key
const openaiService = createOpenAIService(process.env.OPENAI_API_KEY)

const app = express()
const PORT = process.env.PORT || 3001
const HTTPS_PORT = process.env.HTTPS_PORT || 3443
const USE_HTTPS = process.env.USE_HTTPS !== 'false' // Default to true for development

// Middleware
app.use(cors({
  origin: ['https://localhost:5173', 'https://localhost:3443', 'http://localhost:3001'],
  credentials: true
}))
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../dist')))

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../tmp/uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF and image files
    const allowedTypes = /pdf|jpeg|jpg|png|gif|webp|bmp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only PDF and image files are allowed'))
    }
  }
})

// Ensure tmp directory exists
const tmpDir = path.join(__dirname, '../tmp')

// Initialize DIMO SDK
const dimo = new DIMO('Production')

// Initialize server
async function initializeServer() {
  await fs.mkdir(tmpDir, { recursive: true })
  await fs.mkdir(path.join(tmpDir, 'uploads'), { recursive: true })
}

// ---- Postgres setup - defaults to localhost:5432 ----
const pgConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'dimo',
  password: process.env.PGPASSWORD || 'dimo',
  database: process.env.PGDATABASE || 'vehicle_maintenance',
}
const pool = new Pool(pgConfig)

// migrations moved to src/migrations.js

// File storage utilities
class FileStorage {
  constructor(baseDir) {
    this.baseDir = baseDir
  }

  async saveConfig(config) {
    const configPath = path.join(this.baseDir, 'app-config.json')
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    return configPath
  }

  async loadConfig() {
    try {
      const configPath = path.join(this.baseDir, 'app-config.json')
      const data = await fs.readFile(configPath, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      return null
    }
  }

  async saveReport(reportData, filename) {
    const reportPath = path.join(this.baseDir, filename)
    await fs.writeFile(reportPath, reportData)
    return reportPath
  }

  async listReports() {
    try {
      const files = await fs.readdir(this.baseDir)
      return files.filter(file => file.endsWith('.csv'))
    } catch (error) {
      return []
    }
  }
}

const storage = new FileStorage(tmpDir)

// API Routes

// Get app configuration
app.get('/api/config', async (req, res) => {
  try {
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(404).json({ error: 'No configuration found' })
    }
    res.json(config)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' })
  }
})

// Save app configuration
app.post('/api/config', async (req, res) => {
  try {
    const { clientId, apiKey, redirectUri } = req.body
    
    if (!clientId || !apiKey) {
      return res.status(400).json({ error: 'Client ID and API Key are required' })
    }

    const config = {
      clientId,
      apiKey,
      redirectUri: redirectUri || 'http://localhost:5173',
      createdAt: new Date().toISOString()
    }

    await storage.saveConfig(config)
    res.json({ message: 'Configuration saved successfully', config })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save configuration' })
  }
})

// Delete app configuration
app.delete('/api/config', async (req, res) => {
  try {
    const configPath = path.join(tmpDir, 'app-config.json')
    
    // Check if config file exists
    try {
      await fs.access(configPath)
    } catch (error) {
      return res.status(404).json({ error: 'No configuration found' })
    }

    // Delete the config file
    await fs.unlink(configPath)
    res.json({ message: 'Configuration deleted successfully' })
  } catch (error) {
    console.error('Failed to delete configuration:', error)
    res.status(500).json({ error: 'Failed to delete configuration' })
  }
})

// Get developer JWT
app.post('/api/auth/developer', async (req, res) => {
  try {
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(400).json({ error: 'No configuration found. Please configure the app first.' })
    }

    const developerJwt = await dimo.auth.getToken({
      client_id: config.clientId,
      domain: config.redirectUri,
      private_key: config.apiKey,
    })

    res.json(developerJwt)
  } catch (error) {
    console.error('Failed to get developer JWT:', error)
    res.status(500).json({ error: 'Failed to authenticate with DIMO. Please check your credentials.' })
  }
})

// Get vehicle JWT
app.post('/api/auth/vehicle', async (req, res) => {
  try {
    const { tokenId, developerJwt } = req.body
    
    if (!tokenId || !developerJwt) {
      return res.status(400).json({ error: 'Token ID and Developer JWT are required' })
    }

    const vehicleJwt = await dimo.tokenexchange.getVehicleJwt({
      ...developerJwt,
      tokenId: parseInt(tokenId)
    })

    res.json(vehicleJwt)
  } catch (error) {
    console.error(`Failed to get vehicle JWT for token ${req.body.tokenId}:`, error)
    res.status(500).json({ error: `Failed to get vehicle access for token ${req.body.tokenId}` })
  }
})

// Get vehicle details info using DIMO telemetry API
app.get('/api/vehicle-details-info/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params
    
    if (!tokenId) {
      return res.status(400).json({ error: 'Token ID is required' })
    }

    // Load configuration
    const config = await storage.loadConfig()
    if (!config) {
      return res.status(400).json({ error: 'No configuration found. Please configure the app first.' })
    }

    // Get developer JWT
    const developerJwt = await dimo.auth.getDeveloperJwt({
      client_id: config.clientId,
      domain: config.redirectUri,
      private_key: config.apiKey,
    })

    // Get vehicle JWT
    const vehicleJwt = await dimo.tokenexchange.exchange({
      ...developerJwt,
      privileges: [1],
      tokenId: parseInt(tokenId)
    })

    // Set date range for telemetry query (last 24 hours)
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 4*8760 * 60 * 60 * 1000) // 4 years ago
    
    const startDateISO = startDate.toISOString().split('T')[0]
    const endDateISO = endDate.toISOString().split('T')[0]

    // Query telemetry data
    const telemetryQuery = `
      {
        vinVCLatest(tokenId: ${tokenId}) {
          vin
        }
        signals(tokenId: ${tokenId}, interval: "8760h", from: "${startDateISO}T00:00:00Z", to: "${endDateISO}T23:59:59Z") {
          powertrainTransmissionTravelledDistance (agg: MAX)
          timestamp
        }
      }
    `

    const telemetryResult = await dimo.telemetry.query({
      ...vehicleJwt,
      query: telemetryQuery
    })

    res.json({
      tokenId: parseInt(tokenId),
      dateRange: {
        start: startDateISO,
        end: endDateISO
      },
      telemetry: telemetryResult
    })

  } catch (error) {
    console.error(`Failed to get vehicle details for token ${req.params.tokenId}:`, error)
    res.status(500).json({ 
      error: `Failed to get vehicle details for token ${req.params.tokenId}`,
      details: error.message 
    })
  }
})

// AI Endpoints

// Process image with prompt
app.post('/api/ai/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const { prompt, model } = req.body
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const result = await openaiService.processImageWithPromptAndModel(
      req.file.path,
      prompt,
      model
    )

    // Clean up uploaded file
    await fs.unlink(req.file.path)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('Image processing error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Process PDF with prompt
app.post('/api/ai/process-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' })
    }

    const { prompt, model } = req.body
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const result = await openaiService.processPDFWithPromptAndModel(
      req.file.path,
      prompt,
      model
    )

    // Clean up uploaded file
    await fs.unlink(req.file.path)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('PDF processing error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Extract maintenance information from document
app.post('/api/ai/extract-maintenance', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' })
    }

    const result = await openaiService.extractMaintenanceInfo(req.file.path)

    // Clean up uploaded file
    await fs.unlink(req.file.path)

    if (!result.success) {
      return res.status(500).json(result)
    }

    // Extract the model output text and parse JSON from it
    const ai = result.content
    let outputText = ''
    if (ai && typeof ai === 'object' && 'output_text' in ai) {
      outputText = ai.output_text || ''
    } else if (ai?.choices?.[0]?.message?.content) {
      // chat.completions fallback
      outputText = ai.choices[0].message.content
    } else if (typeof ai === 'string') {
      outputText = ai
    } else {
      outputText = JSON.stringify(ai)
    }

    // outputText may be wrapped in ```json ... ``` fences. Strip and parse
    const cleaned = outputText.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')

    let parsedOutput = null
    try {
      parsedOutput = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try { parsedOutput = JSON.parse(match[0]) } catch {}
      }
    }

    // Extract fields safely
    const tokenId = parseInt(req.body.tokenId || req.query.tokenId || req.headers['x-token-id'] || '0', 10) || null
    const serviceDate = parsedOutput?.date ? new Date(parsedOutput.date) : null
    // Accept money as number or string with $ and commas
    const parseMoney = (v) => {
      if (v == null) return null
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    const totalCost = parseMoney(parsedOutput?.totalCost || parsedOutput?.total_cost || parsedOutput?.amount)
    const description = parsedOutput?.serviceType || parsedOutput?.description || parsedOutput?.service || null

    // Store in DB
    try {
      await pool.query(
        `INSERT INTO vehicle_maintenance.maintenance_records 
         (token_id, service_date, total_cost, description, output_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [tokenId, serviceDate, totalCost, description, outputText]
      )
    } catch (dbErr) {
      console.error('Failed to insert maintenance record:', dbErr)
      // continue; we still return the AI result
    }

    res.json({ ...result, parsed: parsedOutput })
  } catch (error) {
    console.error('Maintenance extraction error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Generate maintenance recommendations
app.post('/api/ai/maintenance-recommendations', async (req, res) => {
  try {
    const { vehicleData } = req.body
    if (!vehicleData) {
      return res.status(400).json({ error: 'Vehicle data is required' })
    }

    const result = await openaiService.generateMaintenanceRecommendations(vehicleData)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('Maintenance recommendations error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Simple text prompt
app.post('/api/ai/prompt', async (req, res) => {
  try {
    const { prompt, model, maxTokens } = req.body
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    const result = await openaiService.processPrompt(prompt, model, maxTokens)

    if (result.success) {
      res.json(result)
    } else {
      res.status(500).json(result)
    }
  } catch (error) {
    console.error('Prompt processing error:', error)
    res.status(500).json({ 
      success: false,
      error: error.message 
    })
  }
})

// Query maintenance records by tokenId (secured by vehicle JWT presence)
app.get('/api/maintenance/:tokenId', async (req, res) => {
  try {
    // Basic check: require a vehicle JWT in Authorization header
    const authHeader = req.headers['authorization'] || ''
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }

    const tokenId = parseInt(req.params.tokenId, 10)
    if (!Number.isFinite(tokenId)) {
      return res.status(400).json({ error: 'Invalid tokenId' })
    }

    const { rows } = await pool.query(
      `SELECT id, token_id as "tokenId", service_date as "serviceDate", total_cost as "totalCost", 
              description, output_text as "outputText", created_at as "createdAt"
         FROM vehicle_maintenance.maintenance_records
        WHERE token_id = $1
        ORDER BY service_date NULLS LAST, created_at DESC`,
      [tokenId]
    )

    // Coerce numeric fields to numbers (pg returns NUMERIC as string)
    const normalized = rows.map(r => ({
      ...r,
      totalCost: r.totalCost != null ? Number(r.totalCost) : null,
    }))

    res.json({ tokenId, records: normalized })
  } catch (error) {
    console.error('Failed to query maintenance records:', error)
    res.status(500).json({ error: 'Failed to query maintenance records' })
  }
})

// Serve frontend for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'))
})

// Start server
async function startServer() {
  await initializeServer()
  await runMigrations(pool)
  
  if (USE_HTTPS) {
    try {
      // Load SSL certificates
      const certPath = path.join(__dirname, '../../.mkcert/cert.pem')
      const keyPath = path.join(__dirname, '../../.mkcert/dev.pem')
      
      const options = {
        key: await fs.readFile(keyPath),
        cert: await fs.readFile(certPath)
      }
      
      https.createServer(options, app).listen(HTTPS_PORT, () => {
        console.log(`🔒 Vehicle Reports Backend (HTTPS) running on port ${HTTPS_PORT}`)
        console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
        console.log(`💾 Using tmp directory: ${tmpDir}`)
        console.log(`🔐 HTTPS enabled with mkcert certificates`)
      })
    } catch (error) {
      console.error('Failed to start HTTPS server:', error.message)
      console.log('Falling back to HTTP server...')
      
      app.listen(PORT, () => {
        console.log(`🚀 Vehicle Reports Backend (HTTP) running on port ${PORT}`)
        console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
        console.log(`💾 Using tmp directory: ${tmpDir}`)
      })
    }
  } else {
    app.listen(PORT, () => {
      console.log(`🚀 Vehicle Reports Backend (HTTP) running on port ${PORT}`)
      console.log(`📁 Serving frontend from: ${path.join(__dirname, '../../dist')}`)
      console.log(`💾 Using tmp directory: ${tmpDir}`)
    })
  }
}

startServer().catch(console.error)

export default app
