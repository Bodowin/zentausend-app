// Schlanke, einheitliche Inline-Icons (kein Icon-Paket nötig → kleines Bundle).
type P = { className?: string }
const base = (className = 'w-5 h-5') => ({
  className,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
})

export const IconTrophy = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)
export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 13l4 4L19 7" />
  </svg>
)
export const IconRefresh = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
export const IconTrash = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)
export const IconUserPlus = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M18 9v6m3-3h-6m-3-4a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
)
export const IconX = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
)
export const IconUsers = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
)
export const IconChart = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
export const IconRotate = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)
export const IconUndo = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 7v6h6M3 13a9 9 0 103-7.7L3 8" />
  </svg>
)
export const IconBack = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M15 19l-7-7 7-7" />
  </svg>
)
export const IconTag = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 7h.01M7 3h5a2 2 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 11V6a3 3 0 013-3z" />
  </svg>
)
export const IconSettings = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)
export const IconLock = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)
