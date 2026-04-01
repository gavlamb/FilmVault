import { useState, useEffect } from 'react'

// Renders a live countdown to an auction end_time.
// Returns null for non-auction listings (no endTime).
export default function AuctionCountdown({ endTime }) {
  const [msLeft, setMsLeft] = useState(() =>
    endTime ? new Date(endTime).getTime() - Date.now() : null
  )

  useEffect(() => {
    if (!endTime) return
    const tick = () => setMsLeft(new Date(endTime).getTime() - Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTime])

  if (!endTime || msLeft == null || msLeft <= 0) return null

  const totalSec = Math.floor(msLeft / 1000)
  const days  = Math.floor(totalSec / 86400)
  const hrs   = Math.floor((totalSec % 86400) / 3600)
  const mins  = Math.floor((totalSec % 3600) / 60)
  const secs  = totalSec % 60

  let text
  if (days > 0)       text = `${days}d ${hrs}h ${mins}m`
  else if (hrs > 0)   text = `${hrs}h ${mins}m ${secs}s`
  else                text = `${mins}m ${secs}s`

  // Colour-code by urgency
  const urgent   = msLeft < 15 * 60 * 1000  // < 15 min
  const warning  = msLeft < 60 * 60 * 1000  // < 1 hr
  const colour   = urgent  ? 'text-red-400'
                 : warning ? 'text-orange-400'
                 :           'text-amber-400'

  return (
    <span className={`text-xs font-mono font-medium ${colour} ${urgent ? 'animate-pulse' : ''}`}>
      {text} remaining
    </span>
  )
}
