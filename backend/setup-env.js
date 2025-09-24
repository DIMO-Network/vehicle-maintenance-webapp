#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '.env')
const templatePath = path.join(__dirname, 'env.template')

console.log('🔧 Setting up environment configuration...\n')

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists')
  console.log('📝 If you need to update it, edit:', envPath)
  process.exit(0)
}

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error('❌ env.template file not found')
  process.exit(1)
}

try {
  // Copy template to .env
  const templateContent = fs.readFileSync(templatePath, 'utf8')
  fs.writeFileSync(envPath, templateContent)
  
  console.log('✅ Created .env file from template')
  console.log('📝 Please edit .env file with your actual API keys:')
  console.log('   ', envPath)
  console.log('\n🔑 Required variables:')
  console.log('   - DIMO_CLIENT_ID: Your DIMO client ID')
  console.log('   - DIMO_API_KEY: Your DIMO API key')
  console.log('   - DIMO_REDIRECT_URI: Your redirect URI')
  console.log('   - OPENAI_API_KEY: Your OpenAI API key (optional for AI features)')
  console.log('\n🚀 After updating .env, restart the server with: npm start')
  
} catch (error) {
  console.error('❌ Failed to create .env file:', error.message)
  process.exit(1)
}
