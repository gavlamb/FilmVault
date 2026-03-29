# FilmVault - Claude Code Context

## Project
Personal movie collection manager. React + Vite + Electron + Tailwind + SQLite.

## Stack
- Frontend: React 18 + Vite
- Desktop: Electron
- Database: SQLite (better-sqlite3)
- Styling: Tailwind CSS
- Movie API: TMDB
- Phase 2: eBay UK Browse API
- Mobile: Browser via Tailscale

## Current Status
Sessions 1–7 complete. Full app working: search, library grid, add/edit modal, Settings (TMDB + Jellyfin + export), offline poster caching, collections in search results with CollectionModal.

## Build Order
1. ~~SQLite database schema~~ ✓
2. ~~TMDB search component~~ ✓
3. ~~Library grid + filter bar~~ ✓
4. ~~Add/edit movie modal~~ ✓
5. ~~Jellyfin sync~~ ✓
6. ~~Settings page + exports~~ ✓
7. ~~Offline poster caching~~ ✓
8. ~~Collections in search~~ ✓
9. eBay integration (Phase 2)

## Windows Process Management
**NEVER use `kill`, `kill -9`, `pkill`, or any Unix process commands. This is Windows.**

Always use:
- Kill by PID: `cmd /c "taskkill /F /PID <pid>"`
- Kill by name: `cmd /c "taskkill /F /IM electron.exe /T"`
- Find port owner: `cmd /c "netstat -ano | findstr :5173"`

To restart the dev server cleanly (kill Electron + free port 5173, then start):
```
cmd /c "taskkill /F /IM electron.exe /T 2>nul & taskkill /F /IM FilmVault.exe /T 2>nul"
cmd /c "netstat -ano | findstr :5173"   ← get PID, then:
cmd /c "taskkill /F /PID <pid>"
npm run dev
```

## Key Decisions
- TMDB ID is primary key (prevents duplicates at DB level)
- Statuses: wanted, upgrade, 4k_bluray, bluray, dvd, digital
- Collections/trilogies supported via collections table
- eBay: UK only, Buy It Now + Auction + Make Offer
- Notifications: Windows toast + in-app badge + sound + ntfy.sh (iPhone)
