import { useState, useEffect } from 'react'
import {
  getSetting, setSetting, getAllMovies, getMoviesByStatus,
  updateMovie, addMovie, updateMovieTmdbData,
  showSaveDialog, writeFile,
} from '../utils/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Stable negative int from a Jellyfin GUID — used as synthetic tmdb_id
function jellyfinSyntheticId(jellyfinId) {
  let h = 5381
  for (let i = 0; i < jellyfinId.length; i++) {
    h = (Math.imul(h, 33) ^ jellyfinId.charCodeAt(i)) | 0
  }
  return h > 0 ? -h : h === 0 ? -1 : h
}

// Search TMDB for a single movie and return { tmdb_id, poster_path } or null.
// One API call only — used for bulk poster fetching (caller handles rate limit).
async function fetchTmdbPoster(movie, tmdbKey) {
  try {
    const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(movie.title)}&language=en-US&page=1`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tmdbKey}`, 'Content-Type': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const results = (data.results || []).sort((a, b) => b.popularity - a.popularity)
    const titleNorm = movie.title.trim().toLowerCase()

    const match =
      // Exact title + year within 1
      results.find((r) => {
        const rYear = r.release_date ? parseInt(r.release_date.slice(0, 4), 10) : 0
        return r.title?.toLowerCase() === titleNorm && (!movie.year || Math.abs(rYear - movie.year) <= 1)
      }) ||
      // Exact title, any year
      results.find((r) => r.title?.toLowerCase() === titleNorm) ||
      // Most popular result as fallback
      results[0]

    if (!match?.poster_path) return null
    return {
      tmdb_id:     match.id,
      poster_path: `https://image.tmdb.org/t/p/w500${match.poster_path}`,
    }
  } catch {
    return null
  }
}

