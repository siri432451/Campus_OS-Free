import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../api/client'

interface User {
  id: string
  name: string
  role: string
  email?: string | null
  matricNo?: string
  staffId?: string
  level?: string
  department?: string
  photoUrl?: string
  qrCode?: string
  printCredit?: { balance: number; accountNo: string; bankName: string }
  emailVerified?: boolean
  biodataCompleted?: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('campusos_token')
    const storedUser = localStorage.getItem('campusos_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setLoading(false)
  }, [])

  const login = async (identifier: string, password: string) => {
    const res = await api.post('/api/auth/login', { identifier, password })
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('campusos_token', newToken)
    localStorage.setItem('campusos_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('campusos_token')
    localStorage.removeItem('campusos_user')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/api/auth/me')
      setUser(res.data)
      localStorage.setItem('campusos_user', JSON.stringify(res.data))
    } catch {
      logout()
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
