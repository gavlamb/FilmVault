import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { searchMovies, searchCollections } from '../utils/tmdb'
import StatusBadge from './StatusBadge'

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

export default function SearchBar({ onMovieSelect, onCollectionSelect }) {
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState([])
  const [collections,   setCollections]   = useState([])
  const [isLoading,     setIsLoading]     = useState(false)
  const [isOpen,        setIsOpen]        = useState(false)
  const [apiKey,        setApiKey]        = useState(null)   // null = not yet loaded
  const [error,         setError]         = useState(null)
  const [statusCache,   setStatusCache]   = useState({})     // { [tmdb_id]: status | '__none__' }
  const [dropdownRect,  setDropdownRect]  = useState(null)

  const containerRef = useRef(null)
  const inputRef     = useRef(null)
  const dropdownRef  = useRef(null)   // portal dropdown container
  const debouncedQuery = useDebounce(query, 400)

  // Load API key once on mount
  useEffect(() => {
    window.electronAPI.getSetting('tmdb_api_key').then((key) => {
      setApiKey(key || '')
    })
  }, [])

  // Run search when debounced query or apiKey changes
  useEffect(() => {
    if (apiKey === null) return          // not loaded yet
    if (!debouncedQuery.trim()) {
      setResults([])
      setCollections([])
      setIsOpen(false)
      setError(null)
      return
    }

    setIsOpen(true)
    setError(null)

    if (!apiKey) return                  // key empty — dropdown shows warning, no fetch

    let cancelled = false
    setIsLoading(true)

    Promise.all([
      searchMovies(debouncedQuery, apiKey),
      searchCollections(debouncedQuery, apiKey),
    ])
      .then(([movies, cols]) => {
        if (cancelled) return
        setResults(movies)
        setCollections(cols)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setIsLoading(false)
        setResults([])
        setCollections([])
        if (err.message === 'INVALID_API_KEY') {
          setError('Invalid TMDB API key. Check your Settings.')
        } else if (err.message === 'NO_API_KEY') {
          setError(null)   // handled separately
        } else {
          setError('Network error — check your connection.')
        }
      })

    return () => { cancelled = true }
  }, [debouncedQuery, apiKey])

  // Measure input position whenever dropdown opens or window resizes
  useEffect(() => {
    if (!isOpen) return
    function measure() {
      if (inputRef.current) {
        setDropdownRect(inputRef.current.getBoundingClientRect())
      }
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [isOpen])

  // Close on click outside — must exclude the portal dropdown (it lives outside containerRef)
  useEffect(() => {
    function onMouseDown(e) {
      const inContainer = containerRef.current?.contains(e.target)
      const inDropdown  = dropdownRef.current?.contains(e.target)
      if (!inContainer && !inDropdown) setIsOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Fetch DB status on hover — cached so it only calls once per tmdb_id per session
  async function handleHover(tmdbId) {
    if (tmdbId in statusCache) return
    const movie = await window.electronAPI.getMovieById(tmdbId)
    setStatusCache((prev) => ({
      ...prev,
      [tmdbId]: movie ? movie.status : '__none__',
    }))
  }

  function handleSelect(movie) {
    console.log('[SearchBar] onMovieSelect called:', movie.title, movie.tmdb_id)
    setIsOpen(false)
    setQuery('')
    setResults([])
    setCollections([])
    setStatusCache({})
    onMovieSelect(movie)
    inputRef.current?.blur()
  }

  function handleCollectionSelect(col) {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setCollections([])
    setStatusCache({})
    onCollectionSelect(col)
    inputRef.current?.blur()
  }

  const showDropdown = isOpen && query.trim().length > 0

  const dropdown = showDropdown && dropdownRect && createPortal(
    <>
      {/* Backdrop — blocks library clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={() => setIsOpen(false)}
      />

      {/* Dropdown — portalled to document.body, positioned via getBoundingClientRect */}
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
        {/* No API key */}
        {!apiKey && (
          <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm text-gray-400">
            <svg className="w-4 h-4 flex-shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Add your TMDB API key in Settings to search movies
          </div>
        )}

        {/* Error state */}
        {apiKey && error && (
          <div className="flex items-center gap-2.5 px-4 py-3.5 text-sm text-red-400">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Loading */}
        {apiKey && isLoading && (
          <div className="px-4 py-3.5 text-sm text-gray-500">Searching…</div>
        )}

        {/* No results */}
        {apiKey && !isLoading && !error && results.length === 0 && collections.length === 0 && debouncedQuery.trim() && (
          <div className="px-4 py-3.5 text-sm text-gray-500">
            No results for <span className="text-gray-300">"{debouncedQuery}"</span>
          </div>
        )}

        {/* Results list */}
        {apiKey && !isLoading && !error && (results.length > 0 || collections.length > 0) && (
          <ul className="max-h-[420px] overflow-y-auto divide-y divide-gray-800/60">
            {/* Collection results */}
            {collections.map((col) => (
              <li
                key={`col-${col.tmdb_collection_id}`}
                onMouseDown={() => handleCollectionSelect(col)}
                className="
                  flex items-center gap-3 px-3 py-2.5
                  hover:bg-gray-800/70 cursor-pointer
                  transition-colors group
                "
              >
                {/* Poster thumbnail */}
                <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                  {col.poster_path ? (
                    <img
                      src={col.poster_path}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <FilmIcon />
                    </div>
                  )}
                </div>

                {/* Name + film count */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white group-hover:text-teal-200 transition-colors">
                    {col.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Collection</p>
                </div>

                {/* Teal collection badge */}
                <span className="inline-flex items-center rounded-full border border-teal-500/40 bg-teal-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-teal-400 whitespace-nowrap flex-shrink-0">
                  Collection
                </span>
              </li>
            ))}

            {/* Movie results */}
            {results.map((movie) => {
              const cachedStatus = statusCache[movie.tmdb_id]
              const inLibrary    = cachedStatus && cachedStatus !== '__none__'

              return (
                <li
                  key={movie.tmdb_id}
                  onMouseEnter={() => handleHover(movie.tmdb_id)}
                  onMouseDown={() => handleSelect(movie)}
                  className="
                    flex items-center gap-3 px-3 py-2.5
                    hover:bg-gray-800/70 cursor-pointer
                    transition-colors group
                  "
                >
                  {/* Poster thumbnail */}
                  <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                    {movie.poster_path ? (
                      <img
                        src={movie.poster_path}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FilmIcon />
                      </div>
                    )}
                  </div>

                  {/* Title + year */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                      {movie.title}
                    </p>
                    {movie.year && (
                      <p className="text-xs text-gray-500 mt-0.5">{movie.year}</p>
                    )}
                  </div>

                  {/* Library status badge (shown once DB is checked on hover) */}
                  {inLibrary && (
                    <StatusBadge status={cachedStatus} size="sm" />
                  )}

                  {/* "In library" dot while hover-check is pending */}
                  {!cachedStatus && (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer attribution */}
        {(results.length > 0 || collections.length > 0) && (
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
        {/* Search icon */}
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

        {/* Right-side: spinner or clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Spinner />
          ) : query.length > 0 ? (
            <button
              onClick={() => { setQuery(''); setResults([]); setIsOpen(false); inputRef.current?.focus() }}
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown rendered into document.body via portal */}
      {dropdown}
    </div>
  )
}
