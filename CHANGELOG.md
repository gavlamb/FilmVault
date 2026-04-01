# Changelog

## [Session 11] - 2026-04-01

### Added
- `electron/database.js` — `ebay_listings` table (id, tmdb_id, title, price, currency, listing_type, condition, image_url, ebay_url, end_time, bid_count, seller, last_updated, notified_1hr, notified_15min, notified_5min); functions: `upsertEbayListing` (upsert preserving notification flags via ON CONFLICT DO UPDATE), `getEbayListingsForMovie`, `getAllEbayListings`, `getAllWatchedMovies` (wanted + upgrade), `deleteStaleListings`, `clearEbayListings`, `markEbayListingNotified`; `ntfy_topic` added to DEFAULT_SETTINGS
- `server/services/ebay.js` — eBay UK Browse API wrapper: `getEbayToken` (OAuth client_credentials with in-memory cache + 401 invalidation), `searchEbayUK` (EBAY_GB marketplace, DVDs & Blu-ray categories 617/267, limit 20, EXTENDED fieldgroups), `buildEbayQuery` (smart title sanitisation + year disambiguation for short/common titles, targets "4K Blu-ray")
- `server/services/poller.js` — background polling service: dynamic interval (30 s if auction < 10 min, 2 min if < 1 hr, 5 min default), `startPoller` (fires after 10 s on server start), `triggerPoll` (immediate poll + reschedule), `getStatus` (lastPollTime, nextPollTime, totalListings, urgentAuctionCount); ntfy.sh push notifications at 1 hr / 15 min / 5 min thresholds with urgent/high/default priorities
- `server/index.js` — eBay routes: `GET /api/ebay/listings` (all groups sorted: auctions first by end_time, then BIN/Best Offer by price), `GET /api/ebay/listings/:tmdbId`, `POST /api/ebay/poll` (manual trigger), `POST /api/ebay/search` (per-movie search with optional custom query), `GET /api/ebay/status`; `startPoller()` called on server listen
- `src/utils/api.js` — `getEbayListings`, `getEbayListingsForMovie`, `triggerEbayPoll`, `searchEbayForMovie`, `getEbayStatus` (all server-only, no IPC path)
- `src/components/AuctionCountdown.jsx` — live per-second countdown; colour-codes amber → orange → red+pulse as auction approaches
- `src/pages/EbayDashboard.jsx` — grouped view of watched movies with listings; per-movie editable search query with per-movie re-search; listing cards with thumbnail, price, type badge, countdown, condition, seller, "View on eBay"; empty states; 30 s auto-refresh; "Refresh Now" triggers server poll
- `src/App.jsx` — eBay page added to navigation (tag icon); red badge showing count of auctions ending within 1 hr; badge refreshes every 2 min; search bar hidden on eBay page
- `src/pages/Settings.jsx` — Notifications section with ntfy topic field, placed between Jellyfin and Export

## [Session 9] - 2026-03-30

### Added
- `src/utils/omdb.js` — `getIMDbRating(imdbId, apiKey)`: calls OMDB API, returns `{ imdbRating, imdbVotes }` or null
- `src/utils/tmdb.js` — `mapDetailResult` now includes `imdb_id` from TMDB `/movie/{id}` response
- `electron/database.js` — `updateMovieRating(tmdbId, imdbRating, imdbVotes)`; schema migrations add `omdb_rating TEXT` and `omdb_votes TEXT` columns via `ALTER TABLE` (safe on existing DBs); `omdb_api_key` added to default settings
- `electron/preload.js` / `electron/main.js` — `updateMovieRating` IPC handler
- `server/index.js` — `GET /api/movies/search?q=` endpoint; `PATCH /api/movies/:id/rating` endpoint
- `src/utils/api.js` — `searchMovies(query)` and `updateMovieRating(tmdbId, imdbRating, imdbVotes)` exports
- `src/components/SearchBar.jsx` — dual-section dropdown: "In Your Library" (top, up to 4 results with status badge, no hover required) + "From TMDB" (below divider, up to 6 results, deduplicated against library matches); grid filter propagated to parent via `onQueryChange` prop on every keystroke
- `src/pages/Library.jsx` — accepts `searchQuery` prop; filters grid by title (case-insensitive) in addition to status filter; status counts remain stable while typing
- `src/App.jsx` — `searchQuery` state wired between `SearchBar.onQueryChange` and `Library.searchQuery`; cleared on settings navigation
- `src/components/MovieModal.jsx` — on add: fire-and-forget fetches TMDB detail → OMDB rating → stores via `updateMovieRating`; displays ⭐ rating + vote count in movie info header
- `src/components/MovieGrid.jsx` — `MovieCard` shows `⭐ {omdb_rating}` in the info row when present
- `src/pages/Settings.jsx` — OMDB API key field added to API Keys section

## [Session 8] - 2026-03-29

