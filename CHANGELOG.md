# Changelog

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
