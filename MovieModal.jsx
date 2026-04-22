import { useState, useEffect, useRef, useMemo } from 'react'
import StatusBadge from './StatusBadge'
import PersonPanel from './PersonPanel'
import { getPosterUrl } from '../utils/posterUrl'
import {
  getMovieById,
  addMovie,
  updateMovie,
  deleteMovie,
  getSetting,
  updateMovieRating,
  updateMovieMetadata,
} from '../utils/api'
import { getMovieDetails, getFullMovieDetails } from '../utils/tmdb'
import { getIMDbRating } from '../utils/omdb'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_OPTS = [
  { value: 'wanted',    label: 'Wanted'     },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray'    },
  { value: 'dvd',       label: 'DVD'        },
  { value: 'digital',   label: 'Digital'    },
]

const UPGRADE_ELIGIBLE = new Set(['bluray', 'dvd', 'digital'])

const OWN_FORMATS = [
  { value: 'bluray',  label: 'Blu-ray' },
  { value: 'dvd',     label: 'DVD'     },
  { value: 'digital', label: 'Digital' },
]

const ALL_STATUSES = [
  { value: 'wanted',    label: 'Wanted'     },
  { value: 'upgrade',   label: 'Upgrade'    },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray'    },
  { value: 'dvd',       label: 'DVD'        },
  { value: 'digital',   label: 'Digital'    },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRuntime(minutes) {
  if (!minutes) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}h ${m}m`
  if (h)      return `${h}h`
  return `${m}m`
}

function safeParse(json, fallback) {
  if (!json) return fallback
  if (typeof json !== 'string') return json
  try { return JSON.parse(json) } catch { return fallback }
}

// ── Shared small pieces ───────────────────────────────────────────────────────

function FormatButton({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all
        ${selected
          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
          : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'}
      `}
    >
      {label}
    </button>
  )
}

