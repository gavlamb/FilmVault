const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs   = require('fs')
const db   = require('./database')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  })

  if (isDev) {
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
ipcMain.handle('db:addMovie',           (_e, movie)     => db.addMovie(movie))
ipcMain.handle('db:updateMovie',        (_e, id, movie) => db.updateMovie(id, movie))
ipcMain.handle('db:deleteMovie',        (_e, tmdbId)    => db.deleteMovie(tmdbId))
ipcMain.handle('db:searchMovies',       (_e, query)     => db.searchMovies(query))
ipcMain.handle('db:getMoviesByStatus',   (_e, status)           => db.getMoviesByStatus(status))
ipcMain.handle('db:updateMovieTmdbData', (_e, oldId, newId, poster) => db.updateMovieTmdbData(oldId, newId, poster))

// ─── IPC: Collections ─────────────────────────────────────────────────────────
ipcMain.handle('db:getAllCollections',  ()               => db.getAllCollections())
ipcMain.handle('db:addCollection',     (_e, collection) => db.addCollection(collection))
ipcMain.handle('db:updateCollection',  (_e, id, col)    => db.updateCollection(id, col))

// ─── IPC: Settings ────────────────────────────────────────────────────────────
ipcMain.handle('db:getSetting',     (_e, key)        => db.getSetting(key))
ipcMain.handle('db:setSetting',     (_e, key, value) => db.setSetting(key, value))
ipcMain.handle('db:getAllSettings', ()               => db.getAllSettings())

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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
