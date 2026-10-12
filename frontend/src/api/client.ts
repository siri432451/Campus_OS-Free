/// <reference types="vite/client" />
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' }
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('campusos_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Public pages (e.g. transcript requests) must never bounce the visitor to the login page
    const url: string = err.config?.url || ''
    if (err.response?.status === 401 && !url.includes('/api/public/')) {
      localStorage.removeItem('campusos_token')
      localStorage.removeItem('campusos_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
