import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { ApiUser } from "@/types/api"
import { AUTH_STORAGE_KEY } from "@/lib/auth-storage"

interface AuthState {
  token: string | null
  user: ApiUser | null
  isAuthenticated: boolean
  isHydrated: boolean
  setSession: (token: string, user: ApiUser) => void
  updateUser: (user: ApiUser) => void
  clearSession: () => void
  login: (user: ApiUser) => void
  setHydrated: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isHydrated: false,
      setSession: (token, user) => set({ token, user, isAuthenticated: true }),
      updateUser: (user) =>
        set((state) => ({
          ...state,
          user: state.user ? { ...state.user, ...user } : user,
        })),
      clearSession: () => set({ token: null, user: null, isAuthenticated: false }),
      login: (user) => set((state) => ({ ...state, user, isAuthenticated: true })),
      setHydrated: (value) => set({ isHydrated: value }),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
    }
  )
)
