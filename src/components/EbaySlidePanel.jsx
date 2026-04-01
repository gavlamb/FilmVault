import { useState, useEffect, useCallback } from 'react'
import { getEbayListingsForMovie, searchEbayForMovie } from '../utils/api'
import { getPosterUrl } from '../utils/posterUrl'
import StatusBadge from './StatusBadge'
import AuctionCountdown from './AuctionCountdown'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price, currency = 'GBP') {
  if (price == null) return '—'
  return `${currency === 'GBP' ? '£' : currency}${price.toFixed(2)}`
}

// ── Listing type badge ────────────────────────────────────────────────────────

function ListingTypeBadge({ type, endTime }) {
  const ms     = endTime ? new Date(endTime).getTime() - Date.now() : Infinity
  const urgent = type === 'AUCTION' && ms < 15 * 60 * 1000

  if (type === 'AUCTION') {
    const colour = ms < 15 * 60 * 1000 ? 'bg-red-500/20 text-red-300 border-red-500/40'
                 : ms < 60 * 60 * 1000 ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                 : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    return (
      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${colour} ${urgent ? 'animate-pulse' : ''}`}>
        AUCTION
      </span>
    )
  }
  if (type === 'BEST_OFFER') {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-300">
        BEST OFFER
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-green-300">
      BUY NOW
    </span>
  )
}

// ── Listing card ──────────────────────────────────────────────────────────────

function ListingCard({ listing }) {
  return (
    <div className="flex gap-3 rounded-lg border border-gray-700/60 bg-gray-800/50 p-3 hover:border-gray-600/60 transition-colors">
      {/* Thumbnail */}
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-700">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-xs text-gray-200 leading-snug">{listing.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold text-white">{formatPrice(listing.price, listing.currency)}</span>
          <ListingTypeBadge type={listing.listing_type} endTime={listing.end_time} />
        </div>
        {listing.listing_type === 'AUCTION' && (
          <AuctionCountdown endTime={listing.end_time} />
        )}
        <div className="flex flex-wrap gap-x-2 text-[10px] text-gray-500">
          {listing.condition && <span>{listing.condition}</span>}
          {listing.seller    && <span>{listing.seller}</span>}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-shrink-0 items-start pt-0.5">
        <button
          onClick={() => listing.ebay_url && window.open(listing.ebay_url, '_blank', 'noopener')}
          className="rounded-md border border-gray-600 bg-gray-700 px-2 py-1 text-[10px] font-medium text-gray-300 transition-colors hover:bg-gray-600 hover:text-white whitespace-nowrap"
        >
          View on eBay
        </button>
      </div>
    </div>
  )
}

// ── Filter / sort constants ───────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'FIXED_PRICE', label: 'Buy It Now' },
  { value: 'AUCTION',     label: 'Auction' },
  { value: 'BEST_OFFER',  label: 'Best Offer' },
]

const SORT_OPTIONS = [
  { value: 'best_match', label: 'Best Match' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
]

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function EbaySlidePanel({ movie, onClose }) {
  const [listings,    setListings]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [visible,     setVisible]     = useState(false)   // drives CSS enter transition
  const [activeTypes, setActiveTypes] = useState(new Set())
  const [sort,        setSort]        = useState('best_match')

  // Slide in after first paint
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(id)
  }, [])

  // Escape key closes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Load listings; if none cached, trigger a fresh search automatically
  const load = useCallback(async (forceSearch = false) => {
    try {
      if (forceSearch) {
        setRefreshing(true)
        const data = await searchEbayForMovie(movie.tmdb_id)
        setListings(data.listings || [])
      } else {
        setLoading(true)
        const cached = await getEbayListingsForMovie(movie.tmdb_id)
        if (cached.length > 0) {
          setListings(cached)
          setLoading(false)
          // Silently refresh in background
          searchEbayForMovie(movie.tmdb_id)
            .then((data) => setListings(data.listings || []))
            .catch(() => {})
        } else {
          // No cache — run a fresh search
          const data = await searchEbayForMovie(movie.tmdb_id)
          setListings(data.listings || [])
          setLoading(false)
        }
      }
    } catch {
      // Leave existing listings on failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [movie.tmdb_id])

  useEffect(() => { load() }, [load])

  // Filter + sort
  function applySort(arr) {
    if (sort === 'price_asc')  return [...arr].sort((a, b) => (a.price ?? Infinity)  - (b.price ?? Infinity))
    if (sort === 'price_desc') return [...arr].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))
    return arr
  }

  const filtered = applySort(
    activeTypes.size === 0 ? listings : listings.filter((l) => activeTypes.has(l.listing_type))
  )

  const typeCounts = listings.reduce((acc, l) => {
    acc[l.listing_type] = (acc[l.listing_type] || 0) + 1
    return acc
  }, {})

  function toggleType(type) {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }

  const posterUrl = getPosterUrl(movie.poster_path)

  return (
    <>
      {/* Panel */}
      <div
        className={`
          fixed right-0 top-0 z-[500] flex h-screen w-full flex-col bg-gray-900 shadow-2xl shadow-black/60
          border-l border-gray-700/60 sm:w-[420px]
          transition-transform duration-300 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 space-y-3 border-b border-gray-700/60 p-4">

          {/* Movie info row */}
          <div className="flex items-center gap-3">
            <div className="h-[50px] w-[33px] flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
              {posterUrl ? (
                <img src={posterUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg className="h-3.5 w-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
                  </svg>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="truncate text-sm font-semibold text-white">{movie.title}</span>
                {movie.year && <span className="text-xs text-gray-500">{movie.year}</span>}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <StatusBadge status={movie.status} size="sm" />
                <span className="text-xs text-gray-500">
                  {loading ? 'Searching…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                onClick={() => load(true)}
                disabled={refreshing || loading}
                title="Refresh listings"
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300 disabled:opacity-40"
              >
                <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={onClose}
                title="Close"
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap items-center gap-1">
            {TYPE_FILTERS.map((f) => {
              const isAll    = f.value === 'all'
              const isActive = isAll ? activeTypes.size === 0 : activeTypes.has(f.value)
              const count    = isAll
                ? listings.length
                : (typeCounts[f.value] || 0)
              return (
                <button
                  key={f.value}
                  onClick={() => isAll ? setActiveTypes(new Set()) : toggleType(f.value)}
                  className={`
                    flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors
                    ${isActive
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-700/60 bg-gray-800/60 text-gray-400 hover:bg-gray-700/60 hover:text-gray-300'}
                  `}
                >
                  {f.label}
                  <span className={`rounded-full px-1 py-px text-[9px] font-semibold tabular-nums ${isActive ? 'bg-indigo-500/60 text-indigo-100' : 'bg-gray-700 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}

            {/* Sort — right-aligned */}
            <div className="ml-auto flex items-center gap-0.5">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSort(s.value)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    sort === s.value
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="h-6 w-6 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500">
                {activeTypes.size > 0 ? 'No listings match the selected filter.' : 'No eBay listings found.'}
              </p>
              {activeTypes.size === 0 && (
                <p className="mt-1 text-xs text-gray-600">Try the Refresh button to search eBay now.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
