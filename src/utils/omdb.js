const OMDB_BASE = 'https://www.omdbapi.com'

/**
 * Fetch the IMDb rating for a movie using its IMDb ID.
 * Returns { imdbRating, imdbVotes } or null on any failure.
 */
export async function getIMDbRating(imdbId, apiKey) {
  if (!apiKey || !imdbId) return null
  try {
    const res = await fetch(
      `${OMDB_BASE}/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(apiKey)}`
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data.Response === 'False') return null
    return {
      imdbRating: data.imdbRating !== 'N/A' ? data.imdbRating : null,
      imdbVotes:  data.imdbVotes  !== 'N/A' ? data.imdbVotes  : null,
    }
  } catch {
    return null
  }
}