### Added
- `server/index.js` — Express 4 server on port 3000; serves built React app from `dist/`; REST API mirroring all Electron IPC handlers: movies CRUD, collections, settings, poster cache (`GET`/`POST /api/posters/:tmdbId`), Jellyfin sync stub
- `src/utils/api.js` — unified API layer; detects Electron vs browser via `window.electronAPI`; exports `getAllMovies`, `getMovieById`, `addMovie`, `updateMovie`, `deleteMovie`, `getMoviesByStatus`, `updateMovieTmdbData`, `cachePoster`, `updateMoviePoster`, `getAllCollections`, `addCollection`, `getSetting`, `setSetting`, `getAllSettings`, `showSaveDialog`, `writeFile`; browser-mode `writeFile` triggers a Blob download; browser-mode `cachePoster` posts to server for server-side download
- `electron/database.js` — refactored path detection: uses `FILMVAULT_DATA` env var when set, otherwise falls back to `app.getPath('userData')` via lazy `require('electron')`; allows the same module to be used by both Electron and the Express server without modification
- `package.json` — added `express ^4` dependency; added `"server"` and `"build:server"` scripts

### Changed
- All components (`Library`, `Settings`, `MovieModal`, `MovieGrid`, `SearchBar`, `CollectionModal`) now import from `src/utils/api.js` — zero direct `window.electronAPI` calls remain in `src/`

## [Session 7] - 2026-03-29

### Added
- `electron/main.js` — `cache-poster` IPC handler: downloads TMDB poster via Node `https`, saves to `userData/posters/{tmdb_id}.jpg`, returns local path; skips if already cached
- `electron/database.js` — `updateMoviePoster(tmdbId, localPath)`: simple poster path update
- `electron/preload.js` — `cachePoster(url, tmdbId)` and `updateMoviePoster(tmdbId, localPath)` exposed via contextBridge
- `src/components/MovieGrid.jsx` — `MovieCard` caches remote TMDB poster URLs on first render via `cachePoster`; updates DB with `file://` path for offline use
- `src/utils/tmdb.js` — `searchCollections(query, apiKey)` using `/search/collection`; `getCollectionDetails(collectionId, apiKey)` returning sorted parts with full film data
- `src/components/SearchBar.jsx` — parallel `searchMovies` + `searchCollections`; collection results shown above movies with teal "Collection" badge; `onCollectionSelect` prop
- `src/components/CollectionModal.jsx` — new modal showing all films in a collection with poster, year, library status badge; "Add All" with format selector (adds only films not already in library); individual film click opens MovieModal
- `src/App.jsx` — `selectedCollection` state; `handleCollectionSelect` / `handleCollectionModalClose`; renders `<CollectionModal>`

## [Unreleased]

### Fixed
- `SearchBar.jsx` — search dropdown no longer overlaps/loses to library content; added `z-50` on container when open and a full-screen transparent backdrop (`fixed inset-0 z-40`) that blocks library clicks and closes the dropdown on click
- `tmdb.js` — `encodeURIComponent` confirmed on search query; special characters (WALL·E, diacritics, hyphens) route correctly to TMDB

### Added
- `src/utils/tmdb.js` — `searchMovies(query, apiKey)` and `getMovieDetails(tmdbId, apiKey)`; full poster URLs; clean error codes (`NO_API_KEY`, `INVALID_API_KEY`, `TMDB_ERROR:*`)
- `src/components/StatusBadge.jsx` — reusable coloured pill for all 6 statuses; `sm`/`md`/`lg` sizes
- `src/components/SearchBar.jsx` — debounced (400ms) TMDB live search; dropdown with poster thumbnail, title, year; on-hover DB status badge; loading spinner; no-API-key warning; click-outside dismiss; clear button
- `src/App.jsx` — header with logo, centred SearchBar, settings icon stub; library placeholder

---

- `electron/database.js` — full SQLite schema rewrite: `movies` (tmdb_id PK), `collections`, `settings` tables
- Movies: `getAllMovies`, `getMovieById`, `addMovie`, `updateMovie`, `deleteMovie`, `searchMovies`, `getMoviesByStatus`
- Collections: `getAllCollections`, `addCollection`, `updateCollection`
- Settings: `getSetting`, `setSetting`, `getAllSettings`; 9 default settings seeded on first run via `INSERT OR IGNORE`
- `electron/preload.js` — contextBridge updated to expose all 14 DB functions + `getVersion`
- `electron/main.js` — ipcMain handlers registered for all DB and app channels
- 28-assertion test suite (run via `electron test-db.js`); all pass

---

## [0.1.0] - 2026-03-29

### Added
- Initial project scaffold: Electron 28 + React 18 + Vite 5 + Tailwind CSS 3
- `electron/main.js` — BrowserWindow setup; loads Vite dev server in dev, built `dist/` in prod; detects env via `app.isPackaged`
- `electron/preload.js` — contextBridge IPC bridge exposing `window.electronAPI` (getMovies, addMovie, updateMovie, deleteMovie, getVersion)
- `electron/database.js` — better-sqlite3 wrapper; DB stored in Electron `userData`; WAL mode + foreign keys enabled
- SQLite schema: `movies`, `tags`, `movie_tags` tables with cascade deletes
- `src/App.jsx` — minimal React shell with Tailwind dark layout
- `src/index.css` — Tailwind base/components/utilities directives
- electron-builder config for Windows NSIS installer (x64, user-install, desktop + start menu shortcuts)
- `npm run dev` — concurrently launches Vite (:5173) and Electron with wait-on synchronisation
- `npm run build` — Vite build → electron-builder NSIS package → `dist-electron/`
- `.env.example` with TMDB API key placeholder
- `CLAUDE.md` project context file for Claude Code sessions

### Fixed
- Bumped `better-sqlite3` to v11+ (v9.x fails to compile against Node v24 due to C++20/C++17 conflict)
