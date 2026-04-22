import { useEffect, useRef, useState } from 'react'

function Avatar({ src, name, size = 56 }) {
  const [errored, setErrored] = useState(false)
  const initials = name?.split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?'
  const style = { width: size, height: size }

  if (!src || errored) {
    return (
      <div
        style={style}
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-800 text-xs font-semibold text-gray-400"
      >
        {initials}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setErrored(true)}
      style={style}
      className="flex-shrink-0 rounded-full bg-gray-800 object-cover"
    />
  )
}

function CastRow({ person, onClick }) {
  return (
    <button
      onClick={() => onClick({ id: person.id, name: person.name })}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-800/60"
    >
      <Avatar src={person.profile} name={person.name} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-200">
          {person.name}
        </p>
        {person.character && (
          <p className="truncate text-xs text-gray-500">
            {person.character}
          </p>
        )}
      </div>
    </button>
  )
}

export default function FullCastModal({ cast, movieTitle, onClose, onPersonClick }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-black/80">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800/60 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Full Cast
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white">
              {movieTitle}
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({cast.length} {cast.length === 1 ? 'member' : 'members'})
              </span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-900/60 p-2 text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable list — two columns on desktop */}
        <div className="flex-1 overflow-y-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-5">
          <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-3">
            {cast.map((c) => (
              <CastRow key={c.id} person={c} onClick={onPersonClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
