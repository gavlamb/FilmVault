import { useState, useEffect, useRef } from 'react'
import StatusBadge from './StatusBadge'

const FORMAT_OPTIONS = [
  { value: 'wanted',    label: 'Wanted' },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray' },
  { value: 'dvd',       label: 'DVD' },
  { value: 'digital',   label: 'Digital' },
]

const ALL_STATUSES = [
  { value: 'wanted',    label: 'Wanted' },
  { value: 'upgrade',   label: 'Upgrade' },
  { value: '4k_bluray', label: '4K Blu-ray' },
  { value: 'bluray',    label: 'Blu-ray' },
  { value: 'dvd',       label: 'DVD' },
  { value: 'digital',   label: 'Digital' },
]

const UPGRADE_ELIGIBLE = new Set(['bluray', 'dvd', 'digital'])

// ── Format selector button ────────────────────────────────────────────────────

function FormatButton({ option, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(option.value)}
      className={`
        flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all
        ${selected
          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
          : 'border-gray-700 bg-gray-800/60 text-gray-400 hover:border-gray-600 hover:text-gray-300'}
      `}
    >
      {option.label}
    </button>
  )
}

// ── Add-to-library section ────────────────────────────────────────────────────

function AddSection({ selectedFormat, setSelectedFormat, upgradeWanted, setUpgradeWanted, notes, setNotes, saving, onAdd }) {
  const showUpgradeToggle = selectedFormat && UPGRADE_ELIGIBLE.has(selectedFormat)

  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Add to Library</p>

      {/* Format grid */}
      <div className="flex gap-2">
        {FORMAT_OPTIONS.map((opt) => (
          <FormatButton
            key={opt.value}
            option={opt}
            selected={selectedFormat === opt.value}
            onClick={(v) => {
              setSelectedFormat(v)
              if (!UPGRADE_ELIGIBLE.has(v)) setUpgradeWanted(false)
            }}
          />
        ))}
      </div>

      {/* Upgrade toggle */}
      {showUpgradeToggle && (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 transition-colors hover:bg-orange-500/15">
          <input
            type="checkbox"
            checked={upgradeWanted}
            onChange={(e) => setUpgradeWanted(e.target.checked)}
            className="h-4 w-4 accent-orange-500"
          />
          Mark as Upgrade Wanted
        </label>
      )}

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />

      <button
        onClick={onAdd}
        disabled={!selectedFormat || saving}
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'Adding…' : 'Add to Library'}
      </button>
    </div>
  )
}

// ── Edit section ──────────────────────────────────────────────────────────────

function EditSection({ editStatus, setEditStatus, editNotes, setEditNotes, saving, confirmRemove, setConfirmRemove, onSave, onRemove }) {
  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Current status badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</span>
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

      {/* Notes */}
      <textarea
        value={editNotes}
        onChange={(e) => setEditNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        <button
          onClick={onRemove}
          disabled={saving}
          className={`
            rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors
            ${confirmRemove
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'border border-red-800/60 text-red-400 hover:border-red-600 hover:bg-red-900/30'}
          `}
        >
          {confirmRemove ? 'Confirm Remove' : 'Remove from Library'}
        </button>
      </div>

      {confirmRemove && (
        <button
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
  const [libraryEntry,   setLibraryEntry]   = useState(undefined) // undefined=loading
  const [selectedFormat, setSelectedFormat] = useState(null)
  const [upgradeWanted,  setUpgradeWanted]  = useState(false)
  const [notes,          setNotes]          = useState('')
  const [editStatus,     setEditStatus]     = useState('')
  const [editNotes,      setEditNotes]      = useState('')
  const [saving,         setSaving]         = useState(false)
  const [confirmRemove,  setConfirmRemove]  = useState(false)
  const backdropRef = useRef(null)

  useEffect(() => {
    if (!movie) return
    setLibraryEntry(undefined)
    setSelectedFormat(null)
    setUpgradeWanted(false)
    setNotes('')
    setConfirmRemove(false)
    window.electronAPI.getMovieById(movie.tmdb_id).then((entry) => {
      setLibraryEntry(entry || null)
      if (entry) {
        setEditStatus(entry.status)
        setEditNotes(entry.notes || '')
      }
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

  async function handleAdd() {
    const effectiveStatus = upgradeWanted ? 'upgrade' : selectedFormat
    if (!effectiveStatus) return
    setSaving(true)
    try {
      await window.electronAPI.addMovie({
        tmdb_id:       movie.tmdb_id,
        title:         movie.title,
        year:          movie.year ?? null,
        poster_path:   movie.poster_path ?? null,
        status:        effectiveStatus,
        format:        selectedFormat,
        is_collection: 0,
        collection_id: null,
        jellyfin_id:   null,
        notes:         notes.trim() || null,
        ebay_watch:    0,
        genres:        movie.genres ?? '[]',
        runtime:       movie.runtime ?? null,
        overview:      movie.overview ?? null,
      })
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await window.electronAPI.updateMovie(movie.tmdb_id, {
        ...libraryEntry,
        status: editStatus,
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
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-gray-700/60 bg-gray-900 shadow-2xl shadow-black/80">

        {/* Close */}
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
          <div className="w-40 flex-shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-lg bg-gray-800">
              {movie.poster_path ? (
                <img src={movie.poster_path} alt={movie.title} className="h-full w-full object-cover" />
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

          {/* Content */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <h2 className="text-lg font-bold leading-tight text-white">{movie.title}</h2>
              {movie.year && <p className="mt-0.5 text-sm text-gray-400">{movie.year}</p>}
            </div>

            {movie.overview && (
              <p className="line-clamp-4 text-xs leading-relaxed text-gray-400">{movie.overview}</p>
            )}

            {isLoading ? (
              <div className="mt-2 text-sm text-gray-600">Loading…</div>
            ) : inLibrary ? (
              <EditSection
                editStatus={editStatus}
                setEditStatus={setEditStatus}
                editNotes={editNotes}
                setEditNotes={setEditNotes}
                saving={saving}
                confirmRemove={confirmRemove}
                setConfirmRemove={setConfirmRemove}
                onSave={handleSave}
                onRemove={handleRemove}
              />
            ) : (
              <AddSection
                selectedFormat={selectedFormat}
                setSelectedFormat={setSelectedFormat}
                upgradeWanted={upgradeWanted}
                setUpgradeWanted={setUpgradeWanted}
                notes={notes}
                setNotes={setNotes}
                saving={saving}
                onAdd={handleAdd}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
