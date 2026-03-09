import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const UserContext = createContext(null)

const DEFAULT_USER = {
  name: '',
  sector: '',
  sectors: [],
  country: '',
  city: '',
  contractType: '',
  workMode: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: '€',
  languages: [],
  linkedinUrl: '',
  cvText: '',
  onboarded: false,
}

// Supabase row → local user object
function rowToUser(row) {
  return {
    name:           row.name            || '',
    sector:         row.sector          || '',
    sectors:        row.sectors         || [],
    country:        row.country         || '',
    city:           row.city            || '',
    contractType:   row.contract_type   || '',
    workMode:       row.work_mode       || '',
    salaryMin:      row.salary_min      || '',
    salaryMax:      row.salary_max      || '',
    salaryCurrency: row.salary_currency || '€',
    languages:      row.languages       || [],
    linkedinUrl:    row.linkedin_url    || '',
    cvText:         row.cv_text         || '',
    onboarded:      row.onboarded       || false,
  }
}

// Local user object → Supabase row
function userToRow(userId, data) {
  return {
    id:              userId,
    name:            data.name            ?? '',
    sector:          data.sector          ?? (data.sectors?.[0] || ''),
    sectors:         data.sectors         ?? [],
    country:         data.country         ?? '',
    city:            data.city            ?? '',
    contract_type:   data.contractType    ?? '',
    work_mode:       data.workMode        ?? '',
    salary_min:      data.salaryMin       ?? '',
    salary_max:      data.salaryMax       ?? '',
    salary_currency: data.salaryCurrency  ?? '€',
    languages:       data.languages       ?? [],
    linkedin_url:    data.linkedinUrl     ?? '',
    cv_text:         data.cvText          ?? '',
    onboarded:       data.onboarded       ?? false,
    updated_at:      new Date().toISOString(),
  }
}

