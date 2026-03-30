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
  `)

  // Migrations — add columns introduced after initial schema (SQLite throws if already exists)
  try { db.exec('ALTER TABLE movies ADD COLUMN omdb_rating TEXT') } catch {}
  try { db.exec('ALTER TABLE movies ADD COLUMN omdb_votes  TEXT') } catch {}

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

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Movies
  getAllMovies,
  getMovieById,
  addMovie,
  updateMovie,
  deleteMovie,
  searchMovies,
  getMoviesByStatus,
  updateMovieTmdbData,
  updateMoviePoster,
  updateMovieRating,
  // Collections
  getAllCollections,
  addCollection,
  updateCollection,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
}