function toCsv(movies) {
  const headers = ['title', 'year', 'status', 'format', 'genres', 'runtime', 'notes', 'date_added', 'tmdb_id']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = movies.map((m) => [
    esc(m.title),
    esc(m.year),
    esc(m.status),
    esc(m.format),
    esc(JSON.parse(m.genres || '[]').join(', ')),
    esc(m.runtime),
    esc(m.notes),
    esc(m.date_added),
    esc(m.tmdb_id),
  ].join(','))
  return [headers.join(','), ...rows].join('\r\n')
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative flex-1">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-3 pr-10 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        tabIndex={-1}
      >
        {show ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-base font-semibold text-white">{children}</h2>
}

function SectionDesc({ children }) {
  return <p className="mt-0.5 text-xs text-gray-500">{children}</p>
}

function SavedBadge() {
  return <span className="text-xs font-medium text-green-400">Saved!</span>
}

function StatusLine({ status }) {
  if (!status) return null
  const colour = status.type === 'error' ? 'text-red-400' : status.type === 'success' ? 'text-green-400' : 'text-gray-400'
  return <p className={`text-xs ${colour}`}>{status.msg}</p>
}

// ── API Keys section ──────────────────────────────────────────────────────────

function ApiKeysSection() {
  const [tmdb,          setTmdb]          = useState('')
  const [tmdbSaved,     setTmdbSaved]     = useState(false)
  const [omdb,          setOmdb]          = useState('')
  const [omdbSaved,     setOmdbSaved]     = useState(false)
  const [ebayApp,       setEbayApp]       = useState('')
  const [ebayAppSaved,  setEbayAppSaved]  = useState(false)
  const [ebayCert,      setEbayCert]      = useState('')
  const [ebayCertSaved, setEbayCertSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('tmdb_api_key'),
      getSetting('omdb_api_key'),
      getSetting('ebay_app_id'),
      getSetting('ebay_cert_id'),
    ]).then(([t, o, a, c]) => {
      setTmdb(t || '')
      setOmdb(o || '')
      setEbayApp(a || '')
      setEbayCert(c || '')
    })
  }, [])

  async function save(key, value, flashSetter) {
    await setSetting(key, value)
    flashSetter(true)
    setTimeout(() => flashSetter(false), 2000)
  }

  return (
    <section className="space-y-5">
      <div>
        <SectionTitle>API Keys</SectionTitle>
        <SectionDesc>Keys are stored locally in the SQLite database — never transmitted anywhere.</SectionDesc>
      </div>

      {/* TMDB */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">TMDB Read Access Token</label>
        <p className="text-xs text-gray-500">Required for movie search. Get yours at themoviedb.org → Settings → API.</p>
        <div className="flex items-center gap-2">
          <PasswordInput value={tmdb} onChange={setTmdb} placeholder="eyJ…" />
          <button
            onClick={() => save('tmdb_api_key', tmdb, setTmdbSaved)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
          {tmdbSaved && <SavedBadge />}
        </div>
      </div>

      {/* OMDB */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">OMDB API Key</label>
        <p className="text-xs text-gray-500">Required for IMDb ratings. Get a free key at omdbapi.com.</p>
        <div className="flex items-center gap-2">
          <PasswordInput value={omdb} onChange={setOmdb} placeholder="xxxxxxxx" />
          <button
            onClick={() => save('omdb_api_key', omdb, setOmdbSaved)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
          {omdbSaved && <SavedBadge />}
        </div>
      </div>

      {/* eBay App ID */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">eBay App ID</label>
        <p className="text-xs text-gray-500">Phase 2 — eBay UK Browse API integration.</p>
        <div className="flex items-center gap-2">
          <PasswordInput value={ebayApp} onChange={setEbayApp} placeholder="MyApp-abcde-PRD-…" />
          <button
            onClick={() => save('ebay_app_id', ebayApp, setEbayAppSaved)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
          {ebayAppSaved && <SavedBadge />}
        </div>
      </div>

      {/* eBay Cert ID */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">eBay Cert ID</label>
        <p className="text-xs text-gray-500">Phase 2 — eBay UK Browse API integration.</p>
        <div className="flex items-center gap-2">
          <PasswordInput value={ebayCert} onChange={setEbayCert} placeholder="PRD-…" />
          <button
            onClick={() => save('ebay_cert_id', ebayCert, setEbayCertSaved)}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
          {ebayCertSaved && <SavedBadge />}
        </div>
      </div>
    </section>
  )
}

// ── Jellyfin section ──────────────────────────────────────────────────────────

function JellyfinSection() {
  const [url,           setUrl]          = useState('')
  const [apiKey,        setApiKey]       = useState('')
  const [credSaved,     setCredSaved]    = useState(false)
  const [connStatus,    setConnStatus]   = useState(null)  // null | { type, msg }
  const [syncStatus,    setSyncStatus]   = useState(null)  // null | { type, msg }
  const [posterStatus,  setPosterStatus] = useState(null)  // null | { type, msg }
  const [testing,       setTesting]      = useState(false)
  const [syncing,       setSyncing]      = useState(false)
  const [fixingPosters, setFixingPosters] = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('jellyfin_url'),
      getSetting('jellyfin_api_key'),
    ]).then(([u, k]) => {
      setUrl(u || '')
      setApiKey(k || '')
    })
  }, [])

  async function handleSave() {
    await Promise.all([
      setSetting('jellyfin_url', url),
      setSetting('jellyfin_api_key', apiKey),
    ])
    setCredSaved(true)
    setTimeout(() => setCredSaved(false), 2000)
  }

  async function handleTest() {
    const base = url.replace(/\/$/, '')
    if (!base || !apiKey) {
      setConnStatus({ type: 'error', msg: 'Enter URL and API key first.' })
      return
    }
    setTesting(true)
    setConnStatus(null)
    try {
      const res = await fetch(`${base}/System/Info`, {
        headers: { 'X-MediaBrowser-Token': apiKey },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const info = await res.json()
      setConnStatus({ type: 'success', msg: `Connected — Jellyfin ${info.Version}` })
    } catch (err) {
      setConnStatus({ type: 'error', msg: `Failed: ${err.message}` })
    } finally {
      setTesting(false)
    }
  }

  async function handleSync() {
    const base = url.replace(/\/$/, '')
    if (!base || !apiKey) {
      setSyncStatus({ type: 'error', msg: 'Enter URL and API key first.' })
      return
    }
    setSyncing(true)
    setSyncStatus({ type: 'progress', msg: 'Fetching from Jellyfin…' })

    try {
      // Build lookup maps from existing library
      const library = await getAllMovies()
      const byJellyfinId = new Map(
        library.filter((m) => m.jellyfin_id).map((m) => [m.jellyfin_id, m])
      )
      const byTitleYear = new Map(
        library.map((m) => [`${m.title.trim().toLowerCase()}|${m.year ?? ''}`, m])
      )

      // Fetch all movies from Jellyfin
      const res = await fetch(
        `${base}/Items?IncludeItemTypes=Movie&Recursive=true&Fields=Overview,ProductionYear,RunTimeTicks&Limit=10000`,
        { headers: { 'X-MediaBrowser-Token': apiKey } }
      )
      if (!res.ok) throw new Error(`Jellyfin returned HTTP ${res.status}`)
      const { Items: items = [] } = await res.json()

      let added = 0
      let alreadyExisted = 0
      const newlyAdded = []  // { tmdb_id (synthetic), title, year } — for poster fetch

      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (i % 10 === 0 || i === items.length - 1) {
          setSyncStatus({ type: 'progress', msg: `Syncing… ${i + 1} of ${items.length}` })
        }

        const titleKey = `${item.Name.trim().toLowerCase()}|${item.ProductionYear ?? ''}`

        if (byJellyfinId.has(item.Id)) {
          alreadyExisted++
        } else if (byTitleYear.has(titleKey)) {
          const existing = byTitleYear.get(titleKey)
          await updateMovie(existing.tmdb_id, {
            ...existing,
            jellyfin_id: item.Id,
          })
          alreadyExisted++
        } else {
          const syntheticId = jellyfinSyntheticId(item.Id)
          try {
            await addMovie({
              tmdb_id:       syntheticId,
              title:         item.Name,
              year:          item.ProductionYear || null,
              poster_path:   null,
              status:        'digital',
              format:        'digital',
              is_collection: 0,
              collection_id: null,
              jellyfin_id:   item.Id,
              notes:         null,
              ebay_watch:    0,
              genres:        '[]',
              runtime:       item.RunTimeTicks
                               ? Math.round(item.RunTimeTicks / 600000000)
                               : null,
              overview:      item.Overview || null,
            })
            newlyAdded.push({ tmdb_id: syntheticId, title: item.Name, year: item.ProductionYear || null })
            added++
          } catch {
            alreadyExisted++
          }
        }
      }

      setSyncStatus({
        type: 'success',
        msg: `Sync complete: ${added} added, ${alreadyExisted} already in library`,
      })

      // ── Phase 2: fetch TMDB posters for newly added movies ──────────────
      if (newlyAdded.length > 0) {
        const tmdbKey = await getSetting('tmdb_api_key')
        if (tmdbKey) {
          let postersFetched = 0
          for (let i = 0; i < newlyAdded.length; i++) {
            setSyncStatus({
              type: 'progress',
              msg:  `Fetching posters… ${i + 1} of ${newlyAdded.length}`,
            })
            if (i > 0) await new Promise((r) => setTimeout(r, 250)) // ~4 req/s
            const result = await fetchTmdbPoster(newlyAdded[i], tmdbKey)
            if (result) {
              await updateMovieTmdbData(
                newlyAdded[i].tmdb_id, result.tmdb_id, result.poster_path
              )
              postersFetched++
            }
          }
          setSyncStatus({
            type: 'success',
            msg:  `Sync complete: ${added} added, ${alreadyExisted} already in library · ${postersFetched} posters fetched`,
          })
        }
      }
    } catch (err) {
      setSyncStatus({ type: 'error', msg: `Sync failed: ${err.message}` })
    } finally {
      setSyncing(false)
    }
  }

  async function handleFixPosters() {
    const tmdbKey = await getSetting('tmdb_api_key')
    if (!tmdbKey) {
      setPosterStatus({ type: 'error', msg: 'TMDB API key not set — save it in the API Keys section first.' })
      return
    }

    const allMovies = await getAllMovies()
    const missing   = allMovies.filter((m) => !m.poster_path)

    if (missing.length === 0) {
      setPosterStatus({ type: 'success', msg: 'All movies already have posters.' })
      return
    }

    setFixingPosters(true)
    let fixed = 0

    for (let i = 0; i < missing.length; i++) {
      setPosterStatus({ type: 'progress', msg: `Fetching ${i + 1} of ${missing.length} posters…` })
      if (i > 0) await new Promise((r) => setTimeout(r, 250))
      const result = await fetchTmdbPoster(missing[i], tmdbKey)
      if (result) {
        await updateMovieTmdbData(missing[i].tmdb_id, result.tmdb_id, result.poster_path)
        fixed++
      }
    }

    setFixingPosters(false)
    setPosterStatus({ type: 'success', msg: `Done: ${fixed} of ${missing.length} posters found` })
  }

  const busy = syncing || fixingPosters

  return (
    <section className="space-y-5">
      <div>
        <SectionTitle>Jellyfin</SectionTitle>
        <SectionDesc>Connect to your Jellyfin server to sync your digital library.</SectionDesc>
      </div>

      {/* URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Server URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.x:8096"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {/* API key */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">API Key</label>
        <PasswordInput value={apiKey} onChange={setApiKey} placeholder="Jellyfin API key…" />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Save
        </button>
        {credSaved && <SavedBadge />}
      </div>

      {/* Test / Sync / Fix Posters */}
      <div className="flex flex-wrap items-start gap-3 border-t border-gray-800 pt-5">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleTest}
            disabled={testing || busy}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <StatusLine status={connStatus} />
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleSync}
            disabled={busy || testing}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync Library'}
          </button>
          <StatusLine status={syncStatus} />
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleFixPosters}
            disabled={busy || testing}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            {fixingPosters ? 'Fetching posters…' : 'Fix Missing Posters'}
          </button>
          <StatusLine status={posterStatus} />
        </div>
      </div>
    </section>
  )
}

// ── Export section ────────────────────────────────────────────────────────────

function ExportSection() {
  const [exportStatus, setExportStatus] = useState(null) // null | { key, type, msg }

  function flash(key, type, msg) {
    setExportStatus({ key, type, msg })
    if (type !== 'error') setTimeout(() => setExportStatus(null), 3000)
  }

  async function exportLibrary() {
    const movies = await getAllMovies()
    const csv    = toCsv(movies)
    const json   = JSON.stringify(movies, null, 2)

    const { canceled, filePath } = await showSaveDialog({
      title:       'Export Full Library',
      defaultPath: 'filmvault-library.csv',
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return

    await writeFile(filePath, csv)
    const jsonPath = filePath.replace(/\.csv$/i, '') + '.json'
    await writeFile(jsonPath, json)
    flash('library', 'success', `Saved CSV + JSON alongside it`)
  }

  async function exportList(statusFilter, defaultName, flashKey) {
    const movies = await getMoviesByStatus(statusFilter)
    const csv    = toCsv(movies)

    const { canceled, filePath } = await showSaveDialog({
      title:       `Export ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} List`,
      defaultPath: defaultName,
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return

    await writeFile(filePath, csv)
    flash(flashKey, 'success', `Exported ${movies.length} movies`)
  }

  return (
    <section className="space-y-5">
      <div>
        <SectionTitle>Export</SectionTitle>
        <SectionDesc>Export your library to CSV or JSON for backups or spreadsheets.</SectionDesc>
      </div>

      <div className="space-y-3">
        {/* Full library */}
        <div className="flex items-center gap-3">
          <button
            onClick={exportLibrary}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Export Full Library
            <span className="ml-2 text-xs text-gray-500">CSV + JSON</span>
          </button>
          {exportStatus?.key === 'library' && <StatusLine status={exportStatus} />}
        </div>

        {/* Wanted */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportList('wanted', 'filmvault-wanted.csv', 'wanted')}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Export Wanted List
            <span className="ml-2 text-xs text-gray-500">CSV</span>
          </button>
          {exportStatus?.key === 'wanted' && <StatusLine status={exportStatus} />}
        </div>

        {/* Upgrade */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportList('upgrade', 'filmvault-upgrades.csv', 'upgrade')}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Export Upgrade List
            <span className="ml-2 text-xs text-gray-500">CSV</span>
          </button>
          {exportStatus?.key === 'upgrade' && <StatusLine status={exportStatus} />}
        </div>
      </div>
    </section>
  )
}

// ── Remote Server section ─────────────────────────────────────────────────────

function ServerSection() {
  const [url,         setUrl]         = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [status,      setStatus]      = useState(null)   // null | { type, msg }
  const [testing,     setTesting]     = useState(false)

  useEffect(() => {
    Promise.all([
      getSetting('server_url'),
      getSetting('use_server'),
    ]).then(([savedUrl, useServer]) => {
      const u = savedUrl || ''
      setUrl(u)
      setIsConnected(useServer === 'true' && !!u)
    })
  }, [])

  async function handleTest() {
    const base = url.replace(/\/$/, '')
    if (!base) { setStatus({ type: 'error', msg: 'Enter a server URL first.' }); return }
    setTesting(true)
    setStatus(null)
    try {
      const res = await fetch(`${base}/api/settings/tmdb_api_key`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus({ type: 'success', msg: 'FilmVault server is reachable.' })
    } catch (err) {
      setStatus({ type: 'error', msg: `Cannot reach server: ${err.message}` })
    } finally {
      setTesting(false)
    }
  }

  async function handleConnect() {
    const base = url.replace(/\/$/, '')
    if (!base) { setStatus({ type: 'error', msg: 'Enter a server URL first.' }); return }
    await Promise.all([
      setSetting('server_url', base),
      setSetting('use_server', 'true'),
    ])
    localStorage.setItem('filmvault_server_url', base)
    setIsConnected(true)
    setStatus({ type: 'success', msg: `Connected. All API calls now route to ${base}. Restart Electron to also load the server UI directly.` })
  }

  async function handleDisconnect() {
    await setSetting('use_server', 'false')
    localStorage.removeItem('filmvault_server_url')
    setIsConnected(false)
    setStatus({ type: 'success', msg: 'Disconnected. Reload the app to restore local database mode.' })
  }

  return (
    <section className="space-y-5">
      <div>
        <SectionTitle>Remote Server</SectionTitle>
        <SectionDesc>Connect Electron to the shared FilmVault server so both apps use the same database.</SectionDesc>
      </div>

      {/* Connected indicator */}
      {isConnected && (
        <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-400" />
          <p className="min-w-0 flex-1 truncate text-sm text-green-300">{url}</p>
          <button
            onClick={handleDisconnect}
            className="shrink-0 text-xs text-red-400 transition-colors hover:text-red-300"
          >
            Disconnect
          </button>
        </div>
      )}

      {/* URL input */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-gray-300">Server URL</label>
        <p className="text-xs text-gray-500">
          The FilmVault Express server on your network (e.g. http://192.168.0.74:3000).
        </p>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.0.74:3000"
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTest}
          disabled={testing}
          className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button
          onClick={handleConnect}
          disabled={testing}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {isConnected ? 'Update' : 'Use Server'}
        </button>
      </div>

      <StatusLine status={status} />
    </section>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-12">
      <ServerSection />
      <hr className="border-gray-800" />
      <ApiKeysSection />
      <hr className="border-gray-800" />
      <JellyfinSection />
      <hr className="border-gray-800" />
      <ExportSection />
    </div>
  )
}
