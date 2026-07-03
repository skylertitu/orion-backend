import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl: string | undefined = process.env.SUPABASE_URL
const supabaseAnonKey: string | undefined = process.env.SUPABASE_ANON_KEY

let supabase: SupabaseClient | null = null
let isConfigured: boolean = false

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey)
    isConfigured = true
  } catch (err) {
    console.error('Error al inicializar Supabase client:', err)
  }
}

export { supabase, isConfigured, supabaseUrl, supabaseAnonKey }
export default supabase
