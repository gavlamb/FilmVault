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

  const url  = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&language=en-US&page=1`
  const data = await apiFetch(url, apiKey)
  return (data.results || []).slice(0, 8).map(mapSearchResult)
}

export async function getMovieDetails(tmdbId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/movie/${tmdbId}?language=en-US`
  const data = await apiFetch(url, apiKey)
  return mapDetailResult(data)
}
