import { useEffect, useMemo, useState } from 'react'
import MovieGrid from '../components/MovieGrid'
import LibraryControls from '../components/LibraryControls'
import { getAllMovies } from '../utils/api'

const STATUS_FILTERS = [
  { value: 'all',       label: 'All'       },
  { value: 'wanted',    label: 'Wanted'    },
  { value: 'upgrade',   label: 'Upgrade'   },
  { value: '4k_bluray', label: '4K Blu-ray'},
  { value: 'bluray',    label: 'Blu-ray'   },
  { value: 'dvd',       label: 'DVD'       },
  { value: 'digital',   label: 'Digital'   },
]

const DEFAULT_SORT    = { field: 'date_added', direction: 'desc' }
const DEFAULT_FILTERS = {
  genres: [], decades: [], directors: [], actors: [],
  rating: null, runtime: null,
}

const STORAGE_KEY = 'filmvault_library_state'

function safeParse(json, fallback) {
  if (!json) return fallback
  if (typeof json !== 'string') return json
  try { return JSON.parse(json) } catch { return fallback }
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const pf = parsed.filters || {}
    // Sanitise: migrate old ratingMin/runtimeMax single-handle values; discard unknown shapes
    const rating  = Array.isArray(pf.rating)  ? pf.rating  : null
    const runtime = Array.isArray(pf.runtime) ? pf.runtime : null
    return {
      sort:    { ...DEFAULT_SORT,    ...(parsed.sort || {}) },
      filters: {
        genres:    Array.isArray(pf.genres)    ? pf.genres    : [],
        decades:   Array.isArray(pf.decades)   ? pf.decades   : [],
        directors: Array.isArray(pf.directors) ? pf.directors : [],
        actors:    Array.isArray(pf.actors)    ? pf.actors    : [],
        rating,
        runtime,
      },
    }
  } catch {
    return null
  }
}

function savePersistedState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

export default function Library({ onMovieClick, onEbayClick, refreshKey, searchQuery = '' }) {
  const [movies,       setMovies]       = useState([])
  const [activeStatus, setActiveStatus] = useState('all')

  const persisted = loadPersistedState()
  const [sort,    setSort]    = useState(persisted?.sort    || DEFAULT_SORT)
  const [filters, setFilters] = useState(persisted?.filters || DEFAULT_FILTERS)

  useEffect(() => {
    getAllMovies().then(setMovies)
  }, [refreshKey])

  useEffect(() => {
    savePersistedState({ sort, filters })
  }, [sort, filters])

  // Status counts from unfiltered set so they stay stable while other filters change
  const statusCounts = movies.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    return acc
  }, {})

  // Apply status + text search
  const trimmed = searchQuery.trim().toLowerCase()
  const afterStatusAndSearch = (activeStatus === 'all' ? movies : movies.filter((m) => m.status === activeStatus))
    .filter((m) => !trimmed || m.title.toLowerCase().includes(trimmed))

  // Apply advanced filters (AND between categories, OR within a category)
  const filtered = useMemo(() => {
    return afterStatusAndSearch.filter((m) => {
      if (filters.genres.length > 0) {
        const movieGenres = safeParse(m.genres, [])
        if (!filters.genres.some((g) => movieGenres.includes(g))) return false
      }
      if (filters.decades.length > 0) {
        if (!m.year) return false
        const decade = Math.floor(m.year / 10) * 10
        if (!filters.decades.includes(decade)) return false
      }
      if (filters.directors.length > 0) {
        const d = safeParse(m.director, null)
        if (!d?.name || !filters.directors.includes(d.name)) return false
      }
      if (filters.actors.length > 0) {
        const cast = safeParse(m.cast_json, [])
        const names = new Set(cast.map((c) => c.name))
        if (!filters.actors.some((a) => names.has(a))) return false
      }
      if (filters.rating !== null) {
        const r = parseFloat(m.omdb_rating)
        if (isNaN(r) || r < filters.rating[0] || r > filters.rating[1]) return false
      }
      if (filters.runtime !== null) {
        if (!m.runtime || m.runtime < filters.runtime[0] || m.runtime > filters.runtime[1]) return false
      }
      return true
    })
  }, [afterStatusAndSearch, filters])

  // Apply sort — nulls always sink to the bottom regardless of direction
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const { field, direction } = sort
    const dir = direction === 'desc' ? -1 : 1

    arr.sort((a, b) => {
      let av = a[field]
      let bv = b[field]

      if (field === 'omdb_rating') {
        av = parseFloat(av); bv = parseFloat(bv)
        if (isNaN(av)) av = -Infinity
        if (isNaN(bv)) bv = -Infinity
      }

      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') return av.localeCompare(bv) * dir
      return (av - bv) * dir
    })
    return arr
  }, [filtered, sort])

  const hasActiveSecondaryFilter =
    filters.genres.length > 0    ||
    filters.decades.length > 0   ||
    filters.directors.length > 0 ||
    filters.actors.length > 0    ||
    filters.rating  !== null      ||
    filters.runtime !== null

  return (
    <div className="flex flex-col gap-4">
      {/* Status filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const count    = f.value === 'all' ? movies.length : (statusCounts[f.value] || 0)
          const isActive = activeStatus === f.value
          return (
            <button
              key={f.value}
              onClick={() => setActiveStatus(f.value)}
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

      {/* Sort + advanced filters */}
      <LibraryControls
        movies={movies}
        sort={sort}
        filters={filters}
        onSortChange={setSort}
        onFiltersChange={setFilters}
      />

      {/* Grid */}
      <MovieGrid
        movies={sorted}
        onMovieClick={onMovieClick}
        onEbayClick={onEbayClick}
        hasFilter={activeStatus !== 'all' || !!trimmed || hasActiveSecondaryFilter}
      />
    </div>
  )
}
