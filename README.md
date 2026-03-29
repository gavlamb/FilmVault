# FilmVault

A personal movie collection manager built with Electron, React, Vite, and SQLite.

## Stack

- **Electron** — desktop shell
- **React + Vite** — UI
- **Tailwind CSS** — styling
- **better-sqlite3** — local database
- **electron-builder** — Windows packaging

## Getting Started

```bash
npm install
npm run dev
```

## Building

```bash
npm run build
```

Output installer is placed in `dist-electron/`.

## Database

The SQLite database is stored in the Electron `userData` directory:

- Windows: `%APPDATA%\FilmVault\filmvault.db`
