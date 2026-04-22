/**
 * Metadata backfill — one-shot sweep that populates cached TMDB metadata
 * (backdrop, logo, director, cast, tagline, genres, runtime) for any movie
 * in the library that hasn't yet had it fetched.
 *
 * Runs automatically on startup if there's work to do. Polite rate: 250ms
 * between requests (~4/sec, well within TMDB's 50/sec limit).
 */

const https = require('https')
const db    = require('../../electron/database')

const TMDB_HOST     = 'api.themoviedb.org'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original'
const PROFILE_BASE  = 'https://image.tmdb.org/t/p/w185'

function profileUrl(p) { return p ? `${PROFILE_BASE}${p}` : null }
function backdropUrl(p) { return p ? `${BACKDROP_BASE}${p}` : null }

// Mirror of pickBestLogo in src/utils/tmdb.js.
// Prefer English → neutral. Prefer SVG over raster. Sort by vote.
function pickBestLogo(logos) {
  if (!Array.isArray(logos) || logos.length === 0) return null
  const score = (l) => {
    let s = 0
    if (l.iso_639_1 === 'en') s += 100
    else if (l.iso_639_1 === null || l.iso_639_1 === '') s += 50
    if (l.file_path?.endsWith('.svg')) s += 30
    s += (l.vote_average || 0) * 2
    s += Math.min(l.vote_count || 0, 20) * 0.1
    return s
  }
  const sorted = [...logos].filter((l) => l.file_path).sort((a, b) => score(b) - score(a))
  return sorted[0] || null
}

function httpsGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: TMDB_HOST,
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
      },
      (res) => {
        let raw = ''
        res.on('data', (c) => { raw += c })
        res.on('end', () => {
          if (res.statusCode === 401) return reject(new Error('INVALID_API_KEY'))
          if (res.statusCode !== 200) return reject(new Error(`TMDB_${res.statusCode}`))
          try { resolve(JSON.parse(raw)) } catch { reject(new Error('Bad JSON')) }
        })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

async function fetchFullMetadata(tmdbId, apiKey) {
  const path = `/3/movie/${tmdbId}?language=en-US&append_to_response=credits,images&include_image_language=en,null`
  const data = await httpsGet(path, apiKey)

  const director = (data.credits?.crew || []).find((c) => c.job === 'Director')
  const cast = (data.credits?.cast || [])
    .map((c) => ({
      id:        c.id,
      name:      c.name,
      character: c.character,
      profile:   profileUrl(c.profile_path),
    }))

  const bestLogo = pickBestLogo(data.images?.logos)

  return {
    backdrop_path: backdropUrl(data.backdrop_path),
    tagline:       data.tagline || null,
    director:      director
      ? JSON.stringify({ id: director.id, name: director.name, profile: profileUrl(director.profile_path) })
      : null,
    cast_json:     JSON.stringify(cast),
    logo_path:     bestLogo ? `${BACKDROP_BASE}${bestLogo.file_path}` : null,
    genres:        JSON.stringify((data.genres || []).map((g) => g.name)),
    runtime:       data.runtime || null,
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function runBackfill() {
  const apiKey = db.getSetting('tmdb_api_key')
  if (!apiKey) {
    console.log('[Metadata backfill] No TMDB API key — skipping')
    return
  }

  const allMovies = db.getAllMovies()
  const pending   = allMovies.filter((m) => !m.metadata_fetched_at)

  if (pending.length === 0) {
    console.log('[Metadata backfill] Nothing to do — all movies cached')
    return
  }

  console.log(`[Metadata backfill] Backfilling ${pending.length} movie(s)…`)
  let done = 0
  let failed = 0

  for (const movie of pending) {
    try {
      const metadata = await fetchFullMetadata(movie.tmdb_id, apiKey)
      db.updateMovieMetadata(movie.tmdb_id, metadata)
      done++
      if (done % 10 === 0) {
        console.log(`[Metadata backfill]   ${done}/${pending.length} done…`)
      }
    } catch (err) {
      failed++
      console.error(`[Metadata backfill]   Failed "${movie.title}" (${movie.tmdb_id}): ${err.message}`)
    }
    await sleep(250)  // polite: ~4 req/sec
  }

  console.log(`[Metadata backfill] Complete — ${done} succeeded, ${failed} failed`)
}

// Start backfill 15s after server boot to avoid blocking startup
function startBackfill() {
  setTimeout(() => {
    runBackfill().catch((err) => {
      console.error('[Metadata backfill] Fatal error:', err.message)
    })
  }, 15_000)
}

module.exports = { startBackfill, runBackfill }
