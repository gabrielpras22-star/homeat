import 'server-only'
import Stripe from 'stripe'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

/** Erreur à renvoyer telle quelle au navigateur. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let stripeClient: Stripe | null = null
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new HttpError(503, 'Le paiement en ligne n’est pas encore configuré (clé Stripe manquante).')
  stripeClient ??= new Stripe(key)
  return stripeClient
}

let adminClient: SupabaseClient | null = null
/** Client Supabase avec la clé de service : contourne les règles RLS, à n'utiliser que côté serveur. */
export function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new HttpError(503, 'Le serveur n’est pas encore configuré (clé de service Supabase manquante).')
  adminClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return adminClient
}

/** Utilisateur connecté, d'après le jeton envoyé dans l'en-tête Authorization. */
export async function requireUser(request: Request): Promise<User> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Connectez-vous pour continuer.')
  const { data, error } = await admin().auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Session expirée : reconnectez-vous.')
  return data.user
}

/** Origine publique du site (pour les adresses de retour Stripe). */
export function siteOrigin(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin
}

/** Exécute un gestionnaire de route et convertit les erreurs en réponses JSON lisibles. */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn())
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status })
    if (e instanceof Stripe.errors.StripeError) {
      console.error('Stripe:', e.type, e.code, e.message)
      return Response.json({ error: 'Le service de paiement a refusé la demande : ' + e.message }, { status: 502 })
    }
    console.error(e)
    return Response.json({ error: 'Une erreur inattendue est survenue. Réessayez dans un instant.' }, { status: 500 })
  }
}

export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}
