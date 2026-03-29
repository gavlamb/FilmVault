import { useState } from 'react'
import SearchBar from './components/SearchBar'
import MovieModal from './components/MovieModal'
import Library from './pages/Library'

function App() {
  const [devKey,        setDevKey]        = useState('')
  const [devSaved,      setDevSaved]      = useState(false)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [libraryVersion, setLibraryVersion] = useState(0)

  function handleMovieSelect(movie) {
    setSelectedMovie(movie)
  }

  function handleModalClose() {
    setSelectedMovie(null)
  }

  function handleSaved() {
    setLibraryVersion((v) => v + 1)
  }

  async function saveDevKey() {
    if (!devKey.trim()) return
    await window.electronAPI.setSetting('tmdb_api_key', devKey.trim())
    setDevKey('')
    setDevSaved(true)
    setTimeout(() => setDevSaved(false), 2000)
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-6 border-b border-gray-800/80 bg-gray-950/95 px-6 py-3 backdrop-blur">
        {/* Logo */}
        <div className="flex flex-shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold leading-none text-white">FilmVault</h1>
            <p className="mt-0.5 text-[10px] leading-none text-gray-500">collection manager</p>
          </div>
        </div>

        {/* Search — takes remaining space */}
        <div className="flex flex-1 justify-center">
          <SearchBar onMovieSelect={handleMovieSelect} />
        </div>

        {/* Right-side controls */}
        <div className="flex flex-shrink-0 items-center justify-end gap-1">
          {import.meta.env.DEV && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={devKey}
                onChange={e => setDevKey(e.target.value)}
                placeholder="Paste TMDB API key here"
                className="w-48 rounded-md border border-yellow-700/50 bg-gray-900 px-2 py-1 text-[11px] text-gray-300 placeholder-gray-600 outline-none focus:border-yellow-500"
              />
              <button
                onClick={saveDevKey}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-yellow-500 ring-1 ring-yellow-700 transition-colors hover:bg-yellow-900/30"
              >
                Save Key
              </button>
              {devSaved && (
                <span className="text-[11px] font-medium text-green-400">Saved!</span>
              )}
            </div>
          )}
          <button
            title="Settings"
            className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6">
        <Library
          onMovieClick={handleMovieSelect}
          refreshKey={libraryVersion}
        />
      </main>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default App
