# Handover Brief — Cinematic Movie Modal Redesign

## ⚠️ First: Check for local drift

This brief was prepared against the GitHub main branch, last commit **`1119eab` — "Session 12: eBay slide panel"** (1 April 2026). The user may have uncommitted or unpushed local work that's ahead of this.

Before applying any changes, run:

```bash
git log --oneline -5
git status
```

- If HEAD matches `1119eab` and the tree is clean, apply as described below.
- If there are newer commits or uncommitted changes, check whether any of them touch these files: `electron/database.js`, `electron/main.js`, `electron/preload.js`, `server/index.js`, `src/utils/api.js`, `src/utils/tmdb.js`, `src/components/MovieModal.jsx`, or `src/App.jsx`. If they do, stop and confirm with Gav before proceeding — the snippets below assume the state at `1119eab` and line positions may have shifted.
- The new file `src/components/PersonPanel.jsx` is always safe to add regardless.

## Context

FilmVault's movie detail modal is getting a visual overhaul. The user (Gav) is primarily using the **web version** (Express server on Ubuntu MiniPC at `192.168.0.74:3000`) rather than the Electron build, but the dual-mode architecture means every change needs to work in both paths.

The current modal is cramped: ~144px poster, `max-w-2xl`, no backdrop, no cast, genres not displayed despite being in the DB. The user asked for:

- Larger, inviting layout
- Cinematic backdrop hero (fills top third)
- Bigger poster
- Main cast + director with photos
- Genre chips
- IMDb rating moved into the modal itself (currently only on library cards)
- Clickable cast/director → filmography panel

## Architecture reminder

Before touching anything, re-read `CLAUDE.md` in the repo root. Key points:
- `src/utils/api.js` is the dual-mode gateway — never call `window.electronAPI` or `fetch` directly from components
- `electron/database.js` is shared between Electron and Express server
- TMDB calls happen client-side (key stored in `settings` table)
- Additive migrations use `try { db.exec('ALTER TABLE ...') } catch {}`

## What's been designed already

I've built and build-tested the full implementation in a sandbox. All changes `vite build` cleanly. The user needs you to apply them to the working folder.

Key design decisions already made with the user:
- **Cache strategy**: persist TMDB extras in DB (`backdrop_path`, `tagline`, `director`, `cast_json`, `metadata_fetched_at`) — instant reopens, survives rate limits, works offline
- **Visual direction**: cinematic hero with backdrop filling top third, poster overlaps hero bottom edge
- **Cast interaction**: clickable, opens a PersonPanel overlay with filmography grid

## Files to change

### 1. `electron/database.js`

Add five new columns to the existing migration block (around line 94, keep the existing two lines intact):

```js
  try { db.exec('ALTER TABLE movies ADD COLUMN backdrop_path  TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN tagline        TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN director       TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN cast_json      TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN metadata_fetched_at TEXT') } catch {}
```

Add a new function after `updateMovieRating`:

```js
// Store enriched TMDB metadata (backdrop, tagline, director, cast).
// Called once per movie on first modal open; avoids re-fetching on subsequent opens.
function updateMovieMetadata(tmdbId, metadata) {
  getDb().prepare(`
    UPDATE movies SET
      backdrop_path       = @backdrop_path,
      tagline             = @tagline,
      director            = @director,
      cast_json           = @cast_json,
      metadata_fetched_at = datetime('now')
    WHERE tmdb_id = @tmdb_id
  `).run({
    tmdb_id:       tmdbId,
    backdrop_path: metadata.backdrop_path ?? null,
    tagline:       metadata.tagline       ?? null,
    director:      metadata.director      ?? null,
    cast_json:     metadata.cast_json     ?? null,
  })
}
```

Export it from `module.exports` (after `updateMovieRating`).

### 2. `electron/main.js`

Add after the `db:updateMovieRating` IPC handler:

```js
ipcMain.handle('db:updateMovieMetadata', (_e, tmdbId, metadata) => db.updateMovieMetadata(tmdbId, metadata))
```

