/**
 * Unified API layer.
 *
 * Electron mode  — window.electronAPI exists → uses IPC bridge directly.
 * Server mode    — no window.electronAPI → uses fetch() against the Express REST API.
 *
 * All exports mirror window.electronAPI so components never need to know
 * which mode they're running in.
 */

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) throw new Error(`API ${options.method || 'GET'} ${path} → ${res.status}`)
  return res.json()
}

// ─── Movies ───────────────────────────────────────────────────────────────────

export function getAllMovies() {
  if (isElectron) return window.electronAPI.getAllMovies()
  return apiFetch('/api/movies')
}

export function getMovieById(tmdbId) {
  if (isElectron) return window.electronAPI.getMovieById(tmdbId)
  return apiFetch(`/api/movies/${tmdbId}`).catch(() => null)
}

export function addMovie(movie) {
  if (isElectron) return window.electronAPI.addMovie(movie)
  return apiFetch('/api/movies', { method: 'POST', body: movie })
}

export function updateMovie(tmdbId, movie) {
  if (isElectron) return window.electronAPI.updateMovie(tmdbId, movie)
  return apiFetch(`/api/movies/${tmdbId}`, { method: 'PUT', body: movie })
}

export function deleteMovie(tmdbId) {
  if (isElectron) return window.electronAPI.deleteMovie(tmdbId)
  return apiFetch(`/api/movies/${tmdbId}`, { method: 'DELETE' })
}

export function getMoviesByStatus(status) {
  if (isElectron) return window.electronAPI.getMoviesByStatus(status)
  return apiFetch(`/api/movies/status/${status}`)
}

export function updateMovieTmdbData(oldId, newId, posterPath) {
  if (isElectron) return window.electronAPI.updateMovieTmdbData(oldId, newId, posterPath)
  return apiFetch(`/api/movies/${oldId}/tmdb`, { method: 'PUT', body: { newId, posterPath } })
}

// ─── Posters ──────────────────────────────────────────────────────────────────

export function cachePoster(url, tmdbId) {
  if (isElectron) return window.electronAPI.cachePoster(url, tmdbId)
  // Server is always online — download the poster server-side
  return apiFetch(`/api/posters/${tmdbId}`, { method: 'POST', body: { url } })
    .then((data) => data.filename)
}

export function updateMoviePoster(tmdbId, posterPath) {
  if (isElectron) return window.electronAPI.updateMoviePoster(tmdbId, posterPath)
  return apiFetch(`/api/movies/${tmdbId}/poster`, { method: 'PATCH', body: { posterPath } })
}

// ─── Collections ──────────────────────────────────────────────────────────────

export function getAllCollections() {
  if (isElectron) return window.electronAPI.getAllCollections()
  return apiFetch('/api/collections')
}

export function addCollection(collection) {
  if (isElectron) return window.electronAPI.addCollection(collection)
  return apiFetch('/api/collections', { method: 'POST', body: collection })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key) {
  if (isElectron) return window.electronAPI.getSetting(key)
  return apiFetch(`/api/settings/${key}`)
}

export function setSetting(key, value) {
  if (isElectron) return window.electronAPI.setSetting(key, value)
  return apiFetch(`/api/settings/${key}`, { method: 'POST', body: { value } })
}

export function getAllSettings() {
  if (isElectron) return window.electronAPI.getAllSettings()
  return apiFetch('/api/settings')
}

// ─── File export (Electron-only features with browser fallbacks) ───────────────

export async function showSaveDialog(options) {
  if (isElectron) return window.electronAPI.showSaveDialog(options)
  // Browser mode: skip the native dialog, return the default filename as the path
  return { canceled: false, filePath: options.defaultPath || 'export' }
}

export async function writeFile(filePath, content) {
  if (isElectron) return window.electronAPI.writeFile(filePath, content)
  // Browser mode: trigger a download
  const filename = filePath.split('/').pop().split('\\').pop()
  const blob     = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url      = URL.createObjectURL(blob)
  const a        = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
