import { useState } from 'react'

function TailoringLab() {
  const [activeTab, setActiveTab] = useState('cv')

  return (
    <div className="p-8">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-apex-text">Tailoring Lab</h1>
        <p className="text-apex-muted mt-1">Customize your CV and cover letters for each application</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('cv')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'cv'
                ? 'text-apex-blue border-b-2 border-apex-blue'
                : 'text-apex-muted hover:text-apex-text'
            }`}
          >
            CV / Resume
          </button>
          <button
            onClick={() => setActiveTab('cover')}
            className={`px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'cover'
                ? 'text-apex-blue border-b-2 border-apex-blue'
                : 'text-apex-muted hover:text-apex-text'
            }`}
          >
            Cover Letter
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-apex-text mb-2">
              Target job description
            </label>
            <textarea
              placeholder="Paste the job description here to tailor your application..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent resize-none"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-apex-text mb-2">
              {activeTab === 'cv' ? 'Your CV content' : 'Cover letter content'}
            </label>
            <textarea
              placeholder={activeTab === 'cv' 
                ? 'Your CV or resume content...' 
                : 'Write or paste your cover letter...'}
              rows={10}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-apex-blue focus:border-transparent font-mono text-sm resize-none"
            />
          </div>

          <button className="px-6 py-2.5 rounded-lg font-medium text-white bg-gradient-to-r from-apex-blue to-apex-cyan hover:opacity-95 transition-opacity">
            Generate tailored version
          </button>
        </div>
      </div>
    </div>
  )
}

export default TailoringLab
