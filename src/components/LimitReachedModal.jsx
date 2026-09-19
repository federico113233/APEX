export default function LimitReachedModal({ isOpen, onClose }) {
  if (!isOpen) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-apex-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-[17px] font-semibold text-apex-text mb-2">Free plan limit reached</h2>
        <p className="text-sm text-apex-muted mb-6 leading-relaxed">
          You've used all your free credits for this feature this month.
          Upgrade to Pro to keep going.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-apex-text hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-apex-blue text-white text-sm font-medium opacity-50 cursor-not-allowed"
            disabled
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  )
}
