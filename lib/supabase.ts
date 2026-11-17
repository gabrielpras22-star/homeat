import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Indique si les variables d'environnement Supabase sont bien définies.
export const supabaseConfigured = Boolean(url && anonKey)

// Valeurs de repli : évitent que le build (prérendu) plante quand les
// variables ne sont pas définies. Aucune requête n'est faite pendant le build.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key'
)
