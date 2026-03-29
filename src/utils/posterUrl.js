export function getPosterUrl(posterPath) {
  if (!posterPath) return null

  // Already a TMDB URL — return as-is
  if (posterPath.startsWith('https://')) return posterPath

  // Get the filename (tmdb_id.jpg)
  const filename = posterPath.split('/').pop().split('\\').pop()
  const tmdbId   = filename.replace('.jpg', '')

  // In Electron — use filmvault:// protocol
  if (typeof window !== 'undefined' && window.electronAPI) {
    return `filmvault://posters/${filename}`
  }

  // In browser — use Express API route
  return `/api/posters/${tmdbId}`
}