// Supabase applications row → local app object
function rowToApp(row) {
  return {
    id:           row.id,
    jobId:        row.job_id      || '',
    title:        row.job_title   || '',
    company:      row.company     || '',
    location:     row.location    || '',
    status:       row.status      || 'Applied',
    tailoredCv:   row.tailored_cv || '',
    coverLetter:  row.cover_letter || '',
    notes:        row.notes       || '',
    appliedDate:  new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

// localStorage key for onboarded cache
const onboardedKey = (uid) => `apex_onboarded_${uid}`

export function UserProvider({ children }) {
  const [session, setSession]               = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [user, setUser]                     = useState(DEFAULT_USER)
  const [profileLoaded, setProfileLoaded]   = useState(false)
  const [applications, setApplications]     = useState([])

  // ── Pre-seed onboarded from localStorage (instant, no network) ───────────
  const seedOnboardedFromCache = (userId) => {
    if (localStorage.getItem(onboardedKey(userId)) === '1') {
      setUser((u) => ({ ...u, onboarded: true }))
    }
  }

  // ── Load profile from Supabase ────────────────────────────────────────────
  const loadProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Supabase] loadProfile error:', error)
    } else if (data) {
      const profile = rowToUser(data)
      if (!profile.onboarded && localStorage.getItem(onboardedKey(userId)) === '1') {
        profile.onboarded = true
      }
      setUser(profile)
    }
    setProfileLoaded(true)
  }

  // ── Load applications from Supabase ───────────────────────────────────────
  const loadApplications = async (userId) => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Supabase] loadApplications error:', error)
      return
    }
    if (data) setApplications(data.map(rowToApp))
  }

  // ── Auth state listener ───────────────────────────────────────────────────
  useEffect(() => {
    let resolved = false

    const resolve = () => {
      if (!resolved) {
        resolved = true
        setSessionLoading(false)
      }
    }

    // Safety timeout — 8 s
    const safetyTimer = setTimeout(() => {
      console.warn('[Auth] Safety timeout (8 s) fired — forcing sessionLoading → false')
      setProfileLoaded(true)
      resolve()
    }, 8000)

    // 1. Check for an existing session on page load — resolve UI immediately,
    //    then load profile + applications in background.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[Auth] getSession →', session ? `user ${session.user.id}` : 'no session',
        error ? `| error: ${error.message}` : '')

      setSession(session)

      if (session) {
        seedOnboardedFromCache(session.user.id)
        Promise.all([
          loadProfile(session.user.id),
          loadApplications(session.user.id),
        ]).catch((err) => console.error('[Auth] background load error:', err))
      } else {
        setProfileLoaded(true)
      }

      clearTimeout(safetyTimer)
      resolve()
    }).catch((err) => {
      console.error('[Auth] getSession threw:', err)
      clearTimeout(safetyTimer)
      setProfileLoaded(true)
      resolve()
    })

    // 2. Keep session in sync on SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] onAuthStateChange →', event,
          session ? `user ${session.user.id}` : 'no session')

        setSession(session)

        if (session) {
          seedOnboardedFromCache(session.user.id)

          if (event === 'SIGNED_IN') {
            setProfileLoaded(false)
            Promise.all([
              loadProfile(session.user.id),
              loadApplications(session.user.id),
            ])
              .catch((err) => console.error('[Auth] SIGNED_IN load error:', err))
              .finally(() => { clearTimeout(safetyTimer); resolve() })
          } else {
            clearTimeout(safetyTimer)
            resolve()
          }
        } else {
          setUser(DEFAULT_USER)
          setProfileLoaded(false)
          setApplications([])
          clearTimeout(safetyTimer)
          resolve()
        }
      }
    )

    return () => {
      clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── updateProfile ─────────────────────────────────────────────────────────
  const updateProfile = async (data) => {
    const merged = { ...user, ...data }
    setUser(merged)

    const userId = session?.user?.id
    if (!userId) return

    if (data.onboarded) localStorage.setItem(onboardedKey(userId), '1')

    const { error } = await supabase
      .from('profiles')
      .upsert(userToRow(userId, merged))

    if (error) console.error('[Supabase] updateProfile error:', error)
  }

  // ── addApplication ────────────────────────────────────────────────────────
  const addApplication = async (job, tailoredCv = '', coverLetter = '') => {
    // Deduplicate
    const jobIdStr = String(job.id)
    if (applications.find((a) => a.jobId === jobIdStr)) return

    const userId = session?.user?.id
    const appliedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (userId) {
      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id:      userId,
          job_id:       jobIdStr,
          job_title:    job.title    || '',
          company:      job.company  || '',
          location:     job.location || '',
          tailored_cv:  tailoredCv,
          cover_letter: coverLetter,
          status:       'Applied',
          notes:        '',
        })
        .select()
        .single()

      if (error) {
        console.error('[Supabase] addApplication error:', error)
        // Fallback to in-memory
        setApplications((prev) => [{
          id: jobIdStr, jobId: jobIdStr,
          title: job.title || '', company: job.company || '',
          location: job.location || '', status: 'Applied',
          tailoredCv, coverLetter, notes: '', appliedDate,
        }, ...prev])
      } else {
        setApplications((prev) => [rowToApp(data), ...prev])
      }
    } else {
      setApplications((prev) => [{
        id: jobIdStr, jobId: jobIdStr,
        title: job.title || '', company: job.company || '',
        location: job.location || '', status: 'Applied',
        tailoredCv, coverLetter, notes: '', appliedDate,
      }, ...prev])
    }
  }

  // ── updateStatus ──────────────────────────────────────────────────────────
  const updateStatus = async (appId, status) => {
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status } : a))
    const { error } = await supabase
      .from('applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appId)
    if (error) console.error('[Supabase] updateStatus error:', error)
  }

  // ── updateApplicationNotes ────────────────────────────────────────────────
  const updateApplicationNotes = async (appId, notes) => {
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, notes } : a))
    const { error } = await supabase
      .from('applications')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', appId)
    if (error) console.error('[Supabase] updateApplicationNotes error:', error)
  }

  // ── deleteApplication ─────────────────────────────────────────────────────
  const deleteApplication = async (appId) => {
    setApplications((prev) => prev.filter((a) => a.id !== appId))
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', appId)
    if (error) console.error('[Supabase] deleteApplication error:', error)
  }

  // supabase.auth.signOut() handles clearing the auth token from localStorage
  const signOut = () => supabase.auth.signOut()

  return (
    <UserContext.Provider value={{
      session,
      sessionLoading,
      user,
      profileLoaded,
      updateProfile,
      applications,
      addApplication,
      updateStatus,
      updateApplicationNotes,
      deleteApplication,
      signOut,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
