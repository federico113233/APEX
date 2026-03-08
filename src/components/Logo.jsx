function Logo({ className = '', size = 'md' }) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }
  
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <svg 
        className={`${sizes[size]} flex-shrink-0`}
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="apexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="18" height="18" rx="4" fill="url(#apexGradient)" opacity="0.9" />
        <rect x="26" y="26" width="18" height="18" rx="4" fill="url(#apexGradient)" />
        <path d="M26 4L46 4L46 22" stroke="url(#apexGradient)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M4 26L4 46L22 46" stroke="url(#apexGradient)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>
      <span className="font-semibold text-xl tracking-tight text-apex-text">APEX</span>
    </div>
  )
}

export default Logo
