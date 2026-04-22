const TMDB_BASE   = 'https://api.themoviedb.org/3'
const POSTER_BASE  = 'https://image.tmdb.org/t/p/w500'
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original'
const PROFILE_BASE  = 'https://image.tmdb.org/t/p/w185'

function posterUrl(path) {
  return path ? `${POSTER_BASE}${path}` : null
}

function profileUrl(path) {
  return path ? `${PROFILE_BASE}${path}` : null
}

function backdropUrl(path) {
  return path ? `${BACKDROP_BASE}${path}` : null
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
    imdb_id:     movie.imdb_id || null,
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

export async function searchCollections(query, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')
  if (!query.trim())              return []

  const url  = `${TMDB_BASE}/search/collection?query=${encodeURIComponent(query.trim())}&language=en-US`
  const data = await apiFetch(url, apiKey)
  return (data.results || []).slice(0, 3).map((col) => ({
    tmdb_collection_id: col.id,
    name:               col.name,
    poster_path:        posterUrl(col.poster_path),
    parts:              col.parts || [],   // TMDB doesn't include parts in search results
    part_count:         (col.parts || []).length,
  }))
}

export async function getCollectionDetails(collectionId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/collection/${collectionId}?language=en-US`
  const data = await apiFetch(url, apiKey)
  return {
    tmdb_collection_id: data.id,
    name:               data.name,
    poster_path:        posterUrl(data.poster_path),
    overview:           data.overview || '',
    parts:              (data.parts || [])
      .sort((a, b) => (a.release_date || '').localeCompare(b.release_date || ''))
      .map((p) => ({
        tmdb_id:     p.id,
        title:       p.title,
        year:        p.release_date ? parseInt(p.release_date.slice(0, 4), 10) : null,
        poster_path: posterUrl(p.poster_path),
        overview:    p.overview || '',
        popularity:  p.popularity || 0,
      })),
  }
}

export async function searchPeople(query, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')
  if (!query.trim()) return []

  const url  = `${TMDB_BASE}/search/person?query=${encodeURIComponent(query.trim())}&language=en-US&page=1`
  const data = await apiFetch(url, apiKey)
  return (data.results || []).slice(0, 4).map((p) => ({
    id:               p.id,
    name:             p.name,
    profile:          profileUrl(p.profile_path),
    known_for:        p.known_for_department || null,
    known_for_titles: (p.known_for || []).slice(0, 2).map((m) => m.title || m.name).filter(Boolean),
  }))
}

export async function getMovieDetails(tmdbId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/movie/${tmdbId}?language=en-US`
  const data = await apiFetch(url, apiKey)
  return mapDetailResult(data)
}

// Pick the best logo from TMDB's images response.
// Prefer English, then language-neutral. Prefer SVG over PNG (scales perfectly).
// Then sort by vote_average desc, vote_count desc.
function pickBestLogo(logos) {
  if (!Array.isArray(logos) || logos.length === 0) return null

  const score = (logo) => {
    let s = 0
    // Language preference: English best, null (neutral) second
    if (logo.iso_639_1 === 'en')   s += 100
    else if (logo.iso_639_1 === null || logo.iso_639_1 === '') s += 50
    // SVG scales cleanly — strong preference
    if (logo.file_path?.endsWith('.svg')) s += 30
    // Community quality signal
    s += (logo.vote_average || 0) * 2
    s += Math.min(logo.vote_count || 0, 20) * 0.1
    return s
  }

  const sorted = [...logos]
    .filter((l) => l.file_path)
    .sort((a, b) => score(b) - score(a))

  return sorted[0] || null
}

// Fetches full metadata used by the detail modal — credits, backdrop, tagline, logo.
// Uses append_to_response to do it in one request.
export async function getFullMovieDetails(tmdbId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/movie/${tmdbId}?language=en-US&append_to_response=credits,images&include_image_language=en,null`
  const data = await apiFetch(url, apiKey)

  const director = (data.credits?.crew || [])
    .find((c) => c.job === 'Director')
  const cast = (data.credits?.cast || [])
    .map((c) => ({
      id:        c.id,
      name:      c.name,
      character: c.character,
      profile:   profileUrl(c.profile_path),
    }))

  const bestLogo = pickBestLogo(data.images?.logos)
  const logo_path = bestLogo
    ? `${BACKDROP_BASE}${bestLogo.file_path}`
    : null

  return {
    backdrop_path: backdropUrl(data.backdrop_path),
    tagline:       data.tagline || null,
    director:      director
      ? JSON.stringify({ id: director.id, name: director.name, profile: profileUrl(director.profile_path) })
      : null,
    cast_json:     JSON.stringify(cast),
    logo_path,
    genres:        JSON.stringify((data.genres || []).map((g) => g.name)),
    runtime:       data.runtime || null,
    overview:      data.overview || '',
    imdb_id:       data.imdb_id || null,
  }
}

// Fetches a person's movie credits for the filmography panel.
// Returns separate cast_films (acting) and directed_films (directing only),
// both sorted chronologically oldest→newest.
export async function getPersonMovieCredits(personId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const [person, credits] = await Promise.all([
    apiFetch(`${TMDB_BASE}/person/${personId}?language=en-US`, apiKey),
    apiFetch(`${TMDB_BASE}/person/${personId}/movie_credits?language=en-US`, apiKey),
  ])

  // All acting credits, chronological oldest → newest
  const castFilms = (credits.cast || [])
    .filter((m) => m.release_date)
    .map((m) => ({
      tmdb_id:     m.id,
      title:       m.title,
      year:        parseInt(m.release_date.slice(0, 4), 10) || null,
      poster_path: posterUrl(m.poster_path),
      role:        m.character || null,
      overview:    m.overview || '',
      popularity:  m.popularity || 0,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0))

  // Directing credits only — deduplicate by tmdb_id, chronological oldest → newest
  const seen = new Set()
  const directedFilms = (credits.crew || [])
    .filter((m) => m.job === 'Director' && m.release_date && !seen.has(m.id) && seen.add(m.id))
    .map((m) => ({
      tmdb_id:     m.id,
      title:       m.title,
      year:        parseInt(m.release_date.slice(0, 4), 10) || null,
      poster_path: posterUrl(m.poster_path),
      role:        null,
      overview:    m.overview || '',
      popularity:  m.popularity || 0,
    }))
    .sort((a, b) => (a.year || 0) - (b.year || 0))

  return {
    id:             person.id,
    name:           person.name,
    profile:        profileUrl(person.profile_path),
    biography:      person.biography || '',
    birthday:       person.birthday || null,
    place:          person.place_of_birth || null,
    known_for:      person.known_for_department || null,
    cast_films:     castFilms,
    directed_films: directedFilms,
  }
}
