import { createContext, useContext, useState } from 'react'

const UserContext = createContext(null)

const SEED_APPLICATIONS = [
  {
    id: 1,
    title: 'Software Engineering Intern',
    company: 'Google',
    location: 'London, UK',
    type: 'Internship',
    status: 'Interview',
    appliedDate: 'Mar 3',
  },
  {
    id: 4,
    title: 'Strategy & Operations Analyst',
    company: 'McKinsey & Company',
    location: 'Milan, Italy',
    type: 'Full-time',
    status: 'Applied',
    appliedDate: 'Mar 5',
  },
]

export function UserProvider({ children }) {
  const [user, setUser] = useState({
    name: '',
    sector: '',
    country: '',
    city: '',
    cvText: '',
    onboarded: false,
    // extended profile fields
    contractType: '',          // 'Full-time' | 'Part-time' | 'Internship' | 'Freelance'
    workMode: '',              // 'Remote' | 'Hybrid' | 'Onsite'
    salaryMin: '',
    salaryMax: '',
    salaryCurrency: '€',
    sectors: [],               // string[]
    languages: [],             // { lang: string, level: string }[]
    linkedinUrl: '',
  })
  const [applications, setApplications] = useState(SEED_APPLICATIONS)

  const updateProfile = (data) => setUser((prev) => ({ ...prev, ...data }))

  const addApplication = (job) => {
    setApplications((prev) => {
      if (prev.find((a) => a.id === job.id)) return prev
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return [{ ...job, status: 'Applied', appliedDate: today }, ...prev]
    })
  }

  const updateStatus = (jobId, status) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === jobId ? { ...a, status } : a))
    )
  }

  return (
    <UserContext.Provider value={{ user, updateProfile, applications, addApplication, updateStatus }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
