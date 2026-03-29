const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Movies
  getAllMovies:      ()              => ipcRenderer.invoke('db:getAllMovies'),
  getMovieById:     (tmdbId)        => ipcRenderer.invoke('db:getMovieById', tmdbId),
  addMovie:         (movie)         => ipcRenderer.invoke('db:addMovie', movie),
  updateMovie:      (tmdbId, movie) => ipcRenderer.invoke('db:updateMovie', tmdbId, movie),
  deleteMovie:      (tmdbId)        => ipcRenderer.invoke('db:deleteMovie', tmdbId),
  searchMovies:     (query)         => ipcRenderer.invoke('db:searchMovies', query),
  getMoviesByStatus:(status)        => ipcRenderer.invoke('db:getMoviesByStatus', status),

  // Collections
  getAllCollections:  ()                   => ipcRenderer.invoke('db:getAllCollections'),
  addCollection:     (collection)         => ipcRenderer.invoke('db:addCollection', collection),
  updateCollection:  (id, collection)     => ipcRenderer.invoke('db:updateCollection', id, collection),

  // Settings
  getSetting:    (key)        => ipcRenderer.invoke('db:getSetting', key),
  setSetting:    (key, value) => ipcRenderer.invoke('db:setSetting', key, value),
  getAllSettings: ()           => ipcRenderer.invoke('db:getAllSettings'),

  // App
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
