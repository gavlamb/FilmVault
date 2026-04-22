const OMDB_BASE = 'https://www.omdbapi.com'

/**
 * Fetch the IMDb rating for a movie using its IMDb ID.
 * Returns { imdbRating, imdbVotes } on success.
 * Returns null when the movie has no rating (normal case).
 * Throws on rate-limit or invalid-key errors so the caller can react.
 */
export async function getIMDbRating(imdbId, apiKey) {
  if (!apiKey || !imdbId) return null

  let res
  try {
    res = await fetch(
      `${OMDB_BASE}/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(apiKey)}`
    )
  } catch (err) {
    console.warn('[OMDB] Network error:', err.message)
    return null
  }

  if (!res.ok) {
    console.warn(`[OMDB] HTTP ${res.status} for ${imdbId}`)
    return null
  }

  const data = await res.json().catch(() => null)
  if (!data) {
    console.warn(`[OMDB] Bad JSON response for ${imdbId}`)
    return null
  }

  if (data.Response === 'False') {
    // Treat rate-limit and invalid-key errors as throwable so callers can halt
    if (/limit/i.test(data.Error || '') || /invalid api key/i.test(data.Error || '')) {
      throw new Error(`OMDB: ${data.Error}`)
    }
    // Genuine "not found" — just return null
    return null
  }

  return {
    imdbRating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null,
    imdbVotes:  data.imdbVotes  && data.imdbVotes  !== 'N/A' ? data.imdbVotes  : null,
  }
}
