import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { field: 'date_added',  label: 'Date added'  },
  { field: 'title',       label: 'Title'        },
  { field: 'year',        label: 'Release year' },
  { field: 'omdb_rating', label: 'IMDb rating'  },
  { field: 'runtime',     label: 'Runtime'      },
]

// ─── Shared helpers ───────────────────────────────────────────────────────────

function safeParse(json, fallback) {
  if (!json) return fallback
  if (typeof json !== 'string') return json
  try { return JSON.parse(json) } catch { return fallback }
}

// Hook: close when clicking outside or pressing Escape.
function useDismissable(ref, onClose) {
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown',   onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown',   onKey)
    }
  }, [ref, onClose])
}

// ─── Sort dropdown ────────────────────────────────────────────────────────────

function SortControl({ sort, onChange }) {
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)
  const close             = useCallback(() => setOpen(false), [])
  useDismissable(ref, close)

  const active  = SORT_OPTIONS.find((o) => o.field === sort.field)
  const dirIcon = sort.direction === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-gray-700/60 bg-gray-800/60 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-800"
      >
        <svg className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
        <span>Sort: {active?.label || 'Date added'}</span>
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={dirIcon} />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl shadow-black/60">
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.field === sort.field
            return (
              <button
                key={opt.field}
                onClick={() => {
                  if (isActive) {
                    onChange({ field: opt.field, direction: sort.direction === 'desc' ? 'asc' : 'desc' })
                  } else {
                    // Title ascends alphabetically by default; all other fields descend
                    onChange({ field: opt.field, direction: opt.field === 'title' ? 'asc' : 'desc' })
                  }
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-gray-800 ${
                  isActive ? 'text-indigo-400' : 'text-gray-300'
                }`}
              >
                <span>{opt.label}</span>
                {isActive && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d={sort.direction === 'desc' ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Multi-select chip ────────────────────────────────────────────────────────

function MultiSelectChip({ label, options, selected, onChange }) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const ref                 = useRef(null)
  const close               = useCallback(() => setOpen(false), [])
  useDismissable(ref, close)

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const count    = selected.length
  const isActive = count > 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
            : 'border-gray-700/60 bg-gray-800/60 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
        }`}
      >
        <span>{label}</span>
        {isActive && (
          <span className="rounded-full bg-indigo-500/40 px-1.5 py-px text-[10px] font-bold tabular-nums text-indigo-100">
            {count}
          </span>
        )}
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-80 w-64 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl shadow-black/60">
          {options.length > 10 && (
            <div className="border-b border-gray-800 p-2">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-600">No matches</p>
            ) : (
              filtered.map((opt) => {
                const isChecked = selected.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                        isChecked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-600 bg-gray-800'
                      }`}>
                        {isChecked && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="text-gray-200">{opt.label}</span>
                    </span>
                    {opt.count !== undefined && (
                      <span className="text-[10px] tabular-nums text-gray-600">{opt.count}</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Range chip ───────────────────────────────────────────────────────────────

function RangeChip({ label, suffix, mode, min, max, step, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef(null)
  const close           = useCallback(() => setOpen(false), [])
  useDismissable(ref, close)

  // "Inactive" means the slider is at the no-op end:
  //   mode=min → value equal to `min` means no filter
  //   mode=max → value equal to `max` means no filter
  const noopValue = mode === 'max' ? max : min
  const isActive  = value !== null && value !== undefined && value !== noopValue
  const shown     = value !== null && value !== undefined ? value : noopValue
  const compare   = mode === 'max' ? '≤' : '≥'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          isActive
            ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
            : 'border-gray-700/60 bg-gray-800/60 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
        }`}
      >
        <span>
          {label}
          {isActive && `: ${compare} ${shown}${suffix || ''}`}
        </span>
        <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl shadow-black/60">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {mode === 'max' ? 'Maximum' : 'Minimum'} {label}
            </p>
            <span className="text-xs tabular-nums text-indigo-300">
              {shown}{suffix || ''}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange(v === noopValue ? null : v)
            }}
            className="w-full accent-indigo-500"
          />
          <div className="mt-1 flex justify-between text-[10px] text-gray-600">
            <span>{min}{suffix || ''}</span>
            <span>{max}{suffix || ''}</span>
          </div>
          {isActive && (
            <button
              onClick={() => onChange(null)}
              className="mt-2 w-full text-[11px] text-gray-500 transition-colors hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Option builders ──────────────────────────────────────────────────────────

function buildOptions(movies, extractor) {
  const counts = new Map()
  for (const movie of movies) {
    for (const v of extractor(movie)) {
      if (!v) continue
      counts.set(v, (counts.get(v) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: String(value), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

// ─── Main controls bar ────────────────────────────────────────────────────────

export default function LibraryControls({ movies, sort, filters, onSortChange, onFiltersChange }) {
  const genreOptions = useMemo(
    () => buildOptions(movies, (m) => safeParse(m.genres, [])),
    [movies]
  )

  const decadeOptions = useMemo(() => {
    const counts = new Map()
    for (const m of movies) {
      if (!m.year) continue
      const decade = Math.floor(m.year / 10) * 10
      counts.set(decade, (counts.get(decade) || 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([decade, count]) => ({ value: decade, label: `${decade}s`, count }))
  }, [movies])

  const directorOptions = useMemo(
    () => buildOptions(movies, (m) => {
      const d = safeParse(m.director, null)
      return d?.name ? [d.name] : []
    }),
    [movies]
  )

  const actorOptions = useMemo(
    () => buildOptions(movies, (m) => {
      const cast = safeParse(m.cast_json, [])
      return cast.slice(0, 10).map((c) => c.name).filter(Boolean)
    }),
    [movies]
  )

  const hasActiveFilters =
    filters.genres.length > 0    ||
    filters.decades.length > 0   ||
    filters.directors.length > 0 ||
    filters.actors.length > 0    ||
    filters.ratingMin !== null    ||
    filters.runtimeMax !== null

  function clearAll() {
    onFiltersChange({ genres: [], decades: [], directors: [], actors: [], ratingMin: null, runtimeMax: null })
  }

  function setFilter(key, value) {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SortControl sort={sort} onChange={onSortChange} />

      <div className="mx-1 h-5 w-px bg-gray-800" />

      <MultiSelectChip
        label="Genre"
        options={genreOptions}
        selected={filters.genres}
        onChange={(v) => setFilter('genres', v)}
      />
      <MultiSelectChip
        label="Decade"
        options={decadeOptions}
        selected={filters.decades}
        onChange={(v) => setFilter('decades', v)}
      />
      <MultiSelectChip
        label="Director"
        options={directorOptions}
        selected={filters.directors}
        onChange={(v) => setFilter('directors', v)}
      />
      <MultiSelectChip
        label="Cast"
        options={actorOptions}
        selected={filters.actors}
        onChange={(v) => setFilter('actors', v)}
      />
      <RangeChip
        label="Rating"
        suffix=""
        mode="min"
        min={0}
        max={10}
        step={0.1}
        value={filters.ratingMin}
        onChange={(v) => setFilter('ratingMin', v)}
      />
      <RangeChip
        label="Runtime"
        suffix="m"
        mode="max"
        min={0}
        max={300}
        step={15}
        value={filters.runtimeMax}
        onChange={(v) => setFilter('runtimeMax', v)}
      />

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="ml-auto text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
