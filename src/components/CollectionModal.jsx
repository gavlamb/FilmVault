import { useState, useEffect, useRef } from 'react'
import { getCollectionDetails } from '../utils/tmdb'
import StatusBadge from './StatusBadge'
import { getPosterUrl } from '../utils/posterUrl'

const FORMAT_OPTS = [
  { value: 'wanted',    label: 'Wanted'     },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray'    },
  { value: 'dvd',       label: 'DVD'        },
  { value: 'digital',   label: 'Digital'    },
]

function FilmIcon() {
  return (
    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  )
}

function Spinner() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-gray-700 border-t-teal-400 animate-spin" />
  )
}

export default function CollectionModal({ collection, onClose, onMovieSelect, onSaved }) {
  const [details,       setDetails]       = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [movieStatuses, setMovieStatuses] = useState({})   // { [tmdb_id]: status | '__none__' }
  const [addAllFormat,  setAddAllFormat]  = useState('bluray')
  const [addingAll,     setAddingAll]     = useState(false)
  const [addedAll,      setAddedAll]      = useState(false)
  const backdropRef = useRef(null)

  // Load collection details from TMDB + check library status for each film
  useEffect(() => {
    if (!collection) return
    setLoading(true)
    setError(null)

    window.electronAPI.getSetting('tmdb_api_key').then(async (apiKey) => {
      if (!apiKey) {
        setError('Add your TMDB API key in Settings to view collection details.')
        setLoading(false)
        return
      }
      try {
        const data = await getCollectionDetails(collection.tmdb_collection_id, apiKey)
        setDetails(data)

        // Check library status for each film
        const statuses = {}
        await Promise.all(data.parts.map(async (film) => {
          const entry = await window.electronAPI.getMovieById(film.tmdb_id)
          statuses[film.tmdb_id] = entry ? entry.status : '__none__'
        }))
        setMovieStatuses(statuses)
      } catch (err) {
        setError(err.message === 'INVALID_API_KEY'
          ? 'Invalid TMDB API key. Check your Settings.'
          : 'Failed to load collection details.')
      } finally {
        setLoading(false)
      }
    })
  }, [collection?.tmdb_collection_id])

  // Escape key closes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleAddAll() {
    if (!details) return
    setAddingAll(true)
    try {
      const notOwned = details.parts.filter((f) => movieStatuses[f.tmdb_id] === '__none__')
      for (const film of notOwned) {
        await window.electronAPI.addMovie({
          tmdb_id:       film.tmdb_id,
          title:         film.title,
          year:          film.year          ?? null,
          poster_path:   film.poster_path   ?? null,
          status:        addAllFormat,
          format:        addAllFormat,
          is_collection: 1,
          collection_id: collection.tmdb_collection_id,
          jellyfin_id:   null,
          notes:         null,
          ebay_watch:    0,
          genres:        '[]',
          runtime:       null,
          overview:      film.overview      ?? null,
        })
        setMovieStatuses((prev) => ({ ...prev, [film.tmdb_id]: addAllFormat }))
      }
      setAddedAll(true)
      onSaved()
    } finally {
      setAddingAll(false)
    }
  }

  if (!collection) return null

  const notOwnedCount = details
    ? details.parts.filter((f) => movieStatuses[f.tmdb_id] === '__none__').length
    : 0

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 shadow-2xl shadow-black/80 max-h-[85vh] flex flex-col">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex gap-4 p-5 pr-10 flex-shrink-0">
          {/* Collection poster */}
          <div className="w-24 flex-shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-lg bg-gray-800">
              {collection.poster_path ? (
                <img
                  src={getPosterUrl(collection.poster_path)}
                  alt={collection.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <FilmIcon />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-0 flex-1 justify-center">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-teal-500/40 bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-teal-400">
                Collection
              </span>
            </div>
            <h2 className="text-lg font-bold leading-tight text-white">{collection.name}</h2>
            {details && (
              <p className="text-sm text-gray-400">
                {details.parts.length} {details.parts.length === 1 ? 'film' : 'films'}
              </p>
            )}
            {details?.overview && (
              <p className="line-clamp-2 text-xs leading-relaxed text-gray-500 mt-0.5">
                {details.overview}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto border-t border-gray-800">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-3 text-sm text-gray-500">
              <Spinner />
              Loading collection…
            </div>
          )}

          {error && (
            <div className="px-5 py-4 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && details && (
            <ul className="divide-y divide-gray-800/60">
              {details.parts.map((film) => {
                const status = movieStatuses[film.tmdb_id]
                const inLibrary = status && status !== '__none__'

                return (
                  <li
                    key={film.tmdb_id}
                    onMouseDown={() => {
                      onMovieSelect(film)
                      onClose()
                    }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 cursor-pointer transition-colors group"
                  >
                    {/* Poster */}
                    <div className="w-9 h-[54px] flex-shrink-0 overflow-hidden rounded bg-gray-800">
                      {film.poster_path ? (
                        <img
                          src={getPosterUrl(film.poster_path)}
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
                      <p className="truncate text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                        {film.title}
                      </p>
                      {film.year && (
                        <p className="text-xs text-gray-600 mt-0.5">{film.year}</p>
                      )}
                    </div>

                    {/* Library status */}
                    {inLibrary && (
                      <StatusBadge status={status} size="sm" />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer: Add All */}
        {!loading && !error && details && notOwnedCount > 0 && (
          <div className="flex items-center gap-3 border-t border-gray-800 px-5 py-3 flex-shrink-0">
            <p className="text-xs text-gray-500 flex-1">
              Add {notOwnedCount} film{notOwnedCount !== 1 ? 's' : ''} not in library
            </p>
            <select
              value={addAllFormat}
              onChange={(e) => setAddAllFormat(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-300 outline-none focus:border-teal-500 transition-colors"
            >
              {FORMAT_OPTS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleAddAll}
              disabled={addingAll || addedAll}
              className={`
                rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap
                ${addedAll
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40'}
              `}
            >
              {addedAll ? '✓ Added' : addingAll ? 'Adding…' : 'Add All'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
