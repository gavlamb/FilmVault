const Database = require('better-sqlite3')
const path = require('path')

// Works in both Electron and plain Node (server mode).
// Server mode sets FILMVAULT_DATA before requiring this module.
function getDataDir() {
  if (process.env.FILMVAULT_DATA) return process.env.FILMVAULT_DATA
  const { app } = require('electron')
  return app.getPath('userData')
}

let db

const DEFAULT_SETTINGS = {
  tmdb_api_key:          '',
  omdb_api_key:          '',
  jellyfin_url:          '',
  jellyfin_api_key:      '',
  ebay_app_id:           '',
  ebay_cert_id:          '',
  backup_path:           '',
  notifications_sound:   'true',
  notifications_toast:   'true',
  notifications_badge:   'true',
  server_url:            '',
  use_server:            'false',
  ntfy_topic:            '',
}

function getDb() {
  if (!db) {
    const dbPath = path.join(getDataDir(), 'filmvault.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema()
  }
  return db
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      tmdb_id       INTEGER PRIMARY KEY,
      title         TEXT    NOT NULL,
      year          INTEGER,
      poster_path   TEXT,
      status        TEXT    NOT NULL,
      format        TEXT,
      is_collection INTEGER DEFAULT 0,
      collection_id INTEGER,
      jellyfin_id   TEXT,
      date_added    TEXT    DEFAULT (datetime('now')),
      notes         TEXT,
      ebay_watch    INTEGER DEFAULT 0,
      genres        TEXT,
      runtime       INTEGER,
      overview      TEXT
    );

    CREATE TABLE IF NOT EXISTS collections (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL,
      tmdb_collection_id INTEGER,
      poster_path        TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS ebay_listings (
      id             TEXT    PRIMARY KEY,
      tmdb_id        INTEGER,
      title          TEXT,
      price          REAL,
      currency       TEXT    DEFAULT 'GBP',
      listing_type   TEXT,
      condition      TEXT,
      image_url      TEXT,
      ebay_url       TEXT,
      end_time       TEXT,
      bid_count      INTEGER DEFAULT 0,
      seller         TEXT,
      last_updated   TEXT,
      notified_1hr   INTEGER DEFAULT 0,
      notified_15min INTEGER DEFAULT 0,
      notified_5min  INTEGER DEFAULT 0
    );
  `)

  // Migrations — add columns introduced after initial schema (SQLite throws if already exists)
  try { db.exec('ALTER TABLE movies ADD COLUMN omdb_rating TEXT') } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN omdb_votes  TEXT') } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN backdrop_path  TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN tagline        TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN director       TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN cast_json      TEXT')    } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN metadata_fetched_at TEXT') } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN logo_path TEXT') } catch {}

  // Insert defaults only for missing keys (INSERT OR IGNORE)
  const insertDefault = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  )
  const seedDefaults = db.transaction((defaults) => {
    for (const [key, value] of Object.entries(defaults)) {
      insertDefault.run(key, value)
    }
  })
  seedDefaults(DEFAULT_SETTINGS)

  // One-off migration: invalidate old cast caches so they re-fetch with full cast list
  const migrationKey = 'full_cast_migration_v1'
  const alreadyRun = db.prepare('SELECT value FROM settings WHERE key = ?').get(migrationKey)
  if (!alreadyRun) {
    try {
      db.exec("UPDATE movies SET metadata_fetched_at = NULL")
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(migrationKey, 'done')
    } catch {}
  }

  // One-off migration: invalidate metadata caches so existing entries re-fetch with logo_path
  const logoMigrationKey = 'logo_migration_v1'
  const logoAlreadyRun = db.prepare('SELECT value FROM settings WHERE key = ?').get(logoMigrationKey)
  if (!logoAlreadyRun) {
    try {
      db.exec("UPDATE movies SET metadata_fetched_at = NULL")
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(logoMigrationKey, 'done')
    } catch {}
  }

  // One-off migration: invalidate metadata for movies with missing genres so they re-fetch
  const genresMigrationKey = 'genres_backfill_v1'
  const genresAlreadyRun = db.prepare('SELECT value FROM settings WHERE key = ?').get(genresMigrationKey)
  if (!genresAlreadyRun) {
    try {
      db.exec("UPDATE movies SET metadata_fetched_at = NULL WHERE genres IS NULL OR genres = '[]' OR genres = ''")
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(genresMigrationKey, 'done')
    } catch {}
  }
}

// ─── Movies ───────────────────────────────────────────────────────────────────

function getAllMovies() {
  return getDb()
    .prepare('SELECT * FROM movies ORDER BY date_added DESC')
    .all()
}

function getMovieById(tmdbId) {
  return getDb()
    .prepare('SELECT * FROM movies WHERE tmdb_id = ?')
    .get(tmdbId)
}

// Returns a map of { [tmdb_id]: { omdb_rating, omdb_votes } } for the given ids.
// Only movies already in the library will have entries.
function getMoviesRatings(tmdbIds) {
  if (!tmdbIds || tmdbIds.length === 0) return {}
  const placeholders = tmdbIds.map(() => '?').join(',')
  const rows = getDb()
    .prepare(`SELECT tmdb_id, omdb_rating, omdb_votes FROM movies WHERE tmdb_id IN (${placeholders})`)
    .all(...tmdbIds)
  const map = {}
  for (const row of rows) map[row.tmdb_id] = { omdb_rating: row.omdb_rating, omdb_votes: row.omdb_votes }
  return map
}

function addMovie(movie) {
  getDb().prepare(`
    INSERT INTO movies (
      tmdb_id, title, year, poster_path, status, format,
      is_collection, collection_id, jellyfin_id, notes,
      ebay_watch, genres, runtime, overview
    ) VALUES (
      @tmdb_id, @title, @year, @poster_path, @status, @format,
      @is_collection, @collection_id, @jellyfin_id, @notes,
      @ebay_watch, @genres, @runtime, @overview
    )
  `).run(movie)
  return getMovieById(movie.tmdb_id)
}

function updateMovie(tmdbId, movie) {
  getDb().prepare(`
    UPDATE movies SET
      title         = @title,
      year          = @year,
      poster_path   = @poster_path,
      status        = @status,
      format        = @format,
      is_collection = @is_collection,
      collection_id = @collection_id,
      jellyfin_id   = @jellyfin_id,
      notes         = @notes,
      ebay_watch    = @ebay_watch,
      genres        = @genres,
      runtime       = @runtime,
      overview      = @overview
    WHERE tmdb_id = @tmdb_id
  `).run({ ...movie, tmdb_id: tmdbId })
  return getMovieById(tmdbId)
}

function deleteMovie(tmdbId) {
  getDb().prepare('DELETE FROM movies WHERE tmdb_id = ?').run(tmdbId)
}

function searchMovies(query) {
  const like = `%${query}%`
  return getDb().prepare(`
    SELECT * FROM movies
    WHERE title LIKE ? OR overview LIKE ?
    ORDER BY title ASC
  `).all(like, like)
}

function getMoviesByStatus(status) {
  return getDb()
    .prepare('SELECT * FROM movies WHERE status = ? ORDER BY title ASC')
    .all(status)
}

function updateMoviePoster(tmdbId, localPath) {
  getDb()
    .prepare('UPDATE movies SET poster_path = ? WHERE tmdb_id = ?')
    .run(localPath, tmdbId)
}

function updateMovieRating(tmdbId, imdbRating, imdbVotes) {
  getDb()
    .prepare('UPDATE movies SET omdb_rating = ?, omdb_votes = ? WHERE tmdb_id = ?')
    .run(imdbRating ?? null, imdbVotes ?? null, tmdbId)
}

// Store enriched TMDB metadata (backdrop, tagline, director, cast, logo, genres, runtime).
// Called once per movie on first modal open; avoids re-fetching on subsequent opens.
// COALESCE preserves existing genres/runtime if the new value is null.
function updateMovieMetadata(tmdbId, metadata) {
  getDb().prepare(`
    UPDATE movies SET
      backdrop_path       = @backdrop_path,
      tagline             = @tagline,
      director            = @director,
      cast_json           = @cast_json,
      logo_path           = @logo_path,
      genres              = COALESCE(@genres, genres),
      runtime             = COALESCE(@runtime, runtime),
      metadata_fetched_at = datetime('now')
    WHERE tmdb_id = @tmdb_id
  `).run({
    tmdb_id:       tmdbId,
    backdrop_path: metadata.backdrop_path ?? null,
    tagline:       metadata.tagline       ?? null,
    director:      metadata.director      ?? null,
    cast_json:     metadata.cast_json     ?? null,
    logo_path:     metadata.logo_path     ?? null,
    genres:        metadata.genres        ?? null,
    runtime:       metadata.runtime       ?? null,
  })
}

// ─── Collections ──────────────────────────────────────────────────────────────

function getAllCollections() {
  return getDb()
    .prepare('SELECT * FROM collections ORDER BY name ASC')
    .all()
}

function addCollection(collection) {
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO collections (name, tmdb_collection_id, poster_path)
    VALUES (@name, @tmdb_collection_id, @poster_path)
  `).run(collection)
  return getDb()
    .prepare('SELECT * FROM collections WHERE id = ?')
    .get(lastInsertRowid)
}

