const express = require('express')
const path    = require('path')
const fs      = require('fs')
const os      = require('os')
const https   = require('https')

// Must be set before requiring database so it skips the Electron app.getPath() call
process.env.FILMVAULT_DATA = process.env.FILMVAULT_DATA
  || path.join(os.homedir(), '.filmvault')

const db         = require('../electron/database')
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

// Must be before /api/movies/:id so "status" isn't matched as an id
app.get('/api/movies/status/:status', (req, res) => {
  res.json(db.getMoviesByStatus(req.params.status))
})

app.get('/api/movies/:id', (req, res) => {
  const movie = db.getMovieById(Number(req.params.id))
  movie ? res.json(movie) : res.status(404).json({ error: 'Not found' })
})

app.post('/api/movies', (req, res) => {
  res.json(db.addMovie(req.body))
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

  const dest     = path.join(POSTER_DIR, `${req.params.tmdbId}.jpg`)
  const filename = `${req.params.tmdbId}.jpg`

  if (fs.existsSync(dest)) return res.json({ filename })

  const file = fs.createWriteStream(dest)
  https.get(url, (httpRes) => {
    if (httpRes.statusCode !== 200) {
      file.close()
      fs.unlink(dest, () => {})
      return res.status(502).json({ error: `Upstream ${httpRes.statusCode}` })
    }
    httpRes.pipe(file)
    file.on('finish', () => { file.close(); res.json({ filename }) })
  }).on('error', (err) => {
    file.close()
    fs.unlink(dest, () => {})
    res.status(502).json({ error: err.message })
  })
})

// ─── Jellyfin ─────────────────────────────────────────────────────────────────

// Sync logic runs client-side via the Settings page (uses /api/movies + /api/settings).
// This endpoint is reserved for a future server-side trigger (e.g. cron).
app.post('/api/jellyfin/sync', (_req, res) => {
  res.json({ ok: true, message: 'Use the Settings page to trigger a sync.' })
})

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`FilmVault server  →  http://localhost:${PORT}`)
  console.log(`Data directory    →  ${DATA_DIR}`)
})
