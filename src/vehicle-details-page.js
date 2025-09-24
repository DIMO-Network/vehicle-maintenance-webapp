import { LitElement, css, html } from 'lit'
import { graphqlService } from './graphql-service.js'
import { jwtManager } from './jwt-manager.js'
import { dimoApiService } from './dimo-api-service.js'

/**
 * Vehicle details page component displaying detailed information about a specific vehicle
 */
export class VehicleDetailsPage extends LitElement {
  static get properties() {
    return {
      tokenId: { type: String },
      vehicle: { type: Object },
      isLoading: { type: Boolean },
      error: { type: String },
      showUploadModal: { type: Boolean },
      uploadFiles: { type: Array },
      uploadProgress: { type: Array },
      isUploading: { type: Boolean },
      maintenanceRecords: { type: Array },
    }
  }

  constructor() {
    super()
    this.tokenId = ''
    this.vehicle = null
    this.isLoading = false
    this.error = ''
    this.showUploadModal = false
    this.uploadFiles = []
    this.uploadProgress = []
    this.isUploading = false
    this.maintenanceRecords = []
  }

  async connectedCallback() {
    super.connectedCallback()
  }

  async updated(changedProperties) {
    super.updated(changedProperties)
    // Only trigger if tokenId changed AND we're not already loading
    if (changedProperties.has('tokenId') && this.tokenId && !this.isLoading) {
      console.log('Triggering loadVehicleDetails from updated method')
      await this.loadVehicleDetails()
      await this.loadMaintenanceHistory()
    }
  }

  async loadVehicleDetails() {
    // Prevent multiple simultaneous calls
    if (this.isLoading) {
      console.log('loadVehicleDetails already in progress, skipping')
      return
    }
    
    this.isLoading = true
    this.error = ''

    try {
      // get identity-api data
      const vehicleData = await graphqlService.getVehicleById(this.tokenId)
      if (!vehicleData) {
        throw new Error('Vehicle not found')
      }
      
      // Map the data to our format
      this.vehicle = graphqlService.mapVehicleData(vehicleData)

      // Call backend endpoint for vehicle details info
      try {
        const backendData = await dimoApiService.getVehicleDetailsInfo(this.tokenId)
        
        // Extract odometer reading from the last signals record
        if (backendData.telemetry?.data?.signals && backendData.telemetry.data.signals.length > 0) {
          const signals = backendData.telemetry.data.signals
          
          // Process all signals to create odometer history
          const odometerHistory = signals.map(signal => {
            const kmReading = signal.powertrainTransmissionTravelledDistance
            const milesReading = kmReading * 0.621371 // Convert km to miles
            return {
              timestamp: signal.timestamp,
              kilometers: kmReading,
              miles: milesReading
            }
          })
          
          // Sort by timestamp to ensure chronological order
          odometerHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          
          const lastSignal = odometerHistory[odometerHistory.length - 1]
          
          console.log('Odometer history processed:', odometerHistory.length, 'records')
          
          // Store the odometer data in the vehicle object
          this.vehicle.odometerReading = lastSignal.miles
          this.vehicle.odometerTimestamp = lastSignal.timestamp
          this.vehicle.odometerUnit = 'miles'
          this.vehicle.odometerHistory = odometerHistory
        } else {
          console.log('No signals data available for odometer reading')
        }
      } catch (backendError) {
        console.error('Backend API call failed:', backendError)
      }

      

    } catch (error) {
      console.error('Step ERROR: Failed to load vehicle details:', error)
      console.error('Error details:', error.message, error.stack)
      this.error = error.message || 'Failed to load vehicle details'
    } finally {
      this.isLoading = false
    }
  }

