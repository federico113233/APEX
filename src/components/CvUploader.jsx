import { useState, useRef, useCallback } from 'react'

async function extractFromPdf(arrayBuffer) {
  const [pdfjsLib, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => item.str).join(' '))
  }
  return pages.join('\n\n').replace(/\s{3,}/g, '\n').trim()
}

async function extractFromDocx(arrayBuffer) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

async function parseFile(file) {
  const arrayBuffer = await file.arrayBuffer()
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return extractFromPdf(arrayBuffer)
  }
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.endsWith('.docx')
  ) {
    return extractFromDocx(arrayBuffer)
  }
  throw new Error('Unsupported file type. Please upload a PDF or .docx file.')
}

/**
 * CvUploader — dual-mode CV input (upload or paste).
 *
 * Props:
 *   value: string          — current CV text
 *   onChange: (string) => void — called on every text change
 *   compact?: boolean      — smaller layout for onboarding
 */
export default function CvUploader({ value, onChange, compact = false }) {
  const [mode, setMode] = useState('upload')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const processFile = useCallback(
    async (file) => {
      setError(null)
      setLoading(true)
      setFileName(file.name)
      try {
        const text = await parseFile(file)
        onChange(text)
        setMode('preview')
      } catch (err) {
        setError(err.message)
        setFileName(null)
      } finally {
        setLoading(false)
      }
    },
    [onChange]
  )

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const textareaRows = compact ? 10 : 14

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {[
          { key: 'upload', label: 'Upload file' },
          { key: 'paste', label: 'Paste text' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === key || (mode === 'preview' && key === 'upload')
                ? 'bg-white text-apex-text shadow-sm'
                : 'text-apex-muted hover:text-apex-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Upload mode */}
      {(mode === 'upload' || mode === 'preview') && (
        <div className="space-y-3">
          {/* Drop zone — hidden once file loaded */}
          {mode === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                compact ? 'py-8' : 'py-12'
              } ${
                dragOver
                  ? 'border-apex-blue bg-blue-50'
                  : 'border-slate-200 hover:border-apex-blue/50 hover:bg-slate-50/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <>
                  <svg className="w-7 h-7 text-apex-blue animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-apex-muted">Extracting text…</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-apex-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-apex-text">
                      Drop your CV here, or{' '}
                      <span className="text-apex-blue underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-xs text-apex-muted mt-1">PDF or Word (.docx) · max 10 MB</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Extracted preview */}
          {mode === 'preview' && value && (
            <div className="space-y-2">
              {/* File badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-medium text-emerald-700 max-w-[180px] truncate">{fileName}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setMode('upload'); onChange(''); setFileName(null) }}
                  className="text-xs text-apex-muted hover:text-apex-text underline underline-offset-2"
                >
                  Replace
                </button>
              </div>
              {/* Editable extracted text */}
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={textareaRows}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-apex-text focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none font-mono text-sm leading-relaxed"
              />
              <p className="text-xs text-apex-muted">
                Text extracted from your file — edit freely before saving.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Paste mode */}
      {mode === 'paste' && (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste the full text of your CV here…&#10;&#10;Include education, work experience, skills, and any projects or extracurriculars."
            rows={textareaRows}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 text-apex-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none font-mono text-sm leading-relaxed"
          />
          {value && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {value.length.toLocaleString()} characters ready
            </p>
          )}
        </div>
      )}
    </div>
  )
}
