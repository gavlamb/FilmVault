import { useState, useEffect, useRef } from 'react'
import { getPersonMovieCredits } from '../utils/tmdb'
import { getSetting } from '../utils/api'

function Spinner() {
  return (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-700 border-t-indigo-400" />
  )
}

function formatBirthDate(dateStr) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

function FilmCard({ film, onClick }) {
  return (
    <button
      onClick={() => onClick(film)}
      className="group flex flex-col overflow-hidden rounded-lg bg-gray-800/40 border border-gray-700/40 text-left transition-all hover:border-gray-600/60 hover:bg-gray-800/70 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
    >
      <div className="aspect-[2/3] w-full overflow-hidden bg-gray-800">
        {film.poster_path ? (
          <img
            src={film.poster_path}
            alt={film.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-2">
        <p className="truncate text-[11px] font-semibold leading-tight text-gray-200 group-hover:text-white">
          {film.title}
        </p>
        <div className="flex items-center justify-between gap-1">
          {film.year && <span className="text-[10px] text-gray-600">{film.year}</span>}
          {film.role && (
            <span className="truncate text-[10px] text-gray-500 italic">{film.role}</span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function PersonPanel({ person, onClose, onMovieClick }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const tmdbKey = await getSetting('tmdb_api_key')
        if (!tmdbKey) throw new Error('NO_API_KEY')
        const result = await getPersonMovieCredits(person.id, tmdbKey)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [person.id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleFilmClick(film) {
    if (onMovieClick) {
      onMovieClick(film)
    } else {
      // Default: just close this panel. Future: open a new movie modal via App.
      onClose()
    }
  }

  const isDirector = data?.known_for === 'Directing'
  const films = isDirector ? (data?.directed_films || []) : (data?.cast_films || [])

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/85 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === panelRef.current) onClose() }}
    >
      <div className="flex min-h-full items-start justify-center p-4 py-8">
      <div className="relative w-full max-w-4xl rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/80">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-gray-950/60 p-2 text-gray-300 backdrop-blur transition-colors hover:bg-gray-900 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:p-8">
          {/* Headshot */}
          <div className="flex-shrink-0">
            <div className="h-40 w-40 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-xl shadow-black/60 sm:h-48 sm:w-48">
              {loading ? (
                <div className="flex h-full w-full items-center justify-center">
                  <Spinner />
                </div>
              ) : data?.profile ? (
                <img
                  src={data.profile}
                  alt={data.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-700 to-gray-800 text-3xl font-semibold text-gray-400">
                  {person.name?.split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
                {person.name}
              </h2>
              {data?.known_for && (
                <p className="mt-1 text-sm text-indigo-400">{data.known_for}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                {data?.birthday && <span>Born {formatBirthDate(data.birthday)}</span>}
                {data?.place && (
                  <>
                    <span className="text-gray-700">•</span>
                    <span>{data.place}</span>
                  </>
                )}
              </div>
            </div>

            {data?.biography && (
              <p className="text-sm leading-relaxed text-gray-300">
                {data.biography}
              </p>
            )}

            {error && !loading && (
              <p className="text-sm text-red-400">
                Couldn't load details. Check your TMDB API key.
              </p>
            )}
          </div>
        </div>

        {/* Filmography */}
        <div className="border-t border-gray-800/60 px-6 py-5 sm:px-8">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {isDirector ? 'Directed' : 'Acting Credits'}
            </p>
            {films.length > 0 && (
              <p className="text-[11px] text-gray-600">
                {films.length} {films.length === 1 ? 'film' : 'films'}
              </p>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : films.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-600">No films found</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {films.map((film) => (
                <FilmCard
                  key={`${film.tmdb_id}-${film.role}`}
                  film={film}
                  onClick={handleFilmClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  )
}
