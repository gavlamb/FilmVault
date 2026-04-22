const express = require('express')
const path    = require('path')
const fs      = require('fs')
const os      = require('os')
const https   = require('https')

// Must be set before requiring database so it skips the Electron app.getPath() call
process.env.FILMVAULT_DATA = process.env.FILMVAULT_DATA
  || path.join(os.homedir(), '.filmvault')

const db         = require('../electron/database')
const { startPoller, triggerPoll, getStatus: getPollerStatus } = require('./services/poller')
const { buildEbayQuery, getEbayToken, searchEbayUK }           = require('./services/ebay')
const DATA_DIR   = process.env.FILMVAULT_DATA
const POSTER_DIR = path.join(DATA_DIR, 'posters')

if (!fs.existsSync(POSTER_DIR)) fs.mkdirSync(POSTER_DIR, { recursive: true })

const app  = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.static(path.join(__dirname, '../dist')))

// ─── Movies ───────────────────────────────────────────────────────────────────

app.get('/api/movies', (_req, res) => {
  res.json(db.getAllMovies())
})

// Must be before /api/movies/:id so these aren't matched as an id
app.get('/api/movies/status/:status', (req, res) => {
  res.json(db.getMoviesByStatus(req.params.status))
})

app.get('/api/movies/search', (req, res) => {
  res.json(db.searchMovies(req.query.q || ''))
})

app.get('/api/movies/:id', (req, res) => {
  const movie = db.getMovieById(Number(req.params.id))
  movie ? res.json(movie) : res.status(404).json({ error: 'Not found' })
})

app.post('/api/movies', (req, res) => {
  const movie = db.addMovie(req.body)
  res.json(movie)
  // Pre-cache poster server-side so the client's cachePoster call is a fast hit
  if (movie.poster_path && movie.poster_path.startsWith('https://')) {
    downloadPoster(movie.tmdb_id, movie.poster_path).then((filename) => {
      if (filename) db.updateMoviePoster(movie.tmdb_id, `/api/posters/${movie.tmdb_id}`)
    })
  }
})

app.put('/api/movies/:id', (req, res) => {
  res.json(db.updateMovie(Number(req.params.id), req.body))
})

app.delete('/api/movies/:id', (req, res) => {
  db.deleteMovie(Number(req.params.id))
  res.json({ ok: true })
})

// Replace synthetic tmdb_id with real one + set poster
app.put('/api/movies/:id/tmdb', (req, res) => {
  const { newId, posterPath } = req.body
  res.json(db.updateMovieTmdbData(Number(req.params.id), newId, posterPath))
})

// Update poster path only
app.patch('/api/movies/:id/poster', (req, res) => {
  db.updateMoviePoster(Number(req.params.id), req.body.posterPath)
  res.json({ ok: true })
})

// Store IMDb rating
app.patch('/api/movies/:id/rating', (req, res) => {
  const { imdbRating, imdbVotes } = req.body
  db.updateMovieRating(Number(req.params.id), imdbRating ?? null, imdbVotes ?? null)
  res.json({ ok: true })
})

// Store enriched TMDB metadata (backdrop, tagline, director, cast)
app.patch('/api/movies/:id/metadata', (req, res) => {
  db.updateMovieMetadata(Number(req.params.id), req.body || {})
  res.json({ ok: true })
})

// ─── Collections ──────────────────────────────────────────────────────────────

app.get('/api/collections', (_req, res) => {
  res.json(db.getAllCollections())
})

app.post('/api/collections', (req, res) => {
  res.json(db.addCollection(req.body))
})

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', (_req, res) => {
  res.json(db.getAllSettings())
})

app.get('/api/settings/:key', (req, res) => {
  res.json(db.getSetting(req.params.key))
})

app.post('/api/settings/:key', (req, res) => {
  db.setSetting(req.params.key, req.body.value)
  res.json({ ok: true })
})

// ─── Posters ──────────────────────────────────────────────────────────────────

// Shared helper — downloads a TMDB poster URL to disk. Returns the filename on
// success, null on failure. Safe to call concurrently; skips if already cached.
function downloadPoster(tmdbId, url) {
  return new Promise((resolve) => {
    const dest     = path.join(POSTER_DIR, `${tmdbId}.jpg`)
    const filename = `${tmdbId}.jpg`
    if (fs.existsSync(dest)) return resolve(filename)
    const file = fs.createWriteStream(dest)
    https.get(url, (httpRes) => {
      if (httpRes.statusCode !== 200) {
        file.close(); fs.unlink(dest, () => {}); return resolve(null)
      }
      httpRes.pipe(file)
      file.on('finish', () => { file.close(); resolve(filename) })
    }).on('error', () => { file.close(); fs.unlink(dest, () => {}); resolve(null) })
  })
}