### 3. `electron/preload.js`

Add after the `updateMovieRating` entry in the exposed API:

```js
  updateMovieMetadata: (tmdbId, metadata) => ipcRenderer.invoke('db:updateMovieMetadata', tmdbId, metadata),
```

### 4. `server/index.js`

Add after the `PATCH /api/movies/:id/rating` route:

```js
// Store enriched TMDB metadata (backdrop, tagline, director, cast)
app.patch('/api/movies/:id/metadata', (req, res) => {
  db.updateMovieMetadata(Number(req.params.id), req.body || {})
  res.json({ ok: true })
})
```

### 5. `src/utils/api.js`

Add after the `updateMoviePoster` export:

```js
export function updateMovieMetadata(tmdbId, metadata) {
  if (shouldUseIpc()) return window.electronAPI.updateMovieMetadata(tmdbId, metadata)
  return apiFetch(`/api/movies/${tmdbId}/metadata`, { method: 'PATCH', body: metadata })
}
```

### 6. `src/utils/tmdb.js`

Add these constants and helpers near the top (after `POSTER_BASE`):

```js
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original'
const PROFILE_BASE  = 'https://image.tmdb.org/t/p/w185'

function profileUrl(path) {
  return path ? `${PROFILE_BASE}${path}` : null
}

function backdropUrl(path) {
  return path ? `${BACKDROP_BASE}${path}` : null
}
```

Add two new exports at the bottom of the file (keep the existing `getMovieDetails` as-is):

```js
// Fetches full metadata used by the detail modal — credits, backdrop, tagline.
// Uses append_to_response to do it in one request.
export async function getFullMovieDetails(tmdbId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const url  = `${TMDB_BASE}/movie/${tmdbId}?language=en-US&append_to_response=credits`
  const data = await apiFetch(url, apiKey)

  const director = (data.credits?.crew || [])
    .find((c) => c.job === 'Director')
  const cast = (data.credits?.cast || [])
    .slice(0, 10)
    .map((c) => ({
      id:        c.id,
      name:      c.name,
      character: c.character,
      profile:   profileUrl(c.profile_path),
    }))

  return {
    backdrop_path: backdropUrl(data.backdrop_path),
    tagline:       data.tagline || null,
    director:      director
      ? JSON.stringify({ id: director.id, name: director.name, profile: profileUrl(director.profile_path) })
      : null,
    cast_json:     JSON.stringify(cast),
    genres:        JSON.stringify((data.genres || []).map((g) => g.name)),
    runtime:       data.runtime || null,
    overview:      data.overview || '',
    imdb_id:       data.imdb_id || null,
  }
}

// Fetches a person's movie credits for the filmography panel.
export async function getPersonMovieCredits(personId, apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error('NO_API_KEY')

  const [personUrl, creditsUrl] = [
    `${TMDB_BASE}/person/${personId}?language=en-US`,
    `${TMDB_BASE}/person/${personId}/movie_credits?language=en-US`,
  ]
  const [person, credits] = await Promise.all([
    apiFetch(personUrl, apiKey),
    apiFetch(creditsUrl, apiKey),
  ])

  const byMovie = new Map()
  for (const c of credits.cast || []) {
    byMovie.set(c.id, { ...c, role: c.character, _kind: 'cast' })
  }
  for (const c of credits.crew || []) {
    if (!byMovie.has(c.id)) byMovie.set(c.id, { ...c, role: c.job, _kind: 'crew' })
  }

  const films = [...byMovie.values()]
    .filter((m) => m.release_date)
    .map((m) => ({
      tmdb_id:     m.id,
      title:       m.title,
      year:        parseInt(m.release_date.slice(0, 4), 10) || null,
      poster_path: posterUrl(m.poster_path),
      role:        m.role,
      overview:    m.overview || '',
      popularity:  m.popularity || 0,
    }))
    .sort((a, b) => (b.year || 0) - (a.year || 0))

  return {
    id:         person.id,
    name:       person.name,
    profile:    profileUrl(person.profile_path),
    biography:  person.biography || '',
    birthday:   person.birthday || null,
    place:      person.place_of_birth || null,
    known_for:  person.known_for_department || null,
    films,
  }
}
```

