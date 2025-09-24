# AI Features Integration

This backend now includes OpenAI ChatGPT integration for processing maintenance documents and generating recommendations.

## Environment Variables

Add the following to your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Available AI Endpoints

### 1. Process Image with Prompt
**POST** `/api/ai/process-image`

Upload an image file and send a prompt to analyze it.

**Request:**
- `image` (file): Image file (JPEG, PNG, GIF, WebP, BMP)
- `prompt` (string): Text prompt for analysis
- `model` (string, optional): OpenAI model (default: 'gpt-4-vision-preview')

**Response:**
```json
{
  "success": true,
  "content": "AI analysis result",
  "usage": { "total_tokens": 150 }
}
```

### 2. Process PDF with Prompt
**POST** `/api/ai/process-pdf`

Upload a PDF file and send a prompt to analyze it.

**Request:**
- `pdf` (file): PDF file
- `prompt` (string): Text prompt for analysis
- `model` (string, optional): OpenAI model (default: 'gpt-4-vision-preview')

### 3. Extract Maintenance Information
**POST** `/api/ai/extract-maintenance`

Upload a maintenance document (PDF or image) and automatically extract structured maintenance information.

**Request:**
- `document` (file): PDF or image file

**Response:**
```json
{
  "success": true,
  "content": "{\"date\": \"2024-01-15\", \"serviceType\": \"Oil Change\", \"description\": \"...\", \"parts\": [\"Oil Filter\"], \"labor\": 50, \"partsCost\": 25, \"totalCost\": 75, \"mileage\": 45000, \"nextService\": \"Next oil change in 5000 miles\", \"notes\": \"...\"}"
}
```

### 4. Generate Maintenance Recommendations
**POST** `/api/ai/maintenance-recommendations`

Generate AI-powered maintenance recommendations based on vehicle data.

**Request:**
```json
{
  "vehicleData": {
    "year": 2020,
    "make": "Toyota",
    "model": "Camry",
    "odometerReading": 45000,
    "age": 4,
    "maintenanceHistory": [
      {"date": "2024-01-15", "service": "Oil Change", "amount": 75}
    ]
  }
}
```

### 5. Simple Text Prompt
**POST** `/api/ai/prompt`

Send a simple text prompt to ChatGPT.

**Request:**
```json
{
  "prompt": "What are the signs of brake wear?",
  "model": "gpt-3.5-turbo",
  "maxTokens": 1000
}
```

## File Upload Limits

- Maximum file size: 10MB
- Allowed file types: PDF, JPEG, JPG, PNG, GIF, WebP, BMP
- Files are automatically cleaned up after processing

## Usage Examples

### Frontend Integration

```javascript
// Upload maintenance document
const formData = new FormData()
formData.append('document', fileInput.files[0])

const response = await fetch('/api/ai/extract-maintenance', {
  method: 'POST',
  body: formData
})

const result = await response.json()
if (result.success) {
  const maintenanceData = JSON.parse(result.content)
  console.log('Extracted maintenance info:', maintenanceData)
}
```

### Generate Recommendations

```javascript
const response = await fetch('/api/ai/maintenance-recommendations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    vehicleData: {
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      odometerReading: 45000,
      age: 4,
      maintenanceHistory: []
    }
  })
})

const result = await response.json()
if (result.success) {
  console.log('AI recommendations:', result.content)
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error scenarios:
- Missing API key: Check `OPENAI_API_KEY` environment variable
- Invalid file type: Only PDF and image files are allowed
- File too large: Maximum 10MB file size
- OpenAI API errors: Check API key and quota
