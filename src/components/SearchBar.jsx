import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { searchMovies as searchTmdb, searchCollections, searchPeople } from '../utils/tmdb'
import StatusBadge from './StatusBadge'
import { getSetting, searchMovies as searchLibrary } from '../utils/api'
import { getPosterUrl } from '../utils/posterUrl'

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function Spinner() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-gray-700 border-t-indigo-400 animate-spin" />
  )
}

function FilmIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-900/60 border-b border-gray-800/60">
      {children}
    </div>
  )
}

export default function SearchBar({ onMovieSelect, onCollectionSelect, onPersonSelect, onQueryChange }) {
  const [query,          setQuery]          = useState('')
  const [libraryResults, setLibraryResults] = useState([])
  const [results,        setResults]        = useState([])
  const [collections,    setCollections]    = useState([])
  const [people,         setPeople]         = useState([])
  const [isLoading,      setIsLoading]      = useState(false)
  const [isOpen,         setIsOpen]         = useState(false)
  const [apiKey,         setApiKey]         = useState(null)   // null = not yet loaded
  const [error,          setError]          = useState(null)
  const [dropdownRect,   setDropdownRect]   = useState(null)

  const containerRef = useRef(null)
  const inputRef     = useRef(null)
  const dropdownRef  = useRef(null)
  const debouncedQuery = useDebounce(query, 400)

  // Load API key once on mount
  useEffect(() => {
    getSetting('tmdb_api_key').then((key) => {
      setApiKey(key || '')
    })
  }, [])

  // Notify parent of raw query for live grid filtering
  useEffect(() => {
    onQueryChange?.(query)
  }, [query])

  // Run search when debounced query or apiKey changes
  useEffect(() => {
    if (apiKey === null) return          // not loaded yet
    if (!debouncedQuery.trim()) {
      setResults([])
      setCollections([])
      setLibraryResults([])
      setPeople([])
      setIsOpen(false)
      setError(null)
      return
    }

    setIsOpen(true)
    setError(null)
    setIsLoading(true)

    let cancelled = false

    // Library search always runs — no API key required
    const libPromise = searchLibrary(debouncedQuery)
      .then((r) => r.slice(0, 4))
      .catch(() => [])

    // TMDB search only if API key is set; capture error without rejecting
    let tmdbErr = null
    const tmdbPromise = apiKey
      ? Promise.all([
          searchTmdb(debouncedQuery, apiKey),
          searchCollections(debouncedQuery, apiKey),
          searchPeople(debouncedQuery, apiKey),
        ]).catch((err) => { tmdbErr = err; return [[], [], []] })
      : Promise.resolve([[], [], []])

    Promise.all([libPromise, tmdbPromise])
      .then(([libResults, [movies, cols, persons]]) => {
        if (cancelled) return
        const libIds = new Set(libResults.map((m) => m.tmdb_id))
        setLibraryResults(libResults)
        setResults(movies.filter((m) => !libIds.has(m.tmdb_id)).slice(0, 6))
        setCollections(cols)
        setPeople(persons)
        setIsLoading(false)
        if (tmdbErr) {
          if (tmdbErr.message === 'INVALID_API_KEY') {
            setError('Invalid TMDB API key. Check your Settings.')
          } else if (tmdbErr.message !== 'NO_API_KEY') {
            setError('Network error — check your connection.')
          }
        }
      })

    return () => { cancelled = true }
  }, [debouncedQuery, apiKey])

  // Measure input position for portal positioning
  useEffect(() => {
    if (!isOpen) return
    function measure() {
      if (inputRef.current) setDropdownRect(inputRef.current.getBoundingClientRect())
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [isOpen])

  // Close on click outside (portal dropdown lives outside containerRef)
  useEffect(() => {
    function onMouseDown(e) {
      const inContainer = containerRef.current?.contains(e.target)
      const inDropdown  = dropdownRef.current?.contains(e.target)
      if (!inContainer && !inDropdown) setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  function clearSearch() {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setLibraryResults([])
    setCollections([])
    setPeople([])
    onQueryChange?.('')
    inputRef.current?.blur()
  }

  function handleSelect(movie) {
    clearSearch()
    onMovieSelect(movie)
  }

  function handleCollectionSelect(col) {
    clearSearch()
    onCollectionSelect(col)
  }

  function handlePersonSelect(person) {
    clearSearch()
    onPersonSelect?.(person)
  }

  const showDropdown = isOpen && query.trim().length > 0
  const hasLibrary   = libraryResults.length > 0
  const hasPeople    = people.length > 0
  const hasTmdb      = results.length > 0 || collections.length > 0

  const dropdown = showDropdown && dropdownRect && createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={() => setIsOpen(false)}
      />

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top:   dropdownRect.bottom + 6,
          left:  dropdownRect.left,
          width: dropdownRect.width,
          zIndex: 9999,
        }}
        className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl shadow-black/70"
      >
        {/* Loading */}
        {isLoading && (
          <div className="px-4 py-3.5 text-sm text-gray-500">Searching…</div>
        )}

        {/* No API key warning (only shown when no library results either) */}
        {!isLoading && !apiKey && !hasLibrary && (
          <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm text-gray-400">
            <svg className="w-4 h-4 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Add your TMDB API key in Settings to search movies
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm text-red-400">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* No results at all */}
        {!isLoading && !error && !hasLibrary && !hasPeople && !hasTmdb && debouncedQuery.trim() && (
          <div className="px-4 py-3.5 text-sm text-gray-500">
            No results for <span className="text-gray-300">"{debouncedQuery}"</span>
          </div>
        )}

        {/* Results */}
        {!isLoading && (hasLibrary || hasPeople || hasTmdb) && (
          <ul className="max-h-[480px] overflow-y-auto">

            {/* ── In Your Library ─────────────────────────────────────── */}
            {hasLibrary && (
              <>
                <SectionLabel>In Your Library</SectionLabel>
                {libraryResults.map((movie) => (
                  <li
                    key={`lib-${movie.tmdb_id}`}
                    onMouseDown={() => handleSelect(movie)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/70 cursor-pointer transition-colors group divide-y divide-gray-800/60"
                  >
                    <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                      {getPosterUrl(movie.poster_path) ? (
                        <img src={getPosterUrl(movie.poster_path)} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><FilmIcon /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                        {movie.title}
                      </p>
                      {movie.year && <p className="text-xs text-gray-500 mt-0.5">{movie.year}</p>}
                    </div>
                    <StatusBadge status={movie.status} size="sm" />
                  </li>
                ))}
              </>
            )}

            {/* ── People ──────────────────────────────────────────────── */}
            {hasPeople && (
              <>
                {hasLibrary && <div className="border-t border-gray-700/60" />}
                <SectionLabel>People</SectionLabel>
                {people.map((person) => (
                  <li
                    key={`person-${person.id}`}
                    onMouseDown={() => handlePersonSelect(person)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/70 cursor-pointer transition-colors group"
                  >
                    {/* Headshot */}
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gray-800 border border-gray-700/60">
                      {person.profile ? (
                        <img src={person.profile} alt={person.name} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-gray-500">
                          {person.name.split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                        {person.name}
                      </p>
                      {person.known_for_titles.length > 0 && (
                        <p className="truncate text-xs text-gray-500 mt-0.5">
                          {person.known_for_titles.join(' · ')}
                        </p>
                      )}
                    </div>
                    {person.known_for && (
                      <span className="flex-shrink-0 text-[10px] font-medium text-gray-600">
                        {person.known_for}
                      </span>
                    )}
                  </li>
                ))}
              </>
            )}

            {/* Divider between people/library and TMDB movies */}
            {(hasLibrary || hasPeople) && hasTmdb && (
              <div className="border-t border-gray-700/60" />
            )}

            {/* ── From TMDB ───────────────────────────────────────────── */}
            {hasTmdb && (
              <>
                {(hasLibrary || hasPeople) && <SectionLabel>From TMDB</SectionLabel>}

                {/* Collections */}
                {collections.map((col) => (
                  <li
                    key={`col-${col.tmdb_collection_id}`}
                    onMouseDown={() => handleCollectionSelect(col)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/70 cursor-pointer transition-colors group"
                  >
                    <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                      {col.poster_path ? (
                        <img src={col.poster_path} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><FilmIcon /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white group-hover:text-teal-200 transition-colors">
                        {col.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Collection</p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-teal-500/40 bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-teal-400 whitespace-nowrap flex-shrink-0">
                      Collection
                    </span>
                  </li>
                ))}

                {/* TMDB movies */}
                {results.map((movie) => (
                  <li
                    key={movie.tmdb_id}
                    onMouseDown={() => handleSelect(movie)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800/70 cursor-pointer transition-colors group"
                  >
                    <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                      {movie.poster_path ? (
                        <img src={movie.poster_path} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><FilmIcon /></div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                        {movie.title}
                      </p>
                      {movie.year && <p className="text-xs text-gray-500 mt-0.5">{movie.year}</p>}
                    </div>
                  </li>
                ))}
              </>
            )}
          </ul>
        )}

        {/* Footer attribution */}
        {(hasTmdb || hasPeople) && (
          <div className="border-t border-gray-800 px-3 py-1.5 text-right">
            <span className="text-[10px] text-gray-600">Powered by TMDB</span>
          </div>
        )}
      </div>
    </>,
    document.body
  )

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
          placeholder="Search movies…"
          className="
            w-full rounded-lg border border-gray-700 bg-gray-900
            py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-500
            focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
            transition-colors
          "
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Spinner />
          ) : query.length > 0 ? (
            <button
              onClick={() => { clearSearch(); inputRef.current?.focus() }}
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {dropdown}
    </div>
  )
}
