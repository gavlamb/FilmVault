const Database = require('better-sqlite3')
const path = require('path')
const { app } = require('electron')

let db

const DEFAULT_SETTINGS = {
  tmdb_api_key:          '',
  jellyfin_url:          '',
  jellyfin_api_key:      '',
  ebay_app_id:           '',
  ebay_cert_id:          '',
  backup_path:           '',
  notifications_sound:   'true',
  notifications_toast:   'true',
  notifications_badge:   'true',
}

function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'filmvault.db')
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
  // Collections
  getAllCollections,
  addCollection,
  updateCollection,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
}
