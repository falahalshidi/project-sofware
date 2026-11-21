import { createClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>
const supabaseUrl = env.VITE_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY

let rememberSession = true

const browserStorage = {
  getItem(key: string) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    if (rememberSession) {
      window.localStorage.setItem(key, value)
      window.sessionStorage.removeItem(key)
    } else {
      window.sessionStorage.setItem(key, value)
      window.localStorage.removeItem(key)
    }
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export function setRememberSession(value: boolean) {
  rememberSession = value
}

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: browserStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null

export type PlaceRow = {
  place_id: string
  name: string
  country: string | null
  admin1: string | null
  latitude: number
  longitude: number
  timezone: string | null
}
