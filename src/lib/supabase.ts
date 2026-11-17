import { createClient } from '@supabase/supabase-js'

const env = import.meta.env as Record<string, string | undefined>
const supabaseUrl = env.VITE_SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export type PlaceRow = {
  place_id: string
  name: string
  country: string | null
  admin1: string | null
  latitude: number
  longitude: number
  timezone: string | null
}
