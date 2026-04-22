/**
 * eBay UK Browse API wrapper.
 * Handles OAuth token caching, search, and query building.
 */

const https = require('https')

// In-memory token cache
let _token       = null
let _tokenExpiry = 0

// POST to eBay OAuth endpoint. Caches the token until 60s before expiry.
async function getEbayToken(appId, certId) {
  if (_token && Date.now() < _tokenExpiry) return _token

  const credentials = Buffer.from(`${appId}:${certId}`).toString('base64')
  const body        = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'

  const data = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.ebay.com',
        path:     '/identity/v1/oauth2/token',
        method:   'POST',
        headers: {
          'Content-Type':   'application/x-www-form-urlencoded',
          'Authorization':  `Basic ${credentials}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(raw)) } catch { reject(new Error('Bad token response')) }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })

  if (!data.access_token) {
    throw new Error(`eBay auth failed: ${data.error_description || JSON.stringify(data)}`)
  }

  _token       = data.access_token
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return _token
}

// Invalidate the cached token (called when a request returns 401).
function invalidateToken() {
  _token       = null
  _tokenExpiry = 0
}

// Build a smart eBay search query for a movie.
// Both 'wanted' and 'upgrade' statuses target 4K Blu-ray.
function buildEbayQuery(movie) {
  // Strip characters that confuse eBay's query parser, normalise whitespace
  let title = movie.title
    .replace(/[^\w\s'&-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Add year for short/common/ambiguous titles
  const COMMON_WORDS = ['it', 'us', 'her', 'him', 'them', 'up', 'go', 'run', 'fly', 'rush', 'm']
  const words        = title.toLowerCase().split(' ')
  const needsYear    = words.length <= 2 || COMMON_WORDS.includes(words[0])
  if (needsYear && movie.year) title = `${title} ${movie.year}`

  return `${title} 4K Blu-ray`
}

// Call eBay Browse API and return normalised listing objects.
async function searchEbayUK(query, token) {
  const params = new URLSearchParams({
    q:           query,
    filter:      'buyingOptions:{FIXED_PRICE|AUCTION|BEST_OFFER},categoryIds:{617|267}',
    limit:       '20',
    fieldgroups: 'EXTENDED',
  })

  const data = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.ebay.com',
        path:     `/buy/browse/v1/item_summary/search?${params}`,
        method:   'GET',
        headers: {
          'Authorization':            `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID':  'EBAY_GB',
          'X-EBAY-C-ENDUSERCTX':      'contextualLocation=country%3DGB',
        },
      },
      (res) => {
        // Surface auth errors so the caller can invalidate the token
        if (res.statusCode === 401) {
          invalidateToken()
          return reject(new Error('eBay token expired (401)'))
        }
        let raw = ''
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          try { resolve(JSON.parse(raw)) } catch { reject(new Error('Bad search response')) }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })

  // Surface API-level errors (rate limits, quota exceeded, etc.) instead of
  // silently returning an empty list — that had been causing deleteStaleListings
  // to wipe cached listings whenever we got throttled.
  if (data.errors?.length) {
    const err = data.errors[0]
    const msg = `${err.errorId}: ${err.message || err.longMessage || 'Unknown error'}`
    throw new Error(`eBay API error — ${msg}`)
  }

  const now = new Date().toISOString()
  return (data.itemSummaries || []).map((item) => ({
    id:             item.itemId,
    title:          item.title,
    price:          item.price?.value         ? parseFloat(item.price.value) : null,
    currency:       item.price?.currency      || 'GBP',
    listing_type:   item.buyingOptions?.[0]   || 'FIXED_PRICE',
    condition:      item.condition            || null,
    image_url:      item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl || null,
    ebay_url:       item.itemWebUrl           || null,
    end_time:       item.itemEndDate          || null,
    bid_count:      item.currentBidPrice ? 1 : (item.bidCount ?? 0),
    seller:         item.seller?.username     || null,
    last_updated:   now,
    notified_1hr:   0,
    notified_15min: 0,
    notified_5min:  0,
  }))
}

module.exports = { getEbayToken, searchEbayUK, buildEbayQuery }
