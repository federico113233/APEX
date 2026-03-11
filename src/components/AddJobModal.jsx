import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function AddJobModal({ onClose, onAdded }) {
  const { addManualJob } = useUser()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [title, setTitle]           = useState('')
  const [company, setCompany]       = useState('')
  const [location, setLocation]     = useState('')
  const [jobUrl, setJobUrl]         = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading]       = useState(false)
  const [errors, setErrors]         = useState({})

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  const validate = () => {
    const e = {}
    if (!title.trim()) e.title = 'Job title is required'
    if (!company.trim()) e.company = 'Company is required'
    return e
  }

  const save = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return null }
    setLoading(true)
    const result = await addManualJob({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      description: description.trim(),
      jobUrl: jobUrl.trim(),
    })
    setLoading(false)
    if (result?.error) {
      setErrors({ submit: 'Failed to save. Check your connection and try again.' })
      return null
    }
    return result
  }

  const handleSaveToTracker = async () => {
    const result = await save()
    if (!result) return
    onAdded?.()
    handleClose()
  }

  const handleTailorWithAI = async () => {
    const result = await save()
    if (!result) return
    handleClose()
    navigate('/dashboard/tailoring-lab', {
      state: {
        job: {
          id: result.jobId,
          title: title.trim(),
          company: company.trim(),
          location: location.trim(),
          description: description.trim(),
          url: jobUrl.trim(),
        },
      },
    })
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: '1.5px solid #e2e8f0',
    fontSize: 14,
    color: '#1e293b',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: '#fff',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  }

  const focusStyle = (e) => {
    e.target.style.borderColor = '#93c5fd'
    e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'
  }
  const blurStyle = (e) => {
    e.target.style.borderColor = '#e2e8f0'
    e.target.style.boxShadow = 'none'
  }

  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: visible ? 'rgba(15,23,42,0.36)' : 'transparent',
          transition: 'background 0.22s',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: visible ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1), opacity 0.18s',
          zIndex: 101,
          width: '100%',
          maxWidth: 560,
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06)',
          padding: '28px 28px 24px',
          boxSizing: 'border-box',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="20" height="20" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Add a job manually</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>Found a job outside APEX? Track it here.</p>
          </div>
          <button
            onClick={handleClose}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Job Title <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Frontend Developer"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErrors((prev) => ({ ...prev, title: '' })) }}
            style={{ ...inputStyle, borderColor: errors.title ? '#fca5a5' : '#e2e8f0' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          {errors.title && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#ef4444' }}>{errors.title}</p>}
        </div>

        {/* Company */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Company <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Acme Corp"
            value={company}
            onChange={(e) => { setCompany(e.target.value); setErrors((prev) => ({ ...prev, company: '' })) }}
            style={{ ...inputStyle, borderColor: errors.company ? '#fca5a5' : '#e2e8f0' }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
          {errors.company && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#ef4444' }}>{errors.company}</p>}
        </div>

        {/* Location + URL row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>
              Location <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Milan, Italy"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Job URL <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional)</span>
            </label>
            <input
              type="url"
              placeholder="https://…"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              style={inputStyle}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>
            Job Description <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#94a3b8' }}>(optional — helps Alex tailor your application)</span>
          </label>
          <textarea
            placeholder="Paste the job description here…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        </div>

        {/* Submit error */}
        {errors.submit && (
          <p style={{ margin: '-12px 0 16px', fontSize: 13, color: '#ef4444', textAlign: 'center' }}>
            {errors.submit}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSaveToTracker}
            disabled={loading}
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 20px',
              borderRadius: 12, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 14, fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.15s, opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#fff' }}
          >
            {loading ? (
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #cbd5e1', borderTopColor: '#64748b', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Save to Tracker
          </button>
          <button
            onClick={handleTailorWithAI}
            disabled={loading}
            style={{
              flex: 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 20px',
              borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #2563EB, #38BDF8)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = '1' }}
          >
            <svg width="15" height="15" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Tailor with AI →
          </button>
        </div>
      </div>
    </>
  )
}
