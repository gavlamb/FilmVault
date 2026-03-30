# FilmVault - Claude Code Context

## Project
Personal movie collection manager. React + Vite + Electron + Tailwind + SQLite.
Dual-mode: Electron desktop app (Windows) or Express HTTP server (Ubuntu mini PC).

## Stack
- Frontend: React 18 + Vite
- Desktop: Electron (Windows)
- Server: Express 4 (Ubuntu / any Node host)
- Database: SQLite (better-sqlite3)
- Styling: Tailwind CSS
- Movie API: TMDB
- Phase 2: eBay UK Browse API
- Mobile: Browser via Tailscale → Express server

## Dual-Mode Architecture
- **Electron mode**: `npm run dev` / `npm run build`. Components call `window.electronAPI` via IPC.
- **Server mode**: `npm run build:server` builds the React app then starts Express on port 3000.
  Set `FILMVAULT_DATA` env var to choose where the DB and poster cache live (default `~/.filmvault`).
- **`src/utils/api.js`**: detects mode via `window.electronAPI` presence; exports identical function
  names regardless of mode — no component ever calls `window.electronAPI` directly.
- **`electron/database.js`**: uses `FILMVAULT_DATA` env if set, otherwise `app.getPath('userData')`,
  so the same module is shared by both Electron and the Express server.
- **`src/utils/posterUrl.js`**: checks `window.electronAPI` at call time — returns `filmvault://posters/{file}`
  in Electron, `/api/posters/{tmdbId}` in browser mode.

## Deployment
- **Ubuntu mini PC**: `192.168.0.74:3000` — Express server running as a systemd service.
- **Windows dev**: Vite on port 3745, Electron loads `http://localhost:3745`.

## Current Status
Sessions 1–9 complete. Full app working in both Electron and server modes.

## Build Order
1. ~~SQLite database schema~~ ✓
2. ~~TMDB search component~~ ✓
3. ~~Library grid + filter bar~~ ✓
4. ~~Add/edit movie modal~~ ✓
5. ~~Jellyfin sync~~ ✓
6. ~~Settings page + exports~~ ✓
7. ~~Offline poster caching~~ ✓
8. ~~Collections in search~~ ✓
9. ~~Express server + dual-mode api.js~~ ✓
10. ~~Library live search filter + IMDb ratings via OMDB~~ ✓
11. eBay integration (Phase 2)

## Windows Process Management
**NEVER use `kill`, `kill -9`, `pkill`, or any Unix process commands. This is Windows.**

Always use:
- Kill by PID: `cmd /c "taskkill /F /PID <pid>"`
- Kill by name: `cmd /c "taskkill /F /IM electron.exe /T"`
- Find port owner: `cmd /c "netstat -ano | findstr :3745"`

To restart the dev server cleanly (kill Electron + free port 3745, then start):
```
cmd /c "taskkill /F /IM electron.exe /T 2>nul & taskkill /F /IM FilmVault.exe /T 2>nul"
cmd /c "netstat -ano | findstr :3745"   ← get PID, then:
cmd /c "taskkill /F /PID <pid>"
npm run dev
```

## Key Decisions
- TMDB ID is primary key (prevents duplicates at DB level)
- Statuses: wanted, upgrade, 4k_bluray, bluray, dvd, digital
- Collections/trilogies supported via collections table
- eBay: UK only, Buy It Now + Auction + Make Offer
- Notifications: Windows toast + in-app badge + sound + ntfy.sh (iPhone)