// Serve a cached poster by tmdb_id
app.get('/api/posters/:tmdbId', (req, res) => {
  const filePath = path.join(POSTER_DIR, `${req.params.tmdbId}.jpg`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
  res.sendFile(filePath)
})

// Download and cache a poster from a remote URL
app.post('/api/posters/:tmdbId', (req, res) => {
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'url required' })
  downloadPoster(req.params.tmdbId, url)
    .then((filename) => filename
      ? res.json({ filename })
      : res.status(502).json({ error: 'Download failed' })
    )
})

// ─── Jellyfin ─────────────────────────────────────────────────────────────────

// Sync logic runs client-side via the Settings page (uses /api/movies + /api/settings).
// This endpoint is reserved for a future server-side trigger (e.g. cron).
app.post('/api/jellyfin/sync', (_req, res) => {
  res.json({ ok: true, message: 'Use the Settings page to trigger a sync.' })
})

// ─── eBay ─────────────────────────────────────────────────────────────────────

// All listings grouped by tmdb_id — includes the movie and the suggested query.
app.get('/api/ebay/listings', (_req, res) => {
  const movies   = db.getAllWatchedMovies()
  const all      = db.getAllEbayListings()
  const byMovie  = new Map(all.reduce((acc, l) => {
    const key = l.tmdb_id
    if (!acc.has(key)) acc.set(key, [])
    acc.get(key).push(l)
    return acc
  }, new Map()))

  const result = movies.map((movie) => {
    const listings = (byMovie.get(movie.tmdb_id) || []).sort((a, b) => {
      // Auctions ending soonest first, then FIXED_PRICE by price, then BEST_OFFER by price
      const typeOrder = { AUCTION: 0, FIXED_PRICE: 1, BEST_OFFER: 2 }
      const ta = typeOrder[a.listing_type] ?? 3
      const tb = typeOrder[b.listing_type] ?? 3
      if (ta !== tb) return ta - tb
      if (ta === 0) {
        // Both auctions — soonest end_time first
        if (a.end_time && b.end_time) return new Date(a.end_time) - new Date(b.end_time)
        return a.end_time ? -1 : 1
      }
      return (a.price ?? Infinity) - (b.price ?? Infinity)
    })
    return { movie, query: buildEbayQuery(movie), listings }
  })

  res.json(result)
})

// Listings for a single movie
app.get('/api/ebay/listings/:tmdbId', (req, res) => {
  res.json(db.getEbayListingsForMovie(Number(req.params.tmdbId)))
})

// Trigger manual poll
app.post('/api/ebay/poll', (_req, res) => {
  triggerPoll().catch((err) => console.error('[eBay poll] manual trigger failed:', err.message))
  res.json({ ok: true, message: 'Poll triggered' })
})

// Trigger a per-movie search with an optional custom query
app.post('/api/ebay/search', async (req, res) => {
  const { tmdbId, query: customQuery } = req.body
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId required' })
  const movie = db.getMovieById(Number(tmdbId))
  if (!movie) return res.status(404).json({ error: 'Movie not found' })

  try {
    const appId  = db.getSetting('ebay_app_id')
    const certId = db.getSetting('ebay_cert_id')
    if (!appId || !certId) return res.status(503).json({ error: 'eBay credentials not configured' })

    const token   = await getEbayToken(appId, certId)
    const query   = customQuery || buildEbayQuery(movie)
    const results = await searchEbayUK(query, token)

    const currentIds = []
    for (const item of results) {
      db.upsertEbayListing({ ...item, tmdb_id: movie.tmdb_id })
      currentIds.push(item.id)
    }
    db.deleteStaleListings(movie.tmdb_id, currentIds)

    res.json({ query, listings: db.getEbayListingsForMovie(movie.tmdb_id) })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// Poller status — last/next poll times, counts
app.get('/api/ebay/status', (_req, res) => {
  res.json(getPollerStatus())
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FilmVault server  →  http://0.0.0.0:${PORT}`)
  console.log(`Data directory    →  ${DATA_DIR}`)
  startPoller()
})