  render() {
    return html`
      <div class="vehicle-details-container">
        ${this.error ? html`
          <div class="error-message">
            <p>${this.error}</p>
            <button @click=${this.loadVehicleDetails} class="retry-btn">Try Again</button>
          </div>
        ` : ''}

        ${this.isLoading ? html`
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading vehicle details...</p>
          </div>
        ` : this.vehicle ? html`
          <div class="vehicle-details-content">
            <div class="vehicle-header">
              <h1>Vehicle Details</h1>
              <div class="token-id-badge">
                <span class="label">VIN:</span>
                <code>${this.tokenId}</code>
              </div>
            </div>

            <div class="details-grid">
              <div class="detail-card">
                <h3>Basic Information</h3>
                <div class="detail-item">
                  <span class="label">Make:</span>
                  <span class="value">${this.vehicle.make}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Model:</span>
                  <span class="value">${this.vehicle.model}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Year:</span>
                  <span class="value">${this.vehicle.year}</span>
                </div>
              </div>

              <div class="detail-card">
                <h3>Overview</h3>
                <div class="detail-item">
                  <span class="label">Odometer:</span>
                  <span class="value status-active">
                    ${this.vehicle.odometerReading ? 
                      `${this.vehicle.odometerReading.toLocaleString()} ${this.vehicle.odometerUnit || 'miles'}` : 
                      'N/A'
                    }
                  </span>
                </div>
                ${this.vehicle.odometerTimestamp ? html`
                  <div class="detail-item">
                    <span class="label">Last Updated:</span>
                    <span class="value">${new Date(this.vehicle.odometerTimestamp).toLocaleDateString()}</span>
                  </div>
                ` : ''}
                 <div class="detail-item">
                  <span class="label">Vehicle Age:</span>
                  <span class="value">${new Date().getFullYear() - this.vehicle.year}</span>
                </div>
                <div class="detail-item">
                  <span class="label">Next Service:</span>
                  <span class="value">Est. at 69,000 miles (TODO)</span>
                </div>
              </div>

              <div class="detail-card full-width">
                <h3>Odometer History</h3>
                ${this.vehicle.odometerHistory && this.vehicle.odometerHistory.length > 0 ? html`
                  <div class="odometer-table-container">
                    <table class="odometer-table">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>Odometer Reading</th>
                          <th>Distance Traveled</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${this.vehicle.odometerHistory.map((reading, index) => {
                          const previousReading = index > 0 ? this.vehicle.odometerHistory[index - 1].miles : 0
                          const distanceTraveled = reading.miles - previousReading
                          
                          // Format date to show year range (e.g., "9/23/2022 - 2023")
                          const readingDate = new Date(reading.timestamp)
                          const readingYear = readingDate.getFullYear()
                          const nextYear = readingYear + 1
                          const formattedDate = `${readingDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })} - ${nextYear}`
                          
                          return html`
                            <tr>
                              <td>${formattedDate}</td>
                              <td>${reading.miles.toLocaleString()} miles</td>
                              <td>${index === 0 ? '—' : `+${distanceTraveled.toLocaleString()} miles`}</td>
                            </tr>
                          `
                        })}
                      </tbody>
                    </table>
                  </div>
                ` : html`
                  <div class="no-data">
                    <p>No odometer history available</p>
                  </div>
                `}
              </div>
            </div>

            <div class="actions-section">
              <div class="section-header">
                <h3>Maintenance History</h3>
                <button @click=${this.openUploadModal} class="upload-btn">
                  <span class="upload-icon">📄</span>
                  Upload Invoices
                </button>
              </div>
              <div class="maintenance-table-container">
                ${this.maintenanceRecords && this.maintenanceRecords.length > 0 ? html`
                  <table class="maintenance-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${this.maintenanceRecords.map(r => html`
                        <tr>
                          <td>${r.serviceDate ? new Date(r.serviceDate).toLocaleDateString() : '—'}</td>
                          <td>${r.description || '—'}</td>
                          <td>${typeof r.totalCost === 'number' ? `$${r.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                ` : html`
                  <div class="no-data">
                    <p>No maintenance records yet</p>
                  </div>
                `}
              </div>
            </div>
          </div>
        ` : html`
          <div class="no-vehicle">
            <p>No vehicle data available</p>
          </div>
        `}
        
        <!-- Upload Modal -->
        ${this.showUploadModal ? html`
          <div class="modal-overlay" @click=${this.closeUploadModal}>
            <div class="modal-content" @click=${e => e.stopPropagation()}>
              <div class="modal-header">
                <h3>Upload Maintenance Invoices</h3>
                <button @click=${this.closeUploadModal} class="close-btn">&times;</button>
              </div>
              
              <div class="modal-body">
                <div class="upload-area" 
                     @dragover=${this.handleDragOver}
                     @dragleave=${this.handleDragLeave}
                     @drop=${this.handleDrop}
                     @click=${this.triggerFileInput}>
                  <div class="upload-icon-large">📄</div>
                  <p class="upload-text">
                    Drag & drop maintenance documents here<br>
                    or <span class="upload-link">click to browse</span>
                  </p>
                  <p class="upload-formats">Supports PDF, JPEG, PNG, GIF, WebP, BMP</p>
                </div>
                
                <input type="file" 
                       id="file-input" 
                       multiple 
                       accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
                       @change=${this.handleFileSelect}
                       style="display: none;">
                
                ${this.uploadFiles.length > 0 ? html`
                  <div class="file-list">
                    <h4>Selected Files (${this.uploadFiles.length})</h4>
                    ${this.uploadFiles.map((file, index) => html`
                      <div class="file-item">
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                        <button @click=${() => this.removeFile(index)} class="remove-file-btn">&times;</button>
                      </div>
                    `)}
                  </div>
                ` : ''}
                
                ${this.uploadProgress.length > 0 ? html`
                  <div class="upload-progress">
                    <h4>Upload Progress</h4>
                    ${this.uploadProgress.map((progress, index) => html`
                      <div class="progress-item">
                        <div class="progress-info">
                          <span class="progress-filename">${progress.filename}</span>
                          <span class="progress-status">${progress.status}</span>
                        </div>
                        ${progress.status === 'uploading' ? html`
                          <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progress.percent}%"></div>
                          </div>
                        ` : ''}
                        ${progress.response ? html`
                          <div class="progress-response">
                            <pre>${JSON.stringify(progress.response, null, 2)}</pre>
                          </div>
                        ` : ''}
                      </div>
                    `)}
                  </div>
                ` : ''}
              </div>
              
              <div class="modal-footer">
                <button @click=${this.closeUploadModal} class="btn-secondary">Cancel</button>
                <button @click=${this.startUpload} 
                        ?disabled=${this.uploadFiles.length === 0 || this.isUploading}
                        class="btn-primary">
                  ${this.isUploading ? 'Uploading...' : `Upload ${this.uploadFiles.length} Files`}
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `
  }

  generateReport() {
    // TODO: Implement report generation
    console.log('Generate report for vehicle:', this.tokenId)
  }

  // Upload Modal Methods
  openUploadModal() {
    this.showUploadModal = true
    this.uploadFiles = []
    this.uploadProgress = []
    this.isUploading = false
  }

  closeUploadModal() {
    this.showUploadModal = false
    this.uploadFiles = []
    this.uploadProgress = []
    this.isUploading = false
    // Refresh maintenance history on close
    this.loadMaintenanceHistory()
  }

  triggerFileInput() {
    const fileInput = this.shadowRoot.getElementById('file-input')
    if (fileInput) {
      fileInput.click()
    }
  }

  handleFileSelect(event) {
    const files = Array.from(event.target.files)
    this.addFiles(files)
  }

  handleDragOver(event) {
    event.preventDefault()
    event.currentTarget.classList.add('drag-over')
  }

  handleDragLeave(event) {
    event.preventDefault()
    event.currentTarget.classList.remove('drag-over')
  }

  handleDrop(event) {
    event.preventDefault()
    event.currentTarget.classList.remove('drag-over')
    const files = Array.from(event.dataTransfer.files)
    this.addFiles(files)
  }

  addFiles(files) {
    const validFiles = files.filter(file => {
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
      return validTypes.includes(file.type) || file.name.match(/\.(pdf|jpg|jpeg|png|gif|webp|bmp)$/i)
    })

    if (validFiles.length !== files.length) {
      console.warn('Some files were skipped due to invalid format')
    }

    this.uploadFiles = [...this.uploadFiles, ...validFiles]
  }

  removeFile(index) {
    this.uploadFiles = this.uploadFiles.filter((_, i) => i !== index)
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  async startUpload() {
    if (this.uploadFiles.length === 0) return

    this.isUploading = true
    this.uploadProgress = []

    for (let i = 0; i < this.uploadFiles.length; i++) {
      const file = this.uploadFiles[i]
      const progressItem = {
        filename: file.name,
        status: 'uploading',
        percent: 0,
        response: null
      }
      this.uploadProgress = [...this.uploadProgress, progressItem]

      try {
        // Update progress to show uploading
        this.updateProgress(i, { status: 'uploading', percent: 50 })

        // Get session JWT
        const { jwt } = jwtManager.getAuthStatus()
        const result = await dimoApiService.extractMaintenanceInfo(file, this.tokenId, jwt)
        
        // Update progress to show completed
        this.updateProgress(i, { 
          status: 'completed',
          percent: 100,
          response: result
        })

        console.log(`Upload completed for ${file.name}:`, result)

      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error)
        this.updateProgress(i, { 
          status: 'error',
          percent: 100,
          response: { error: error.message }
        })
      }
    }

    this.isUploading = false
    // Reset selected files after upload completes
    this.uploadFiles = []
  }

  updateProgress(index, updates) {
    this.uploadProgress = this.uploadProgress.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    )
  }

  async loadMaintenanceHistory() {
    try {
        const { jwt } = jwtManager.getAuthStatus()
      
      const data = await dimoApiService.getMaintenanceRecords(this.tokenId, jwt)
      console.log('Maintenance history from DB:', data)
      this.maintenanceRecords = data.records || []
    } catch (error) {
      console.error('Failed to load maintenance history:', error)
    }
  }

  static get styles() {
    return css`
      .vehicle-details-container {
        min-height: 100vh;
        background-color: #f8f9fa;
        padding: 2rem;
      }

      .error-message {
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        text-align: center;
        margin-bottom: 2rem;
      }

      .retry-btn {
        background: #dc3545;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        margin-top: 0.5rem;
      }

      .retry-btn:hover {
        background: #c82333;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 2rem;
        color: #6c757d;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(102, 126, 234, 0.3);
        border-top: 4px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 1rem;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .vehicle-details-content {
        max-width: 1200px;
        margin: 0 auto;
      }

      .vehicle-header {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 2rem;
        margin-bottom: 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .vehicle-header h1 {
        margin: 0;
        color: #2c3e50;
        font-size: 2rem;
        font-weight: 600;
      }

      .token-id-badge {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: #e9ecef;
        padding: 0.5rem 1rem;
        border-radius: 8px;
      }

      .token-id-badge .label {
        font-weight: 500;
        color: #495057;
      }

      .token-id-badge code {
        background: #495057;
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
      }

      .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-bottom: 0rem;
      }

      .detail-card.full-width {
        grid-column: 1 / -1;
        margin-bottom: 2rem;
      }

      .detail-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 1.5rem;
      }

      .detail-card h3 {
        margin: 0 0 1rem 0;
        color: #2c3e50;
        font-size: 1.25rem;
        font-weight: 600;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 0.5rem;
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 0;
        border-bottom: 1px solid #f8f9fa;
      }

      .detail-item:last-child {
        border-bottom: none;
      }

      .detail-item .label {
        font-weight: 500;
        color: #495057;
      }

      .detail-item .value {
        color: #2c3e50;
        font-weight: 400;
      }

      .detail-item .value.imei {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 0.9rem;
        color: #6c757d;
      }

      .detail-item .value.status-active {
        color: #28a745;
        font-weight: 500;
      }

      .odometer-table-container {
        margin-top: 1rem;
        overflow-x: auto;
      }

      .odometer-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .odometer-table th {
        background: #f8f9fa;
        color: #495057;
        font-weight: 600;
        padding: 0.75rem;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
      }

      .odometer-table td {
        padding: 0.75rem;
        border-bottom: 1px solid #dee2e6;
        color: #2c3e50;
      }

      .odometer-table tr:hover {
        background-color: #f8f9fa;
      }

      .odometer-table td:last-child {
        font-weight: 500;
        color: #28a745;
      }

      .no-data {
        text-align: center;
        padding: 2rem;
        color: #6c757d;
        font-style: italic;
      }

      .maintenance-table-container {
        margin-top: 1rem;
        overflow-x: auto;
      }

      .maintenance-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }

      .maintenance-table th {
        background: #f8f9fa;
        color: #495057;
        font-weight: 600;
        padding: 0.75rem;
        text-align: left;
        border-bottom: 2px solid #dee2e6;
      }

      .maintenance-table td {
        padding: 0.75rem;
        border-bottom: 1px solid #dee2e6;
        color: #2c3e50;
      }

      .maintenance-table tr:hover {
        background-color: #f8f9fa;
      }

      .maintenance-table td:last-child {
        font-weight: 500;
        color: #28a745;
        text-align: right;
      }

      .actions-section {
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        padding: 2rem;
      }

      .actions-section h3 {
        margin: 0 0 1.5rem 0;
        color: #2c3e50;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .action-buttons {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .action-btn {
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: transform 0.2s, box-shadow 0.2s;
        border: none;
      }

      .action-btn.primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .action-btn.primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
      }

      .action-btn.secondary {
        background: #6c757d;
        color: white;
      }

      .action-btn.secondary:hover {
        background: #5a6268;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(108, 117, 125, 0.4);
      }

      .no-vehicle {
        text-align: center;
        padding: 4rem 2rem;
        color: #6c757d;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        .vehicle-details-container {
          background-color: #1a1a1a;
        }

        .vehicle-header,
        .detail-card,
        .actions-section,
        .no-vehicle {
          background: #2c3e50;
        }

        .vehicle-header h1,
        .detail-card h3,
        .actions-section h3 {
          color: #e9ecef;
        }

        .token-id-badge {
          background: #495057;
        }

        .token-id-badge .label {
          color: #e9ecef;
        }

        .detail-item .label {
          color: #e9ecef;
        }

        .detail-item .value {
          color: #e9ecef;
        }

        .detail-item .value.imei {
          color: #adb5bd;
        }
      }

      /* Upload Modal Styles */
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .upload-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .upload-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .upload-icon {
        font-size: 1rem;
      }

      .modal-overlay {
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
        padding: 1rem;
      }

      .modal-content {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        width: 100%;
        max-width: 600px;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.5rem;
        border-bottom: 1px solid #e9ecef;
      }

      .modal-header h3 {
        margin: 0;
        color: #2c3e50;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #6c757d;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .close-btn:hover {
        background-color: #f8f9fa;
      }

      .modal-body {
        padding: 1.5rem;
        overflow-y: auto;
        flex: 1;
      }

      .upload-area {
        border: 2px dashed #dee2e6;
        border-radius: 8px;
        padding: 2rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #f8f9fa;
      }

      .upload-area:hover {
        border-color: #667eea;
        background: #f0f2ff;
      }

      .upload-area.drag-over {
        border-color: #667eea;
        background: #e8f0fe;
        transform: scale(1.02);
      }

      .upload-icon-large {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.7;
      }

      .upload-text {
        font-size: 1.1rem;
        color: #495057;
        margin: 0 0 0.5rem 0;
      }

      .upload-link {
        color: #667eea;
        text-decoration: underline;
        cursor: pointer;
      }

      .upload-formats {
        font-size: 0.9rem;
        color: #6c757d;
        margin: 0;
      }

      .file-list {
        margin-top: 1.5rem;
      }

      .file-list h4 {
        margin: 0 0 1rem 0;
        color: #2c3e50;
        font-size: 1rem;
      }

      .file-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        background: #f8f9fa;
        border-radius: 6px;
        margin-bottom: 0.5rem;
      }

      .file-name {
        font-weight: 500;
        color: #2c3e50;
        flex: 1;
        margin-right: 1rem;
      }

      .file-size {
        color: #6c757d;
        font-size: 0.9rem;
        margin-right: 1rem;
      }

      .remove-file-btn {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .remove-file-btn:hover {
        background: #c82333;
      }

      .upload-progress {
        margin-top: 1.5rem;
      }

      .upload-progress h4 {
        margin: 0 0 1rem 0;
        color: #2c3e50;
        font-size: 1rem;
      }

      .progress-item {
        background: #f8f9fa;
        border-radius: 6px;
        padding: 1rem;
        margin-bottom: 1rem;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .progress-filename {
        font-weight: 500;
        color: #2c3e50;
      }

      .progress-status {
        font-size: 0.9rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-weight: 500;
      }

      .progress-status.uploading {
        background: #e3f2fd;
        color: #1976d2;
      }

      .progress-status.completed {
        background: #e8f5e8;
        color: #2e7d32;
      }

      .progress-status.error {
        background: #ffebee;
        color: #c62828;
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: #e9ecef;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea, #764ba2);
        transition: width 0.3s ease;
      }

      .progress-response {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 0.75rem;
        margin-top: 0.5rem;
        max-height: 200px;
        overflow-y: auto;
      }

      .progress-response pre {
        margin: 0;
        font-size: 0.8rem;
        color: #495057;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        padding: 1.5rem;
        border-top: 1px solid #e9ecef;
        background: #f8f9fa;
      }

      .btn-secondary {
        background: #6c757d;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .btn-secondary:hover {
        background: #5a6268;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 500;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      @media (max-width: 768px) {
        .vehicle-details-container {
          padding: 1rem;
        }

        .vehicle-header {
          flex-direction: column;
          text-align: center;
        }

        .details-grid {
          grid-template-columns: 1fr;
        }

        .action-buttons {
          flex-direction: column;
        }

        .action-btn {
          width: 100%;
        }

        .section-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
        }

        .upload-btn {
          width: 100%;
          justify-content: center;
        }

        .modal-content {
          margin: 0.5rem;
          max-height: 90vh;
        }

        .modal-header,
        .modal-body,
        .modal-footer {
          padding: 1rem;
        }

        .upload-area {
          padding: 1.5rem;
        }

        .file-item {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .file-name {
          margin-right: 0;
        }

        .file-size {
          margin-right: 0;
        }

        .modal-footer {
          flex-direction: column;
        }

        .btn-secondary,
        .btn-primary {
          width: 100%;
        }
      }
    `
  }
}

window.customElements.define('vehicle-details-page', VehicleDetailsPage)
