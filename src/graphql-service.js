// Using fetch instead of GraphQL client to avoid Node.js dependencies

/**
 * GraphQL service for DIMO API
 */
export class GraphQLService {
  constructor() {
    this.endpoint = 'https://identity-api.dimo.zone/query'
  }

  /**
   * Parse JWT to extract ethereum_address claim
   */
  parseJWT(jwt) {
    try {
      const base64Url = jwt.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
      return JSON.parse(jsonPayload)
    } catch (error) {
      console.error('Failed to parse JWT:', error)
      throw new Error('Invalid JWT token')
    }
  }

  async getVehiclesByJWT(userJwt, after = null) {
    // Parse JWT to get ethereum_address
    const claims = this.parseJWT(userJwt)
    const ethereumAddress = claims.ethereum_address

    if (!ethereumAddress) {
      throw new Error('No ethereum_address found in JWT claims')
    }

    return this.getVehicles(ethereumAddress, after)
  }

  /**
   * Get vehicles for the authenticated user
   */
  async getVehicles(ethereumAddress, after = null) {

    // Build the after parameter for pagination
    const afterParam = after ? `, after: "${after}"` : ''

    const query = `{
      vehicles(
        first: 50${afterParam}
        filterBy: { privileged: "${ethereumAddress}" }
      ) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          tokenId
          definition {
            id
          }
          aftermarketDevice {
            imei
          }
          mintedAt
        }
      }
    }`

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
      }

      return {
        totalCount: data.data.vehicles.totalCount,
        pageInfo: data.data.vehicles.pageInfo,
        nodes: data.data.vehicles.nodes
      }
    } catch (error) {
      console.error('GraphQL query failed:', error)
      throw new Error(`Failed to fetch vehicles: ${error.message}`)
    }
  }

  /**
   * Get a specific vehicle by token ID
   */
  async getVehicleById(tokenId) {
    console.log('GraphQL getVehicleById called with tokenId:', tokenId)
    
    const query = `{
      vehicle(tokenId: ${tokenId}) {
        id
        owner
        definition {
          id
          make
          model
          year
        }
      }
    }`

    console.log('GraphQL query:', query)

    try {
      console.log('Making fetch request to:', this.endpoint)
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query
        })
      })

      console.log('Response status:', response.status, response.ok)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('GraphQL response data:', data)

      if (data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`)
      }

      console.log('Returning vehicle data:', data.data.vehicle)
      return data.data.vehicle
    } catch (error) {
      console.error('GraphQL query failed:', error)
      throw new Error(`Failed to fetch vehicle: ${error.message}`)
    }
  }

  /**
   * Format date to human readable format
   */
  formatDate(timestamp) {
    try {
      const date = new Date(timestamp)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Failed to format date:', error)
      return 'Invalid Date'
    }
  }

  /**
   * Map GraphQL vehicle data to table format
   */
  mapVehicleData(vehicle) {
    // Handle both old and new data structures
    const tokenId = vehicle.tokenId || vehicle.id
    const definition = vehicle.definition
    
    return {
      tokenId: tokenId,
      vehicleType: definition?.id || 'Unknown',
      make: definition?.make || 'Unknown',
      model: definition?.model || 'Unknown', 
      year: definition?.year || 'Unknown',
      imei: vehicle.aftermarketDevice?.imei || 'N/A',
      owner: vehicle.owner || (tokenId ? this.formatTokenId(tokenId) : 'N/A'),
      mintedAt: vehicle.mintedAt ? this.formatDate(vehicle.mintedAt) : 'N/A'
    }
  }

  /**
   * Format token ID for display
   */
  formatTokenId(tokenId) {
    if (!tokenId) return 'N/A'
    const tokenStr = tokenId.toString()
    return `${tokenStr.slice(0, 6)}...${tokenStr.slice(-4)}`
  }
}

// Create a singleton instance
export const graphqlService = new GraphQLService()
