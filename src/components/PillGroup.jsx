/**
 * PillGroup — single or multi-select pill buttons.
 *
 * Props:
 *   options: string[]
 *   value:   string (single) | string[] (multi)
 *   onChange: (newValue) => void
 *   multi?:  boolean
 */
export default function PillGroup({ options, value, onChange, multi = false }) {
  const toggle = (opt) => {
    if (!multi) return onChange(value === opt ? '' : opt)
    const cur = Array.isArray(value) ? value : []
    onChange(cur.includes(opt) ? cur.filter((v) => v !== opt) : [...cur, opt])
  }
  const isActive = (opt) =>
    multi ? Array.isArray(value) && value.includes(opt) : value === opt

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            isActive(opt)
              ? 'bg-apex-blue text-white border-apex-blue'
              : 'bg-white text-apex-muted border-slate-200 hover:border-apex-blue/50 hover:text-apex-text'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