function OwnFormatButton({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex-1 rounded-lg border py-2 text-xs font-medium transition-all
        ${selected
          ? 'border-orange-500 bg-orange-500/20 text-orange-300'
          : 'border-gray-700 bg-gray-800/50 text-gray-500 hover:border-gray-600 hover:text-gray-300'}
      `}
    >
      {label}
    </button>
  )
}

function NotesField({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Notes (optional)…"
      rows={2}
      className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
    />
  )
}

function GenreChip({ name }) {
  return (
    <span className="inline-block rounded-full border border-gray-700/80 bg-gray-800/60 px-2.5 py-0.5 text-[11px] font-medium text-gray-300">
      {name}
    </span>
  )
}

function ImdbPill({ rating, votes, size = 'md' }) {
  if (!rating) return null
  const s = size === 'lg'
    ? { label: 'text-xs', value: 'text-base', votes: 'text-xs' }
    : { label: 'text-[10px]', value: 'text-sm', votes: 'text-[11px]' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5" style={{ backgroundColor: '#1a1a1a' }}>
        <span className={`${s.label} font-bold leading-none`} style={{ color: '#F5C518' }}>IMDb</span>
        <span className={`${s.value} font-semibold leading-none text-white`}>{rating}</span>
      </span>
      {votes && <span className={`${s.votes} text-gray-500`}>({votes})</span>}
    </span>
  )
}

// Avatar with graceful fallback to initials.
function Avatar({ src, name, size = 56 }) {
  const [errored, setErrored] = useState(false)
  const initials = name?.split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'
  const style = { width: size, height: size }

  if (!src || errored) {
    return (
      <div
        style={style}
        className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-800 text-[11px] font-semibold text-gray-400"
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setErrored(true)}
      style={style}
      className="rounded-full bg-gray-800 object-cover"
    />
  )
}

// ── Cast rail ─────────────────────────────────────────────────────────────────

function PersonChip({ person, roleLabel, roleClass, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-[92px] flex-shrink-0 flex-col items-center gap-1.5 rounded-lg px-1 py-1.5 text-center transition-colors hover:bg-gray-800/60"
    >
      <Avatar src={person.profile} name={person.name} size={64} />
      <div className="w-full">
        <p className="truncate text-[11px] font-semibold leading-tight text-gray-200">
          {person.name}
        </p>
        {roleLabel && (
          <p className={`mt-0.5 line-clamp-2 text-[10px] leading-tight ${roleClass}`}>
            {roleLabel}
          </p>
        )}
      </div>
    </button>
  )
}

function CastRail({ director, cast, onPersonClick }) {
  if (!director && !cast?.length) return null

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Cast & Crew
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {director && (
          <PersonChip
            person={director}
            roleLabel="Director"
            roleClass="text-indigo-400"
            onClick={() => onPersonClick?.({ id: director.id, name: director.name })}
          />
        )}
        {cast?.map((c) => (
          <PersonChip
            key={c.id}
            person={{ id: c.id, name: c.name, profile: c.profile }}
            roleLabel={c.character || ''}
            roleClass="text-gray-500"
            onClick={() => onPersonClick?.({ id: c.id, name: c.name })}
          />
        ))}
      </div>
    </div>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ backdropPath, isLoadingExtras }) {
  return (
    <div className="relative aspect-[16/7] w-full overflow-hidden bg-gray-900">
      {backdropPath ? (
        <img
          src={backdropPath}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
      )}
      {/* Gradient for legibility and to blend into content below */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-gray-950/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/60 via-transparent to-gray-950/40" />

      {!backdropPath && isLoadingExtras && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      )}
    </div>
  )
}

// ── Add section ───────────────────────────────────────────────────────────────

function AddSection({ movie, onAdded }) {
  const [selectedFormat,  setSelectedFormat]  = useState(null)
  const [upgradeWanted,   setUpgradeWanted]   = useState(false)
  const [ownFormat,       setOwnFormat]       = useState('bluray')
  const [notes,           setNotes]           = useState('')
  const [saving,          setSaving]          = useState(false)
  const [added,           setAdded]           = useState(false)

  function handleFormatClick(value) {
    setSelectedFormat(value)
    if (!UPGRADE_ELIGIBLE.has(value)) setUpgradeWanted(false)
    if (UPGRADE_ELIGIBLE.has(value))  setOwnFormat(value)
  }

  function handleUpgradeToggle(e) {
    const on = e.target.checked
    setUpgradeWanted(on)
    if (on && UPGRADE_ELIGIBLE.has(selectedFormat)) setOwnFormat(selectedFormat)
  }

  async function handleAdd() {
    if (!selectedFormat) return
    setSaving(true)
    try {
      const status = upgradeWanted ? 'upgrade' : selectedFormat
      const format = upgradeWanted ? ownFormat : selectedFormat
      await addMovie({
        tmdb_id:       movie.tmdb_id,
        title:         movie.title,
        year:          movie.year          ?? null,
        poster_path:   movie.poster_path   ?? null,
        status,
        format,
        is_collection: 0,
        collection_id: null,
        jellyfin_id:   null,
        notes:         notes.trim() || null,
        ebay_watch:    0,
        genres:        movie.genres        ?? '[]',
        runtime:       movie.runtime       ?? null,
        overview:      movie.overview      ?? null,
      })
      setAdded(true)
      fetchAndStoreRating(movie.tmdb_id).catch(() => {})
      setTimeout(() => onAdded(), 900)
    } finally {
      setSaving(false)
    }
  }

  async function fetchAndStoreRating(tmdbId) {
    const [tmdbKey, omdbKey] = await Promise.all([
      getSetting('tmdb_api_key'),
      getSetting('omdb_api_key'),
    ])
    if (!tmdbKey || !omdbKey) return
    const details = await getMovieDetails(tmdbId, tmdbKey)
    if (!details.imdb_id) return
    const rating = await getIMDbRating(details.imdb_id, omdbKey)
    if (!rating) return
    await updateMovieRating(tmdbId, rating.imdbRating, rating.imdbVotes)
  }

  const showUpgradeToggle = selectedFormat && UPGRADE_ELIGIBLE.has(selectedFormat) && !upgradeWanted
  const canAdd = !!selectedFormat && !added

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Add to Library
      </p>

      {!upgradeWanted && (
        <div className="flex flex-wrap gap-1.5">
          {FORMAT_OPTS.map((opt) => (
            <FormatButton
              key={opt.value}
              label={opt.label}
              selected={selectedFormat === opt.value}
              onClick={() => handleFormatClick(opt.value)}
            />
          ))}
        </div>
      )}

      {showUpgradeToggle && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 transition-colors hover:bg-orange-500/15">
          <input
            type="checkbox"
            checked={upgradeWanted}
            onChange={handleUpgradeToggle}
            className="h-4 w-4 accent-orange-500"
          />
          Mark as Upgrade Wanted
        </label>
      )}

      {upgradeWanted && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/70">
            Currently own
          </p>
          <div className="flex gap-1.5">
            {OWN_FORMATS.map((opt) => (
              <OwnFormatButton
                key={opt.value}
                label={opt.label}
                selected={ownFormat === opt.value}
                onClick={() => setOwnFormat(opt.value)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setUpgradeWanted(false)}
            className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancel upgrade
          </button>
        </div>
      )}

      <NotesField value={notes} onChange={setNotes} />

      <button
        onClick={handleAdd}
        disabled={!canAdd || saving}
        className={`
          rounded-lg px-4 py-2.5 text-sm font-semibold transition-all
          ${added
            ? 'bg-green-600 text-white cursor-default'
            : 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40'}
        `}
      >
        {added ? '✓ Added to Library' : saving ? 'Adding…' : 'Add to Library'}
      </button>
    </div>
  )
}

// ── Edit section ──────────────────────────────────────────────────────────────

function EditSection({ movie, libraryEntry, onSaved, onClose }) {
  const [editStatus,    setEditStatus]    = useState(libraryEntry.status)
  const [editFormat,    setEditFormat]    = useState(libraryEntry.format || 'bluray')
  const [editNotes,     setEditNotes]     = useState(libraryEntry.notes || '')
  const [saving,        setSaving]        = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const format = editStatus === 'upgrade' ? editFormat : editStatus
      await updateMovie(movie.tmdb_id, {
        ...libraryEntry,
        status: editStatus,
        format,
        notes:  editNotes.trim() || null,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return }
    setSaving(true)
    try {
      await deleteMovie(movie.tmdb_id)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Status
        </span>
        <StatusBadge status={editStatus} size="md" />
      </div>

      <select
        value={editStatus}
        onChange={(e) => setEditStatus(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {editStatus === 'upgrade' && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-400/70">
            Currently own
          </p>
          <div className="flex gap-1.5">
            {OWN_FORMATS.map((opt) => (
              <OwnFormatButton
                key={opt.value}
                label={opt.label}
                selected={editFormat === opt.value}
                onClick={() => setEditFormat(opt.value)}
              />
            ))}
          </div>
        </div>
      )}

      <NotesField value={editNotes} onChange={setEditNotes} />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <button
          onClick={handleRemove}
          disabled={saving}
          className={`
            rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors
            ${confirmRemove
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'border border-red-800/60 text-red-400 hover:border-red-600 hover:bg-red-900/30'}
          `}
        >
          {confirmRemove ? 'Confirm Remove' : 'Remove'}
        </button>
      </div>

      {confirmRemove && (
        <button
          type="button"
          onClick={() => setConfirmRemove(false)}
          className="text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function MovieModal({ movie, onClose, onSaved }) {
  const [libraryEntry,  setLibraryEntry]  = useState(undefined)   // undefined = loading
  const [extras,        setExtras]        = useState(null)        // TMDB enrichment data
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [activePerson,  setActivePerson]  = useState(null)        // { id, name } when viewing filmography
  const backdropRef = useRef(null)

  // Load library entry for the selected movie
  useEffect(() => {
    if (!movie) return
    setLibraryEntry(undefined)
    getMovieById(movie.tmdb_id).then((entry) => {
      setLibraryEntry(entry || null)
    })
  }, [movie?.tmdb_id])

  // Load TMDB extras: prefer cached DB fields, fetch otherwise.
  useEffect(() => {
    if (!movie || libraryEntry === undefined) return
    setExtras(null)

    let cancelled = false
    async function load() {
      const cached = libraryEntry || {}
      const hasCached =
        cached.backdrop_path && cached.cast_json && cached.metadata_fetched_at

      if (hasCached) {
        setExtras({
          backdrop_path: cached.backdrop_path,
          tagline:       cached.tagline,
          director:      safeParse(cached.director, null),
          cast:          safeParse(cached.cast_json, []),
        })
        return
      }

      setLoadingExtras(true)
      try {
        const tmdbKey = await getSetting('tmdb_api_key')
        if (!tmdbKey) return
        const full = await getFullMovieDetails(movie.tmdb_id, tmdbKey)
        if (cancelled) return

        setExtras({
          backdrop_path: full.backdrop_path,
          tagline:       full.tagline,
          director:      safeParse(full.director, null),
          cast:          safeParse(full.cast_json, []),
        })

        // Persist to DB only when movie is in library (no phantom rows)
        if (libraryEntry) {
          updateMovieMetadata(movie.tmdb_id, {
            backdrop_path: full.backdrop_path,
            tagline:       full.tagline,
            director:      full.director,
            cast_json:     full.cast_json,
          }).catch(() => {})
        }
      } catch {
        /* swallow — modal still usable without extras */
      } finally {
        if (!cancelled) setLoadingExtras(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [movie?.tmdb_id, libraryEntry])

  // Esc closes — defer to person panel when it's open
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !activePerson) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, activePerson])

  // Merge: live extras win over cached; cached (libraryEntry) wins over base movie
  const display = {
    ...(movie || {}),
    ...(libraryEntry || {}),
    ...(extras || {}),
  }

  const genreList = useMemo(() => safeParse(display.genres, []), [display.genres])

  if (!movie) return null

  const isLoading = libraryEntry === undefined
  const inLibrary = !!libraryEntry
  const runtimeStr = formatRuntime(display.runtime)

  function handleAdded() {
    onSaved()
    onClose()
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-10 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/80">

        {/* Close button floats above hero */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-gray-950/60 p-2 text-gray-300 backdrop-blur transition-colors hover:bg-gray-900 hover:text-white"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Cinematic hero */}
        <Hero backdropPath={display.backdrop_path} isLoadingExtras={loadingExtras} />

        {/* Poster overlaps hero edge */}
        <div className="relative z-10 flex flex-col gap-6 px-6 pb-6 sm:flex-row sm:px-8 sm:pb-8">
          <div className="-mt-28 flex-shrink-0 sm:-mt-36">
            <div className="aspect-[2/3] w-44 overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/60 sm:w-56">
              {display.poster_path ? (
                <img
                  src={getPosterUrl(display.poster_path)}
                  alt={display.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg className="h-10 w-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 sm:pt-4">
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
                {display.title}
              </h2>
              {display.tagline && (
                <p className="text-sm italic text-gray-500">
                  {display.tagline}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-sm text-gray-400">
                {display.year && <span>{display.year}</span>}
                {runtimeStr && (
                  <>
                    <span className="text-gray-700">•</span>
                    <span>{runtimeStr}</span>
                  </>
                )}
                {display.omdb_rating && (
                  <>
                    <span className="text-gray-700">•</span>
                    <ImdbPill rating={display.omdb_rating} votes={display.omdb_votes} size="lg" />
                  </>
                )}
              </div>
            </div>

            {genreList.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {genreList.map((g) => <GenreChip key={g} name={g} />)}
              </div>
            )}

            {display.overview && (
              <p className="text-sm leading-relaxed text-gray-300">
                {display.overview}
              </p>
            )}
          </div>
        </div>

        {/* Cast rail */}
        {extras && (
          <div className="border-t border-gray-800/60 px-6 py-5 sm:px-8">
            <CastRail
              director={extras.director}
              cast={extras.cast}
              onPersonClick={setActivePerson}
            />
          </div>
        )}

        {/* Action section */}
        <div className="border-t border-gray-800/60 bg-gray-950 px-6 py-5 sm:px-8">
          {isLoading ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : inLibrary ? (
            <EditSection
              movie={display}
              libraryEntry={libraryEntry}
              onSaved={onSaved}
              onClose={onClose}
            />
          ) : (
            <AddSection
              movie={movie}
              onAdded={handleAdded}
            />
          )}
        </div>
      </div>

      {/* Filmography panel slides in on top when a person is clicked */}
      {activePerson && (
        <PersonPanel
          person={activePerson}
          onClose={() => setActivePerson(null)}
        />
      )}
    </div>
  )
}
