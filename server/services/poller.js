/**
 * eBay poller — background service that periodically searches eBay UK for
 * watched movies (wanted + upgrade) and sends ntfy.sh notifications for
 * auctions ending soon.
 *
 * Poll interval is dynamic:
 *   < 10 min to auction end → 30 seconds
 *   < 1 hr  to auction end → 2 minutes
 *   default               → 5 minutes
 */

const https = require('https')
const db    = require('../../electron/database')
const { getEbayToken, searchEbayUK, buildEbayQuery } = require('./ebay')

let lastPollTime = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msUntil(isoString) {
  return new Date(isoString).getTime() - Date.now()
}

function formatTimeRemaining(ms) {
  const totalSec = Math.floor(ms / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hrs   = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  if (days > 0) return `${days}d ${hrs}h ${mins}m`
  if (hrs  > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

// Return the poll interval in ms based on the soonest active auction end.
function getIntervalMs(allListings) {
  const now      = Date.now()
  const auctions = allListings.filter(
    (l) => l.listing_type === 'AUCTION' && l.end_time && new Date(l.end_time).getTime() > now
  )
  const soonestMs = auctions.reduce((min, l) => {
    const ms = new Date(l.end_time).getTime() - now
    return ms < min ? ms : min
  }, Infinity)

  if (soonestMs < 10 * 60 * 1000)  return 30 * 1000        // < 10 min → 30 s
  if (soonestMs < 60 * 60 * 1000)  return 2  * 60 * 1000   // < 1 hr  → 2 min
  return 5 * 60 * 1000                                       // default → 5 min
}

// ─── ntfy.sh notifications ────────────────────────────────────────────────────

async function sendNtfy(topic, title, message, priority) {
  const payload = JSON.stringify({ topic, title, message, priority })
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'ntfy.sh',
        path:     '/',
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => { res.resume(); resolve(res.statusCode) }
    )
    req.on('error', () => resolve(null))
    req.write(payload)
    req.end()
  })
}

async function checkAndNotify(listing, movieTitle) {
  if (!listing.end_time) return
  const ntfyTopic = db.getSetting('ntfy_topic')
  if (!ntfyTopic) return

  const ms = msUntil(listing.end_time)
  if (ms <= 0) return

  const priceStr = listing.price != null ? `£${listing.price.toFixed(2)}` : 'unknown'
  const timeStr  = formatTimeRemaining(ms)
  const body     = `${timeStr} remaining — Current bid: ${priceStr}`
  const titleStr = `Auction ending soon: ${movieTitle}`

  if (ms < 5 * 60 * 1000 && !listing.notified_5min) {
    await sendNtfy(ntfyTopic, titleStr, body, 'urgent')
    db.markEbayListingNotified(listing.id, '5min')
    // Also mark the longer intervals if not already set
    if (!listing.notified_15min) db.markEbayListingNotified(listing.id, '15min')
    if (!listing.notified_1hr)   db.markEbayListingNotified(listing.id, '1hr')
  } else if (ms < 15 * 60 * 1000 && !listing.notified_15min) {
    await sendNtfy(ntfyTopic, titleStr, body, 'high')
    db.markEbayListingNotified(listing.id, '15min')
    if (!listing.notified_1hr) db.markEbayListingNotified(listing.id, '1hr')
  } else if (ms < 60 * 60 * 1000 && !listing.notified_1hr) {
    await sendNtfy(ntfyTopic, titleStr, body, 'default')
    db.markEbayListingNotified(listing.id, '1hr')
  }
}

// ─── Poll ─────────────────────────────────────────────────────────────────────

async function runPoll() {
  try {
    const appId  = db.getSetting('ebay_app_id')
    const certId = db.getSetting('ebay_cert_id')
    if (!appId || !certId) {
      console.log('[eBay poller] No API credentials configured — skipping poll')
      return
    }

    const token  = await getEbayToken(appId, certId)
    const movies = db.getAllWatchedMovies()
    console.log(`[eBay poller] Polling ${movies.length} watched movie(s)…`)

    for (const movie of movies) {
      try {
        const query   = buildEbayQuery(movie)
        const results = await searchEbayUK(query, token)

        const currentIds = []
        for (const item of results) {
          db.upsertEbayListing({ ...item, tmdb_id: movie.tmdb_id })
          currentIds.push(item.id)
        }
        db.deleteStaleListings(movie.tmdb_id, currentIds)

        // Re-read from DB to get correct notified flags before checking
        const dbListings = db.getEbayListingsForMovie(movie.tmdb_id)
        for (const listing of dbListings) {
          if (listing.listing_type === 'AUCTION') {
            await checkAndNotify(listing, movie.title)
          }
        }

        // Polite delay between movies (~2 req/s)
        await new Promise((r) => setTimeout(r, 500))
      } catch (err) {
        console.error(`[eBay poller] Error for "${movie.title}":`, err.message)
      }
    }

    lastPollTime = new Date().toISOString()
    console.log(`[eBay poller] Poll complete at ${lastPollTime}`)
  } catch (err) {
    console.error('[eBay poller] Poll failed:', err.message)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

// No-op kept for server/index.js compatibility. Background polling is disabled;
// all polls are manually triggered via the "Refresh Now" button.
function startPoller() {
  console.log('[eBay poller] Background polling disabled — manual refresh only')
}

// Triggered by POST /api/ebay/poll (the dashboard's "Refresh Now" button).
async function triggerPoll() {
  await runPoll()
}

function getStatus() {
  const now    = Date.now()
  const all    = db.getAllEbayListings()
  const urgent = all.filter(
    (l) => l.listing_type === 'AUCTION' &&
           l.end_time &&
           new Date(l.end_time).getTime() > now &&
           new Date(l.end_time).getTime() - now < 60 * 60 * 1000
  )
  return {
    lastPollTime,
    nextPollTime:       null,       // no scheduled next poll in manual mode
    totalListings:      all.length,
    urgentAuctionCount: urgent.length,
  }
}

module.exports = { startPoller, triggerPoll, getStatus }