### 7. `src/components/MovieModal.jsx` — REPLACE entirely

Full file provided in `MovieModal.jsx` (attached in handover package). Key structural changes:
- `max-w-4xl` (up from `2xl`)
- Cinematic `<Hero>` subcomponent — 16:7 aspect, backdrop with dark gradient overlay for legibility
- Poster overlaps hero via `-mt-28 sm:-mt-36`, w-44/w-56 (up from w-36)
- Title block with tagline in italic, one-row meta (year • runtime • IMDb pill)
- Genre chips row
- Overview (no longer `line-clamp-3` — show it all)
- CastRail subcomponent: horizontal scroll, director chip (indigo role label) first, then cast chips (grey role labels)
- Existing add/edit/remove logic preserved — just restyled inside a new layout
- Effect uses cached DB fields when `metadata_fetched_at` exists; otherwise fetches via `getFullMovieDetails` and persists via `updateMovieMetadata`
- Persists **only if movie is in library** (no phantom rows from just viewing TMDB results)
- Esc defers to PersonPanel when one is open

### 8. `src/components/PersonPanel.jsx` — NEW FILE

Full file provided in `PersonPanel.jsx` (attached). Overlay with headshot, name, known-for, birthday, place, biography, and 12-film featured grid sorted by popularity.

**Known incomplete wiring**: Clicking a filmography tile currently just closes the panel. To make it open that film in the main modal, `App.jsx` needs to pass an `onMovieClick` handler down through `MovieModal` → `PersonPanel`. The prop is already accepted by PersonPanel (see `handleFilmClick`), just not wired up yet. Ask the user whether to finish this wiring now or defer.

## Testing checklist

1. `npm run build:vite` — should build cleanly
2. Start dev mode, open an existing library movie — first open should fetch+cache extras (brief delay, then backdrop + cast appear)
3. Close and reopen same movie — should be instant (DB cache hit)
4. Open a movie from TMDB search results (not in library yet) — should show extras but NOT persist (check DB — no new row should appear until user clicks Add)
5. Click a cast chip — PersonPanel should open with headshot + filmography grid
6. Esc in PersonPanel should close only the panel, not the movie modal
7. Add/edit/remove logic should still work exactly as before

## Deployment to MiniPC (Ubuntu)

After verifying on Windows dev, Gav needs to sync to `192.168.0.74`. Usual flow:

```bash
# On MiniPC
cd ~/FilmVault
git pull
npm install --production=false  # pulls in any new deps (none in this change, but safe)
npm run build:vite              # rebuild dist/
sudo systemctl restart filmvault  # or however the service is named
```

The DB migration runs automatically on server startup — the five new `ALTER TABLE` statements add columns idempotently.

## Notes on the `App.jsx` wiring if user wants it finished

To wire filmography click-through:

1. In `App.jsx`, `handleMovieSelect` already accepts a movie object with `tmdb_id`. PersonPanel's films have `tmdb_id` but not the fully-hydrated shape that the modal expects.
2. Simplest path: pass `handleMovieSelect` down as `onMovieClick` to MovieModal, which passes it to PersonPanel. On click, close the person panel, then call `onMovieClick({ tmdb_id, title, year, poster_path, overview, genres: '[]', runtime: null })`. The modal's own `useEffect` will then fetch whatever's missing.
3. Careful: the modal's `useEffect` depends on `movie?.tmdb_id`, so swapping the movie will correctly re-run everything.

## What the user says matters most

Gav prefers:
- Honest critical feedback, not diplomatic softening
- Local control, open-source, minimal dependencies — don't suggest adding React Query or a styling framework change
- Clean, readable code over clever patterns — the existing `api.js` dual-mode gateway is a good example of his preferred style
- Detailed explanations for decisions, but not padding

Don't suggest TypeScript migration, Next.js, or anything that'd require rewriting large portions of the app.
