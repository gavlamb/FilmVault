export function getPosterUrl(posterPath) {
  if (!posterPath) return null
  // Already a filmvault:// URL
  if (posterPath.startsWith('filmvault://')) return posterPath
  // Stale file:// path or bare filename — convert to filmvault:// protocol
  if (posterPath.startsWith('file://') || posterPath.includes('posters/') || posterPath.match(/^\d+\.jpg$/)) {
    const filename = posterPath.split('/').pop().split('\\').pop()
    return `filmvault://posters/${filename}`
  }
  // TMDB URL — return as-is
  return posterPath
}
