/**
 * Logo component.
 * - Default: renders apex_full_logo.png (icon + wordmark) at h-8 (32px)
 * - iconOnly: renders apex_x_blue.png (symbol only) — for collapsed sidebar / mobile
 * - size="sm" → h-6 | size="md" / "lg" → h-8
 */
function Logo({ className = '', size = 'md', iconOnly = false }) {
  const height = size === 'sm' ? 'h-6' : 'h-8'

  if (iconOnly) {
    return (
      <img
        src="/apex_x_blue.png"
        alt="APEX"
        className={`${height} w-auto object-contain ${className}`}
      />
    )
  }

  return (
    <img
      src="/apex_full_logo.png"
      alt="APEX"
      className={`${height} w-auto object-contain ${className}`}
    />
  )
}

export default Logo
