const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron')
const path  = require('path')
const fs    = require('fs')
const https = require('https')
const db    = require('./database')

const isDev = !app.isPackaged

// Read the remote server URL from the local DB (set via Settings page).
// Returns null when the user hasn't configured or enabled a server.
function getConfiguredServerUrl() {
  try {
    if (db.getSetting('use_server') !== 'true') return null
    const url = db.getSetting('server_url')
    return url ? url.replace(/\/$/, '') : null
  } catch {
    return null
  }
}

function createWindow() {
  const serverUrl = getConfiguredServerUrl()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Pass the server URL to the preload so api.js can detect remote mode
      // even when window.electronAPI is present.
      additionalArguments: serverUrl ? [`--filmvault-server=${serverUrl}`] : [],
    },
    show: false,
  })

  if (serverUrl) {
    // Electron becomes a wrapper around the shared server UI
    win.loadURL(serverUrl)
  } else if (isDev) {
    win.loadURL('http://localhost:3745')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.once('ready-to-show', () => win.show())
}

// ─── IPC: Movies ──────────────────────────────────────────────────────────────
ipcMain.handle('db:getAllMovies',       ()              => db.getAllMovies())
ipcMain.handle('db:getMovieById',       (_e, tmdbId)    => db.getMovieById(tmdbId))
ipcMain.handle('db:getMoviesRatings',   (_e, tmdbIds)   => db.getMoviesRatings(tmdbIds))
ipcMain.handle('db:addMovie',           (_e, movie)     => db.addMovie(movie))
ipcMain.handle('db:updateMovie',        (_e, id, movie) => db.updateMovie(id, movie))
ipcMain.handle('db:deleteMovie',        (_e, tmdbId)    => db.deleteMovie(tmdbId))
ipcMain.handle('db:searchMovies',       (_e, query)     => db.searchMovies(query))
ipcMain.handle('db:getMoviesByStatus',   (_e, status)           => db.getMoviesByStatus(status))
ipcMain.handle('db:updateMovieTmdbData', (_e, oldId, newId, poster) => db.updateMovieTmdbData(oldId, newId, poster))
ipcMain.handle('db:updateMoviePoster',   (_e, tmdbId, localPath)    => db.updateMoviePoster(tmdbId, localPath))
ipcMain.handle('db:updateMovieRating',    (_e, tmdbId, rating, votes)    => db.updateMovieRating(tmdbId, rating, votes))
ipcMain.handle('db:updateMovieMetadata', (_e, tmdbId, metadata) => db.updateMovieMetadata(tmdbId, metadata))

// ─── IPC: Collections ─────────────────────────────────────────────────────────
ipcMain.handle('db:getAllCollections',  ()               => db.getAllCollections())
ipcMain.handle('db:addCollection',     (_e, collection) => db.addCollection(collection))
ipcMain.handle('db:updateCollection',  (_e, id, col)    => db.updateCollection(id, col))

// ─── IPC: Settings ────────────────────────────────────────────────────────────
ipcMain.handle('db:getSetting',     (_e, key)        => db.getSetting(key))
ipcMain.handle('db:setSetting',     (_e, key, value) => db.setSetting(key, value))
ipcMain.handle('db:getAllSettings', ()               => db.getAllSettings())

// ─── IPC: Poster cache ────────────────────────────────────────────────────────
ipcMain.handle('cache-poster', async (_e, url, tmdbId) => {
  const postersDir = path.join(app.getPath('userData'), 'posters')
  if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true })
  const dest = path.join(postersDir, `${tmdbId}.jpg`)
  const filename = `${tmdbId}.jpg`
  // If already cached, return immediately
  if (fs.existsSync(dest)) return filename
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close()
        fs.unlink(dest, () => {})
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve(filename) })
    }).on('error', (err) => {
      file.close()
      fs.unlink(dest, () => {})
      reject(err)
    })
  })
})

// ─── IPC: App ─────────────────────────────────────────────────────────────────
ipcMain.handle('app:getVersion', () => app.getVersion())

// ─── IPC: Dialog + FS ─────────────────────────────────────────────────────────
ipcMain.handle('dialog:showSaveDialog', (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return dialog.showSaveDialog(win, options)
})

ipcMain.handle('fs:writeFile', (_e, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf8')
})

app.whenReady().then(() => {
  protocol.registerFileProtocol('filmvault', (request, callback) => {
    const filePath = request.url.replace('filmvault://posters/', '')
    const fullPath = path.join(app.getPath('userData'), 'posters', filePath)
    callback({ path: fullPath })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
