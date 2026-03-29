const STATUS_CONFIG = {
  wanted:    { label: 'Wanted',      bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/40'    },
  upgrade:   { label: 'Upgrade',     bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/40' },
  '4k_bluray': { label: '4K Blu-ray', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/40' },
  bluray:    { label: 'Blu-ray',     bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/40'   },
  dvd:       { label: 'DVD',         bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/40'   },
  digital:   { label: 'Digital',     bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/40' },
}

const SIZE_CLASSES = {
  sm: 'text-[10px] px-1.5 py-0.5 font-semibold tracking-wide',
  md: 'text-xs    px-2   py-0.5 font-semibold tracking-wide',
  lg: 'text-sm    px-3   py-1   font-semibold',
}

export default function StatusBadge({ status, size = 'md' }) {
  const config = STATUS_CONFIG[status]
  if (!config) return null

  return (
    <span
      className={`
        inline-flex items-center rounded-full border
        ${config.bg} ${config.text} ${config.border}
        ${SIZE_CLASSES[size]}
        whitespace-nowrap
      `}
    >
      {config.label}
    </span>
  )
}