function updateCollection(id, collection) {
  getDb().prepare(`
    UPDATE collections SET
      name               = @name,
      tmdb_collection_id = @tmdb_collection_id,
      poster_path        = @poster_path
    WHERE id = @id
  `).run({ ...collection, id })
  return getDb()
    .prepare('SELECT * FROM collections WHERE id = ?')
    .get(id)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key)
  return row ? row.value : null
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, String(value))
}

function getAllSettings() {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

// Replaces a synthetic (negative) tmdb_id with the real TMDB ID and sets
// poster_path.  Three cases:
//   • oldId === newId         → just update poster_path in place
//   • newId already in DB    → update poster on real entry, delete synthetic
//   • newId not in DB        → UPDATE PK from old to new, set poster_path
function updateMovieTmdbData(oldTmdbId, newTmdbId, posterPath) {
  const db = getDb()

  if (oldTmdbId === newTmdbId) {
    db.prepare('UPDATE movies SET poster_path = ? WHERE tmdb_id = ?')
      .run(posterPath, oldTmdbId)
    return getMovieById(oldTmdbId)
  }

  if (getMovieById(newTmdbId)) {
    // Real entry already exists — keep it, update its poster, drop the synthetic
    db.prepare('UPDATE movies SET poster_path = ? WHERE tmdb_id = ?')
      .run(posterPath, newTmdbId)
    deleteMovie(oldTmdbId)
    return getMovieById(newTmdbId)
  }

  // Safe to update the PRIMARY KEY (no conflict)
  db.prepare('UPDATE movies SET tmdb_id = ?, poster_path = ? WHERE tmdb_id = ?')
    .run(newTmdbId, posterPath, oldTmdbId)
  return getMovieById(newTmdbId)
}

// ─── eBay listings ────────────────────────────────────────────────────────────

// Upsert preserves notification flags on existing rows so we don't re-notify.
function upsertEbayListing(listing) {
  getDb().prepare(`
    INSERT INTO ebay_listings (
      id, tmdb_id, title, price, currency, listing_type, condition,
      image_url, ebay_url, end_time, bid_count, seller, last_updated,
      notified_1hr, notified_15min, notified_5min
    ) VALUES (
      @id, @tmdb_id, @title, @price, @currency, @listing_type, @condition,
      @image_url, @ebay_url, @end_time, @bid_count, @seller, @last_updated,
      @notified_1hr, @notified_15min, @notified_5min
    )
    ON CONFLICT(id) DO UPDATE SET
      tmdb_id      = excluded.tmdb_id,
      title        = excluded.title,
      price        = excluded.price,
      currency     = excluded.currency,
      listing_type = excluded.listing_type,
      condition    = excluded.condition,
      image_url    = excluded.image_url,
      ebay_url     = excluded.ebay_url,
      end_time     = excluded.end_time,
      bid_count    = excluded.bid_count,
      seller       = excluded.seller,
      last_updated = excluded.last_updated
  `).run(listing)
}

function getEbayListingsForMovie(tmdbId) {
  return getDb()
    .prepare('SELECT * FROM ebay_listings WHERE tmdb_id = ? ORDER BY end_time ASC, price ASC')
    .all(tmdbId)
}

function getAllEbayListings() {
  return getDb()
    .prepare('SELECT * FROM ebay_listings ORDER BY end_time ASC, price ASC')
    .all()
}

function getAllWatchedMovies() {
  return getDb()
    .prepare("SELECT * FROM movies WHERE status = 'wanted' OR status = 'upgrade' ORDER BY title ASC")
    .all()
}

function deleteStaleListings(tmdbId, currentIds) {
  if (currentIds.length === 0) {
    getDb().prepare('DELETE FROM ebay_listings WHERE tmdb_id = ?').run(tmdbId)
    return
  }
  const placeholders = currentIds.map(() => '?').join(',')
  getDb()
    .prepare(`DELETE FROM ebay_listings WHERE tmdb_id = ? AND id NOT IN (${placeholders})`)
    .run(tmdbId, ...currentIds)
}

function clearEbayListings(tmdbId) {
  getDb().prepare('DELETE FROM ebay_listings WHERE tmdb_id = ?').run(tmdbId)
}

// level: '1hr' | '15min' | '5min'
function markEbayListingNotified(id, level) {
  const col = { '1hr': 'notified_1hr', '15min': 'notified_15min', '5min': 'notified_5min' }[level]
  if (!col) return
  getDb().prepare(`UPDATE ebay_listings SET ${col} = 1 WHERE id = ?`).run(id)
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Movies
  getAllMovies,
  getMovieById,
  getMoviesRatings,
  addMovie,
  updateMovie,
  deleteMovie,
  searchMovies,
  getMoviesByStatus,
  updateMovieTmdbData,
  updateMoviePoster,
  updateMovieRating,
  updateMovieMetadata,
  // Collections
  getAllCollections,
  addCollection,
  updateCollection,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // eBay
  upsertEbayListing,
  getEbayListingsForMovie,
  getAllEbayListings,
  getAllWatchedMovies,
  deleteStaleListings,
  clearEbayListings,
  markEbayListingNotified,
}
