/**
 * Unified API layer — three modes, evaluated per-call:
 *
 * 1. Remote server  — localStorage has 'filmvault_server_url' OR Electron's
 *                     preload injected window.electronAPI.serverUrl
 *                     → fetch() to that base URL
 * 2. Electron IPC   — window.electronAPI exists, no server URL configured
 *                     → IPC bridge (local SQLite)
 * 3. Browser        — no window.electronAPI
 *                     → fetch() to relative paths (served by Express)
 */

// Returns the configured remote server URL, or null if local mode.
// Checked on every call so Settings changes take effect without a reload.
export function getServerUrl() {
  try {
    const lsUrl = typeof localStorage !== 'undefined'
      ? localStorage.getItem('filmvault_server_url')
      : null
    if (lsUrl) return lsUrl
    // Injected by Electron main.js when it loaded a server URL directly
    return (typeof window !== 'undefined' && window.electronAPI?.serverUrl) || null
  } catch {
    return null
  }
}

// True only when running in Electron with no remote server configured.
const _hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI
function shouldUseIpc() {
  return _hasElectronAPI && !getServerUrl()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const base = getServerUrl() || ''
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${options.method || 'GET'} ${path} → ${res.status}`)
  return res.json()
}

// ─── Movies ───────────────────────────────────────────────────────────────────

export function getAllMovies() {
  if (shouldUseIpc()) return window.electronAPI.getAllMovies()
  return apiFetch('/api/movies')
}

export function getMovieById(tmdbId) {
  if (shouldUseIpc()) return window.electronAPI.getMovieById(tmdbId)
  return apiFetch(`/api/movies/${tmdbId}`).catch(() => null)
}

export function addMovie(movie) {
  if (shouldUseIpc()) return window.electronAPI.addMovie(movie)
  return apiFetch('/api/movies', { method: 'POST', body: movie })
}

export function updateMovie(tmdbId, movie) {
  if (shouldUseIpc()) return window.electronAPI.updateMovie(tmdbId, movie)
  return apiFetch(`/api/movies/${tmdbId}`, { method: 'PUT', body: movie })
}

export function deleteMovie(tmdbId) {
  if (shouldUseIpc()) return window.electronAPI.deleteMovie(tmdbId)
  return apiFetch(`/api/movies/${tmdbId}`, { method: 'DELETE' })
}

export function searchMovies(query) {
  if (shouldUseIpc()) return window.electronAPI.searchMovies(query)
  return apiFetch(`/api/movies/search?q=${encodeURIComponent(query)}`)
}

export function getMoviesByStatus(status) {
  if (shouldUseIpc()) return window.electronAPI.getMoviesByStatus(status)
  return apiFetch(`/api/movies/status/${status}`)
}

export function updateMovieTmdbData(oldId, newId, posterPath) {
  if (shouldUseIpc()) return window.electronAPI.updateMovieTmdbData(oldId, newId, posterPath)
  return apiFetch(`/api/movies/${oldId}/tmdb`, { method: 'PUT', body: { newId, posterPath } })
}

// ─── Posters ──────────────────────────────────────────────────────────────────

export function cachePoster(url, tmdbId) {
  if (shouldUseIpc()) return window.electronAPI.cachePoster(url, tmdbId)
  // Server-side download and cache
  return apiFetch(`/api/posters/${tmdbId}`, { method: 'POST', body: { url } })
    .then((data) => data.filename)
}

export function updateMovieRating(tmdbId, imdbRating, imdbVotes) {
  if (shouldUseIpc()) return window.electronAPI.updateMovieRating(tmdbId, imdbRating, imdbVotes)
  return apiFetch(`/api/movies/${tmdbId}/rating`, { method: 'PATCH', body: { imdbRating, imdbVotes } })
}

export function updateMoviePoster(tmdbId, posterPath) {
  if (shouldUseIpc()) return window.electronAPI.updateMoviePoster(tmdbId, posterPath)
  return apiFetch(`/api/movies/${tmdbId}/poster`, { method: 'PATCH', body: { posterPath } })
}

// ─── Collections ──────────────────────────────────────────────────────────────

export function getAllCollections() {
  if (shouldUseIpc()) return window.electronAPI.getAllCollections()
  return apiFetch('/api/collections')
}

export function addCollection(collection) {
  if (shouldUseIpc()) return window.electronAPI.addCollection(collection)
  return apiFetch('/api/collections', { method: 'POST', body: collection })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key) {
  if (shouldUseIpc()) return window.electronAPI.getSetting(key)
  return apiFetch(`/api/settings/${key}`)
}

export function setSetting(key, value) {
  if (shouldUseIpc()) return window.electronAPI.setSetting(key, value)
  return apiFetch(`/api/settings/${key}`, { method: 'POST', body: { value } })
}

export function getAllSettings() {
  if (shouldUseIpc()) return window.electronAPI.getAllSettings()
  return apiFetch('/api/settings')
}

// ─── eBay (server-only — no IPC path) ────────────────────────────────────────
// eBay runs on the mini PC server. These always go via HTTP regardless of mode.

export function getEbayListings() {
  return apiFetch('/api/ebay/listings')
}

export function getEbayListingsForMovie(tmdbId) {
  return apiFetch(`/api/ebay/listings/${tmdbId}`)
}

export function triggerEbayPoll() {
  return apiFetch('/api/ebay/poll', { method: 'POST' })
}

export function searchEbayForMovie(tmdbId, query) {
  return apiFetch('/api/ebay/search', { method: 'POST', body: { tmdbId, query } })
}

export function getEbayStatus() {
  return apiFetch('/api/ebay/status')
}

// ─── File export (Electron-only features with browser fallbacks) ───────────────

export async function showSaveDialog(options) {
  if (shouldUseIpc()) return window.electronAPI.showSaveDialog(options)
  return { canceled: false, filePath: options.defaultPath || 'export' }
}

export async function writeFile(filePath, content) {
  if (shouldUseIpc()) return window.electronAPI.writeFile(filePath, content)
  const filename = filePath.split('/').pop().split('\\').pop()
  const blob     = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url      = URL.createObjectURL(blob)
  const a        = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
