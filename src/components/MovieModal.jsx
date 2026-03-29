import { useState, useEffect, useRef } from 'react'
import StatusBadge from './StatusBadge'

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_OPTS = [
  { value: 'wanted',    label: 'Wanted'     },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray'    },
  { value: 'dvd',       label: 'DVD'        },
  { value: 'digital',   label: 'Digital'    },
]

// Formats that can have an "upgrade wanted" toggle
const UPGRADE_ELIGIBLE = new Set(['bluray', 'dvd', 'digital'])

// Formats shown in the "Currently own:" row
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

// ── Small shared pieces ───────────────────────────────────────────────────────

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
    // Reset upgrade state when format changes
    if (!UPGRADE_ELIGIBLE.has(value)) setUpgradeWanted(false)
    if (UPGRADE_ELIGIBLE.has(value))  setOwnFormat(value)
  }

  function handleUpgradeToggle(e) {
    const on = e.target.checked
    setUpgradeWanted(on)
    // Seed "currently own" from selected format
    if (on && UPGRADE_ELIGIBLE.has(selectedFormat)) setOwnFormat(selectedFormat)
  }

  async function handleAdd() {
    if (!selectedFormat) return
    setSaving(true)
    try {
      const status = upgradeWanted ? 'upgrade' : selectedFormat
      const format = upgradeWanted ? ownFormat : selectedFormat
      await window.electronAPI.addMovie({
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
      setTimeout(() => onAdded(), 900)
    } finally {
      setSaving(false)
    }
  }

  const showUpgradeToggle = selectedFormat && UPGRADE_ELIGIBLE.has(selectedFormat) && !upgradeWanted
  const canAdd = !!selectedFormat && !added

  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Add to Library
      </p>

      {/* Format selector */}
      {!upgradeWanted && (
        <div className="flex gap-1.5">
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

      {/* Upgrade toggle */}
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

      {/* Currently own (shown when upgrade is on) */}
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
          {/* Allow cancelling upgrade */}
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
  const [editStatus,     setEditStatus]     = useState(libraryEntry.status)
  const [editFormat,     setEditFormat]     = useState(
    libraryEntry.format && UPGRADE_ELIGIBLE.has(libraryEntry.format)
      ? libraryEntry.format
      : 'bluray'
  )
  const [editNotes,      setEditNotes]      = useState(libraryEntry.notes || '')
  const [saving,         setSaving]         = useState(false)
  const [confirmRemove,  setConfirmRemove]  = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const format = editStatus === 'upgrade' ? editFormat : editStatus
      await window.electronAPI.updateMovie(movie.tmdb_id, {
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
      await window.electronAPI.deleteMovie(movie.tmdb_id)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Current status */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Status
        </span>
        <StatusBadge status={editStatus} size="md" />
      </div>

      {/* Status dropdown */}
      <select
        value={editStatus}
        onChange={(e) => setEditStatus(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Currently own (upgrade only) */}
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

      {/* Actions */}
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
  const [libraryEntry, setLibraryEntry] = useState(undefined) // undefined = loading
  const backdropRef = useRef(null)

  useEffect(() => {
    if (!movie) return
    setLibraryEntry(undefined)
    window.electronAPI.getMovieById(movie.tmdb_id).then((entry) => {
      setLibraryEntry(entry || null)
    })
  }, [movie?.tmdb_id])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!movie) return null

  const isLoading = libraryEntry === undefined
  const inLibrary = !!libraryEntry

  // Displayed movie data — prefer DB entry fields when in library (has real poster etc.)
  const display = inLibrary ? { ...movie, ...libraryEntry } : movie

  function handleAdded() {
    onSaved()
    onClose()
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 shadow-2xl shadow-black/80">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex gap-5 p-5 pr-10">

          {/* Poster */}
          <div className="w-36 flex-shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-lg bg-gray-800">
              {display.poster_path ? (
                <img
                  src={display.poster_path}
                  alt={display.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                  <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                  <p className="text-center text-[10px] leading-tight text-gray-600 line-clamp-3">
                    {display.title}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <h2 className="text-lg font-bold leading-tight text-white">{display.title}</h2>
              {display.year && (
                <p className="mt-0.5 text-sm text-gray-400">{display.year}</p>
              )}
            </div>

            {display.overview && (
              <p className="line-clamp-3 text-xs leading-relaxed text-gray-400">
                {display.overview}
              </p>
            )}

            {isLoading ? (
              <div className="mt-2 text-sm text-gray-600">Loading…</div>
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
      </div>
    </div>
  )
}
