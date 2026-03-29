const TMDB_BASE  = 'https://api.themoviedb.org/3'
const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'

function posterUrl(path) {
  return path ? `${POSTER_BASE}${path}` : null
}

function mapSearchResult(movie) {
  return {
    tmdb_id:     movie.id,
    title:       movie.title,
    year:        movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null,
    poster_path: posterUrl(movie.poster_path),
    overview:    movie.overview || '',
    popularity:  movie.popularity || 0,
    genres:      '[]',   // search endpoint doesn't return genres; filled by getMovieDetails
    runtime:     null,   // search endpoint doesn't return runtime; filled by getMovieDetails
  }
}

function mapDetailResult(movie) {
  return {
    tmdb_id:     movie.id,
    title:       movie.title,
    year:        movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null,
    poster_path: posterUrl(movie.poster_path),
    overview:    movie.overview || '',
    genres:      JSON.stringify((movie.genres || []).map((g) => g.name)),
    runtime:     movie.runtime || null,
  }
}

async function apiFetch(url, apiKey) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401) throw new Error('INVALID_API_KEY')
  if (!res.ok)            throw new Error(`TMDB_ERROR:${res.status}`)
  return res.json()
}

export async function searchMovies(query, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')
  if (!query.trim())              return []

  const q1 = query.trim()
  const q2 = q1.replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const q3 = q1.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s{2,}/g, ' ').trim()
  const q4 = q1.replace(/[^a-zA-Z0-9]/g, '')   // collapse everything: "wall-e"/"wall e" → "walle"

  const unique  = [...new Set([q1, q2, q3, q4].filter(Boolean))]
  // Fetch pages 1 + 2 for each variant — TMDB ranks some well-known titles
  // (e.g. WALL·E) past position 20 for short/punctuated queries.
  const fetches = unique.flatMap((q) =>
    [1, 2].map((page) => {
      const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(q)}&language=en-US&page=${page}`
      return apiFetch(url, apiKey).then((data) => (data.results || []).map(mapSearchResult))
    })
  )

  const resultSets = await Promise.all(fetches)
  const seen       = new Set()
  const merged     = []
  for (const set of resultSets) {
    for (const movie of set) {
      if (!seen.has(movie.tmdb_id)) {
        seen.add(movie.tmdb_id)
        merged.push(movie)
      }
    }
  }
  merged.sort((a, b) => b.popularity - a.popularity)
  return merged.slice(0, 8)
}

export async function getMovieDetails(tmdbId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/movie/${tmdbId}?language=en-US`
  const data = await apiFetch(url, apiKey)
  return mapDetailResult(data)
}
