import StatusBadge from './StatusBadge'

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

function MovieCard({ movie, onClick }) {
  return (
    <button
      onClick={() => onClick(movie)}
      className="group flex flex-col overflow-hidden rounded-xl bg-gray-800/40 border border-gray-700/40 transition-all hover:border-gray-600/60 hover:bg-gray-800/70 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-800">
        {movie.poster_path ? (
          <img
            src={movie.poster_path}
            alt={movie.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
        )}

        {/* Status badge overlay */}
        <div className="absolute bottom-2 left-2">
          <StatusBadge status={movie.status} size="sm" />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2.5">
        <p className="truncate text-xs font-semibold leading-tight text-gray-200 group-hover:text-white transition-colors">
          {movie.title}
        </p>
        {movie.year && (
          <p className="text-[11px] text-gray-600">{movie.year}</p>
        )}
      </div>
    </button>
  )
}

export default function MovieGrid({ movies, onMovieClick, hasFilter }) {
  if (movies.length === 0) {
    return <EmptyState hasFilter={hasFilter} />
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
      {movies.map((movie) => (
        <MovieCard key={movie.tmdb_id} movie={movie} onClick={onMovieClick} />
      ))}
    </div>
  )
}
