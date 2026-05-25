import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  isAdmin: boolean
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isAdmin: false,
      login: (token) => {
        localStorage.setItem('auth_token', token)
        set({ token, isAdmin: true })
      },
      logout: () => {
        localStorage.removeItem('auth_token')
        set({ token: null, isAdmin: false })
      },
    }),
    { name: 'auth-store' }
  )
)
