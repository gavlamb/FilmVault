import { useState, useEffect } from 'react'
import MovieGrid from '../components/MovieGrid'
import { getAllMovies } from '../utils/api'

const FILTERS = [
  { value: 'all',       label: 'All' },
  { value: 'wanted',    label: 'Wanted' },
  { value: 'upgrade',   label: 'Upgrade' },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray' },
  { value: 'dvd',       label: 'DVD' },
  { value: 'digital',   label: 'Digital' },
]

export default function Library({ onMovieClick, onEbayClick, refreshKey, searchQuery = '' }) {
  const [movies,        setMovies]        = useState([])
  const [activeFilter,  setActiveFilter]  = useState('all')

  useEffect(() => {
    getAllMovies().then(setMovies)
  }, [refreshKey])

  // Count per status (before text filter so counts stay stable while typing)
  const counts = movies.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {})

  const trimmed = searchQuery.trim().toLowerCase()

  const filtered = (activeFilter === 'all' ? movies : movies.filter((m) => m.status === activeFilter))
    .filter((m) => !trimmed || m.title.toLowerCase().includes(trimmed))

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = f.value === 'all' ? movies.length : (counts[f.value] || 0)
          const isActive = activeFilter === f.value

          return (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`
                flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors
                ${isActive
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300 border border-gray-700/60'}
              `}
            >
              {f.label}
              <span className={`
                rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums
                ${isActive ? 'bg-indigo-500/60 text-indigo-100' : 'bg-gray-700 text-gray-500'}
              `}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <MovieGrid
        movies={filtered}
        onMovieClick={onMovieClick}
        onEbayClick={onEbayClick}
        hasFilter={activeFilter !== 'all' || !!trimmed}
      />
    </div>
  )
}
