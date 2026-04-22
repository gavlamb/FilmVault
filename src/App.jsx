import { useState, useEffect } from 'react'
import SearchBar from './components/SearchBar'
import MovieModal from './components/MovieModal'
import CollectionModal from './components/CollectionModal'
import Library from './pages/Library'
import Settings from './pages/Settings'
import EbayDashboard from './pages/EbayDashboard'
import EbaySlidePanel from './components/EbaySlidePanel'
import { getEbayStatus } from './utils/api'

function TagIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 7h.01M7 3H5a2 2 0 00-2 2v2.586a1 1 0 00.293.707l8.414 8.414a2 2 0 002.828 0l2.586-2.586a2 2 0 000-2.828L8.707 3.293A1 1 0 008 3H7z" />
    </svg>
  )
}

function GearIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function App() {
  const [page,               setPage]               = useState('library') // 'library' | 'ebay' | 'settings'
  const [selectedMovie,      setSelectedMovie]      = useState(null)
  const [selectedCollection, setSelectedCollection] = useState(null)
  const [libraryVersion,     setLibraryVersion]     = useState(0)
  const [searchQuery,        setSearchQuery]        = useState('')
  // Bump this when leaving Settings so SearchBar remounts and reloads the API key
  const [searchKey,          setSearchKey]          = useState(0)
  // Badge: auctions ending in < 1 hr
  const [urgentAuctions,     setUrgentAuctions]     = useState(0)
  const [selectedEbayMovie,  setSelectedEbayMovie]  = useState(null)

  useEffect(() => {
    function refreshBadge() {
      getEbayStatus()
        .then((s) => setUrgentAuctions(s?.urgentAuctionCount ?? 0))
        .catch(() => {})
    }
    refreshBadge()
    const id = setInterval(refreshBadge, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  function handleMovieSelect(movie) {
    console.log('[App] handleMovieSelect received:', movie?.title, movie?.tmdb_id)
    setSelectedCollection(null)
    setSelectedMovie(movie)
  }
  function handleCollectionSelect(col) {
    setSelectedMovie(null)
    setSelectedCollection(col)
  }
  function handleModalClose()           { setSelectedMovie(null) }
  function handleCollectionModalClose() { setSelectedCollection(null) }
  function handleSaved()                { setLibraryVersion((v) => v + 1) }

  function goTo(target) {
    setPage((p) => {
      if (p === 'settings' || target !== 'settings') {
        setSearchKey((k) => k + 1)
        setSearchQuery('')
      }
      return p === target ? 'library' : target
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center gap-6 border-b border-gray-800/80 bg-gray-950/95 px-6 py-3 backdrop-blur">
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

        {/* Search — library only */}
        <div className="flex flex-1 justify-center">
          {page === 'library' && (
            <SearchBar
              key={searchKey}
              onMovieSelect={handleMovieSelect}
              onCollectionSelect={handleCollectionSelect}
              onQueryChange={setSearchQuery}
            />
          )}
        </div>

        {/* Nav icons */}
        <div className="flex flex-shrink-0 items-center gap-1">
          {/* eBay Watch */}
          <button
            onClick={() => goTo('ebay')}
            title="eBay Watch"
            className={`relative rounded-lg p-2 transition-colors ${
              page === 'ebay'
                ? 'bg-gray-800 text-indigo-400'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <TagIcon className="h-4 w-4" />
            {urgentAuctions > 0 && page !== 'ebay' && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {urgentAuctions > 9 ? '9+' : urgentAuctions}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => goTo('settings')}
            title={page === 'settings' ? 'Back to Library' : 'Settings'}
            className={`rounded-lg p-2 transition-colors ${
              page === 'settings'
                ? 'bg-gray-800 text-indigo-400'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <GearIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6">
        {page === 'settings' ? (
          <Settings />
        ) : page === 'ebay' ? (
          <EbayDashboard />
        ) : (
          <Library
            onMovieClick={handleMovieSelect}
            onEbayClick={setSelectedEbayMovie}
            refreshKey={libraryVersion}
            searchQuery={searchQuery}
          />
        )}
      </main>

      {/* ── Movie Modal ─────────────────────────────────────────────────── */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={handleModalClose}
          onSaved={handleSaved}
          onMovieClick={handleMovieSelect}
        />
      )}

      {/* ── eBay Slide Panel ────────────────────────────────────────────── */}
      {selectedEbayMovie && (
        <EbaySlidePanel
          movie={selectedEbayMovie}
          onClose={() => setSelectedEbayMovie(null)}
        />
      )}

      {/* ── Collection Modal ─────────────────────────────────────────────── */}
      {selectedCollection && (
        <CollectionModal
          collection={selectedCollection}
          onClose={handleCollectionModalClose}
          onMovieSelect={handleMovieSelect}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

export default App
