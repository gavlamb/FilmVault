import { useState, useEffect, useCallback } from 'react'
import { getEbayListings, triggerEbayPoll, getEbayStatus, searchEbayForMovie } from '../utils/api'
import { getPosterUrl } from '../utils/posterUrl'
import StatusBadge from '../components/StatusBadge'
import AuctionCountdown from '../components/AuctionCountdown'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price, currency = 'GBP') {
  if (price == null) return '—'
  const sym = currency === 'GBP' ? '£' : currency
  return `${sym}${price.toFixed(2)}`
}

function relativeTime(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)    return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Listing type badge ────────────────────────────────────────────────────────

function ListingTypeBadge({ type, endTime }) {
  const now    = Date.now()
  const ms     = endTime ? new Date(endTime).getTime() - now : Infinity
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

// ── Single listing card ───────────────────────────────────────────────────────

function ListingCard({ listing }) {
  function openListing() {
    if (listing.ebay_url) window.open(listing.ebay_url, '_blank', 'noopener')
  }

  return (
    <div className="flex gap-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3 hover:border-gray-700 transition-colors">
      {/* Thumbnail */}
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => { e.target.style.display = 'none' }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
            </svg>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm text-gray-200 leading-snug">{listing.title}</p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-white">{formatPrice(listing.price, listing.currency)}</span>
          <ListingTypeBadge type={listing.listing_type} endTime={listing.end_time} />
        </div>

        {listing.listing_type === 'AUCTION' && (
          <AuctionCountdown endTime={listing.end_time} />
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {listing.condition && <span>{listing.condition}</span>}
          {listing.seller    && <span>Seller: {listing.seller}</span>}
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-shrink-0 items-start">
        <button
          onClick={openListing}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
        >
          View on eBay
        </button>
      </div>
    </div>
  )
}

// ── Per-movie section ─────────────────────────────────────────────────────────

function MovieSection({ movie, defaultQuery, listings }) {
  const [query,     setQuery]     = useState(defaultQuery)
  const [searching, setSearching] = useState(false)
  const [results,   setResults]   = useState(listings)
  const [error,     setError]     = useState(null)

  // Keep results in sync when parent data refreshes (full poll)
  useEffect(() => { setResults(listings) }, [listings])

  async function handleSearch() {
    setSearching(true)
    setError(null)
    try {
      const data = await searchEbayForMovie(movie.tmdb_id, query)
      setResults(data.listings || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const posterUrl = getPosterUrl(movie.poster_path)

  return (
    <section className="space-y-3">
      {/* Movie header */}
      <div className="flex items-center gap-3">
        <div className="h-[60px] w-10 flex-shrink-0 overflow-hidden rounded-md bg-gray-800">
          {posterUrl ? (
            <img src={posterUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <svg className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
              </svg>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="truncate text-sm font-semibold text-white">{movie.title}</h3>
            {movie.year && <span className="text-xs text-gray-500">{movie.year}</span>}
            <StatusBadge status={movie.status} size="sm" />
          </div>
          <p className="mt-0.5 text-xs text-gray-600">
            {results.length} listing{results.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Query bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !searching && handleSearch()}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          placeholder="Search query…"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Listings */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-600 italic">No listings found for this title.</p>
      )}
    </section>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function EbayDashboard() {
  const [groups,    setGroups]    = useState([])   // [{ movie, query, listings }]
  const [status,    setStatus]    = useState(null)  // { lastPollTime, nextPollTime, … }
  const [loading,   setLoading]   = useState(true)
  const [polling,   setPolling]   = useState(false)
  const [error,     setError]     = useState(null)

  const load = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([getEbayListings(), getEbayStatus()])
      setGroups(g)
      setStatus(s)
      setError(null)
    } catch (err) {
      setError('Failed to load eBay data — is the server running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refresh display every 30 s (countdown timers update themselves)
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  async function handleRefresh() {
    setPolling(true)
    try {
      await triggerEbayPoll()
      // Give the server a moment to process, then reload
      await new Promise((r) => setTimeout(r, 2000))
      await load()
    } catch (err) {
      setError('Poll failed: ' + err.message)
    } finally {
      setPolling(false)
    }
  }

  const watchedCount  = groups.length
  const listingCount  = groups.reduce((n, g) => n + g.listings.length, 0)

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">eBay Watch</h2>
          {status?.lastPollTime ? (
            <p className="mt-0.5 text-xs text-gray-500">
              Last checked {relativeTime(status.lastPollTime)}
              {status.nextPollTime && ` · next in ${relativeTime(status.nextPollTime).replace(' ago', '')}`}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-gray-500">Not yet polled</p>
          )}
          {listingCount > 0 && (
            <p className="mt-0.5 text-xs text-gray-600">
              {listingCount} listing{listingCount !== 1 ? 's' : ''} across {watchedCount} movie{watchedCount !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={polling || loading}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
        >
          {polling ? 'Searching…' : 'Refresh Now'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="py-12 text-center text-sm text-gray-600">Loading…</div>
      )}

      {/* ── Empty — no watched movies ── */}
      {!loading && watchedCount === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 py-12 text-center">
          <p className="text-sm text-gray-500">No movies marked as Wanted or Upgrade.</p>
          <p className="mt-1 text-xs text-gray-600">
            Set a movie's status to Wanted or Upgrade in your library to watch it here.
          </p>
        </div>
      )}

      {/* ── Movie sections ── */}
      {!loading && groups.map(({ movie, query, listings }, i) => (
        <div key={movie.tmdb_id}>
          {i > 0 && <hr className="border-gray-800" />}
          <MovieSection movie={movie} defaultQuery={query} listings={listings} />
        </div>
      ))}
    </div>
  )
}
