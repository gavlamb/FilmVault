import { getServerUrl } from './api'

export function getPosterUrl(posterPath) {
  if (!posterPath) return null

  // Already a full remote URL (TMDB or otherwise) — return as-is
  if (posterPath.startsWith('https://') || posterPath.startsWith('http://')) return posterPath

  const filename = posterPath.split('/').pop().split('\\').pop()
  const tmdbId   = filename.replace('.jpg', '')

  // Remote server mode — route through the configured server regardless of
  // whether we're in Electron or browser, so posters always come from the
  // shared server cache.
  const serverUrl = getServerUrl()
  if (serverUrl) return `${serverUrl}/api/posters/${tmdbId}`

  // Electron local mode — use the custom filmvault:// protocol
  if (typeof window !== 'undefined' && window.electronAPI) {
    return `filmvault://posters/${filename}`
  }

  // Browser mode — relative URL served by Express
  return `/api/posters/${tmdbId}`
}
