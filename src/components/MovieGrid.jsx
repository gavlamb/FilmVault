import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge'
import { getPosterUrl } from '../utils/posterUrl'
import { cachePoster, updateMoviePoster } from '../utils/api'

const FORMAT_SHORT = {
  '4k_bluray': '4K',
  bluray:      'Blu-ray',
  dvd:         'DVD',
  digital:     'Digital',
}

function UpgradeBadge({ format }) {
  const from = FORMAT_SHORT[format] || 'Own'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-orange-400 whitespace-nowrap">
      {from}
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
      4K
    </span>
  )
}

function EmptyState({ hasFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/60">
        <svg className="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
        </svg>
      </div>
      {hasFilter ? (
        <>
          <p className="text-base font-medium text-gray-400">No movies match this filter</p>
          <p className="mt-1 text-sm text-gray-600">Try a different status or add more movies</p>
        </>
      ) : (
        <>
          <p className="text-base font-medium text-gray-400">Your vault is empty</p>
          <p className="mt-1 text-sm text-gray-600">Search for a movie above to start your collection</p>
        </>
      )}
    </div>
  )
}

function MovieCard({ movie, onClick, onEbayClick }) {
  const [posterSrc, setPosterSrc] = useState(() => getPosterUrl(movie.poster_path))

  useEffect(() => {
    console.log(`[MovieCard] ${movie.title} | poster_path="${movie.poster_path}" | resolved="${getPosterUrl(movie.poster_path)}"`)
  }, [movie.tmdb_id])

  useEffect(() => {
    if (!movie.poster_path) return
    // Only cache remote TMDB URLs — filmvault:// means already cached
    if (!movie.poster_path.startsWith('http')) return
    cachePoster(movie.poster_path, movie.tmdb_id)
      .then((filename) => {
        if (!filename) return  // server mode no-ops return null
        const src = getPosterUrl(filename)
        setPosterSrc(src)
        updateMoviePoster(movie.tmdb_id, src)
      })
      .catch(() => { /* keep remote URL on failure */ })
  }, [movie.tmdb_id, movie.poster_path])

  return (
    <button
      onClick={() => onClick(movie)}
      className="group flex flex-col overflow-hidden rounded-xl bg-gray-800/40 border border-gray-700/40 transition-all hover:border-gray-600/60 hover:bg-gray-800/70 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-800">
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-800/80 px-2">
            <svg className="h-7 w-7 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
            <p className="line-clamp-3 text-center text-[10px] leading-tight text-gray-500">
              {movie.title}
            </p>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute bottom-2 left-2">
          {movie.status === 'upgrade'
            ? <UpgradeBadge format={movie.format} />
            : <StatusBadge status={movie.status} size="sm" />
          }
        </div>

        {/* eBay quick-look button — wanted and upgrade only */}
        {(movie.status === 'wanted' || movie.status === 'upgrade') && onEbayClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onEbayClick(movie) }}
            title="View eBay listings"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-gray-900/80 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-gray-800 hover:text-amber-400"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3H5a2 2 0 00-2 2v2.586a1 1 0 00.293.707l8.414 8.414a2 2 0 002.828 0l2.586-2.586a2 2 0 000-2.828L8.707 3.293A1 1 0 008 3H7z" />
            </svg>
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <p className="truncate text-xs font-semibold leading-tight text-gray-200 group-hover:text-white transition-colors">
          {movie.title}
        </p>
        <div className="flex items-center justify-between gap-1">
          {movie.year && (
            <p className="text-[11px] text-gray-600">{movie.year}</p>
          )}
          {movie.omdb_rating && (
            <span className="inline-flex items-center gap-1 rounded px-1 py-px flex-shrink-0" style={{ backgroundColor: '#1a1a1a' }}>
              <span className="text-[9px] font-bold leading-none" style={{ color: '#F5C518' }}>IMDb</span>
              <span className="text-[10px] font-semibold leading-none text-white">{movie.omdb_rating}</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export default function MovieGrid({ movies, onMovieClick, onEbayClick, hasFilter }) {
  if (movies.length === 0) {
    return <EmptyState hasFilter={hasFilter} />
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {movies.map((movie) => (
        <MovieCard key={movie.tmdb_id} movie={movie} onClick={onMovieClick} onEbayClick={onEbayClick} />
      ))}
    </div>
  )
}
