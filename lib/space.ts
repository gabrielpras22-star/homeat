'use client'
// Données réelles des espaces hôte et invité (Supabase). Aucune donnée inventée.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, supabaseConfigured } from './supabase'
import { parisDateTime, todayParis } from './shared'

// ─────────────── Outils ───────────────

/** Appel d'une route serveur avec le jeton de session. */
export async function api<T>(path: string, body: unknown = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Le serveur ne répond pas. Réessayez dans un instant.')
  return json as T
}

/** Réduit une photo (max 1600 px, JPEG) avant envoi. */
export async function resizeImage(file: File, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.82))
}

const unsplash = (id: string, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`
const CUISINE_PHOTOS: Record<string, string> = {
  Marocaine: '1541518763669-27fef04b14ea', Italienne: '1473093295043-cdd812d0e601', Japonaise: '1569718212165-3a8278d5f624',
  Mexicaine: '1565299585323-38d6b0865b47', Indienne: '1585937421612-70a008356fbe', Française: '1467003909585-2f8a72700288',
  Libanaise: '1511690656952-34342bb7c2f2', Espagnole: '1534080564583-6be75777b70a', Autre: '1414235077428-338989a2e8c0',
}
/** Photo du repas, ou illustration selon la cuisine si l'hôte n'en a pas mis. */
export const mealPhoto = (url: string | null | undefined, cuisine: string) =>
  url && /^https:\/\/\S+$/i.test(url.trim()) ? url.trim() : unsplash(CUISINE_PHOTOS[cuisine] || CUISINE_PHOTOS.Autre)

export const isPast = (date: string, time: string) => parisDateTime(date, time).getTime() < Date.now()

// ─────────────── Session ───────────────

export type Me = {
  id: string
  email: string
  name: string
  avatar: string | null
  city: string
  bio: string
  languages: string[]
  rating: number | null
  reviewsCount: number
}

/**
 * Utilisateur connecté. Sans session, renvoie vers la connexion puis revient ici.
 * Sans Supabase configuré (développement), state = 'unconfigured'.
 */
export function useMe(returnTo: string) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'in' | 'unconfigured'>(supabaseConfigured ? 'loading' : 'unconfigured')
  const [me, setMe] = useState<Me | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!supabaseConfigured) return
    let cancelled = false
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      const u = session?.user
      if (!u) { router.replace(`/connexion?suite=${encodeURIComponent(returnTo)}`); return }
      const { data: p } = await supabase.from('profiles').select('full_name, avatar_url, city, bio, languages, rating, reviews_count').eq('id', u.id).maybeSingle()
      if (cancelled) return
      setMe({
        id: u.id,
        email: u.email ?? '',
        name: (p?.full_name as string | null)?.trim() || (u.user_metadata?.full_name as string | undefined)?.trim() || 'Mon compte',
        avatar: (p?.avatar_url as string | null) ?? null,
        city: (p?.city as string | null) ?? '',
        bio: (p?.bio as string | null) ?? '',
        languages: (p?.languages as string[] | null) ?? [],
        rating: (p?.rating as number | null) ?? null,
        reviewsCount: (p?.reviews_count as number | null) ?? 0,
      })
      setState('in')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') router.replace('/connexion')
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [router, returnTo, version])

  return { state, me, reloadMe: () => setVersion(v => v + 1) }
}

export async function logout() {
  await supabase.auth.signOut()
}

/** Met à jour le profil et renvoie l'erreur éventuelle. */
export async function saveProfile(uid: string, patch: Partial<{ full_name: string; city: string; bio: string; languages: string[]; avatar_url: string }>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
  return error?.message ?? null
}

/** Envoie une photo dans le dossier de l'utilisateur et renvoie son adresse publique. */
export async function uploadPhoto(uid: string, file: File, folder = 'galerie'): Promise<GalleryPhoto> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type) && !file.type.startsWith('image/')) throw new Error('Choisissez une image (JPEG, PNG ou WebP).')
  if (file.size > 15 * 1024 * 1024) throw new Error('Image trop lourde (15 Mo maximum).')
  const blob = await resizeImage(file)
  const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw new Error('Envoi impossible : ' + error.message)
  return { path, src: supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl }
}

// ─────────────── Espace hôte ───────────────

export type HostMeal = {
  id: string; title: string; cuisine: string; date: string; time: string
  price: number; seats: number; available: number; booked: number
  status: 'online' | 'past' | 'cancelled'
  photo: string; photoUrl: string | null; tags: string[]; allergens: string[]
  description: string; menu: string[]; city: string
}
export type HostGuest = {
  bookingId: string; mealId: string; guestId: string; name: string; avatar: string | null
  seats: number; hostAmount: number; transferredAt: string | null; reviewed: boolean
}
export type ReceivedReview = { id: string; author: string; rating: number; date: string; text: string; meal: string; reply: string | null }
export type GalleryPhoto = { path: string; src: string }

const MEAL_COLS = 'id, title, cuisine, date, time, price_per_seat, max_seats, available_seats, is_active, photo_url, tags, allergens, description, menu, city'

type MealRow = { id: string; title: string; cuisine: string; date: string; time: string; price_per_seat: number; max_seats: number; available_seats: number; is_active: boolean; photo_url: string | null; tags: string[] | null; allergens: string[] | null; description: string | null; menu: string[] | null; city: string }

function toHostMeal(m: MealRow, booked: number): HostMeal {
  const t = (m.time || '19:30').slice(0, 5)
  return {
    id: m.id, title: m.title, cuisine: m.cuisine, date: m.date, time: t,
    price: Number(m.price_per_seat), seats: m.max_seats, available: m.available_seats, booked,
    status: !m.is_active ? 'cancelled' : isPast(m.date, t) ? 'past' : 'online',
    photo: mealPhoto(m.photo_url, m.cuisine), photoUrl: m.photo_url, tags: m.tags ?? [], allergens: m.allergens ?? [],
    description: m.description ?? '', menu: m.menu ?? [], city: m.city,
  }
}

export async function loadHost(uid: string) {
  const { data: mealRows } = await supabase.from('meals').select(MEAL_COLS).eq('host_id', uid).order('date', { ascending: false })
  const rows = (mealRows ?? []) as MealRow[]
  const ids = rows.map(m => m.id)

  let guests: HostGuest[] = []
  if (ids.length) {
    const { data: b } = await supabase.from('bookings')
      .select('id, meal_id, guest_id, seats, host_amount, transferred_at, profiles!bookings_guest_id_fkey(full_name, avatar_url)')
      .in('meal_id', ids).in('status', ['confirmed', 'completed'])
    const { data: mine } = await supabase.from('reviews').select('booking_id').eq('reviewer_id', uid).eq('type', 'host_to_guest')
    const done = new Set((mine ?? []).map((r: { booking_id: string }) => r.booking_id))
    guests = ((b ?? []) as unknown as { id: string; meal_id: string; guest_id: string; seats: number; host_amount: number | null; transferred_at: string | null; profiles: { full_name: string | null; avatar_url: string | null } | null }[])
      .map(x => ({
        bookingId: x.id, mealId: x.meal_id, guestId: x.guest_id, name: x.profiles?.full_name?.trim() || 'Invité',
        avatar: x.profiles?.avatar_url ?? null, seats: x.seats, hostAmount: Number(x.host_amount ?? 0),
        transferredAt: x.transferred_at, reviewed: done.has(x.id),
      }))
  }
  const bookedBy = new Map<string, number>()
  guests.forEach(g => bookedBy.set(g.mealId, (bookedBy.get(g.mealId) ?? 0) + g.seats))
  const meals = rows.map(m => toHostMeal(m, bookedBy.get(m.id) ?? 0))

  const { data: rv } = await supabase.from('reviews')
    .select('id, rating, comment, created_at, reply, meal_id, profiles!reviews_reviewer_id_fkey(full_name)')
    .eq('reviewed_id', uid).eq('type', 'guest_to_host').order('created_at', { ascending: false })
  const titles = new Map(rows.map(m => [m.id, m.title]))
  const reviews: ReceivedReview[] = ((rv ?? []) as unknown as { id: string; rating: number; comment: string | null; created_at: string; reply: string | null; meal_id: string; profiles: { full_name: string | null } | null }[])
    .map(r => ({ id: r.id, author: r.profiles?.full_name?.trim() || 'Invité', rating: r.rating, date: r.created_at.slice(0, 10), text: r.comment ?? '', meal: titles.get(r.meal_id) ?? '', reply: r.reply }))

  const { data: payout } = await supabase.from('host_payouts').select('transfers_active').eq('host_id', uid).maybeSingle()

  return { meals, guests, reviews, payoutsActive: Boolean(payout?.transfers_active), payoutsConfigured: Boolean(payout) }
}

export async function loadGallery(uid: string): Promise<GalleryPhoto[]> {
  const { data } = await supabase.storage.from('meal-photos').list(`${uid}/galerie`, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  return (data ?? []).filter(f => f.name.endsWith('.jpg')).map(f => {
    const path = `${uid}/galerie/${f.name}`
    return { path, src: supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl }
  })
}

export async function deleteGalleryPhoto(path: string) {
  const { error } = await supabase.storage.from('meal-photos').remove([path])
  return error?.message ?? null
}

// ─────────────── Espace invité ───────────────

export type GuestBooking = {
  id: string; ref: string; mealId: string; hostId: string; host: string; title: string; cuisine: string
  date: string; time: string; city: string; photo: string; seats: number; total: number; refunded: number
  status: 'confirmed' | 'past' | 'cancelled'; address: string | null; reviewed: boolean
}
export type MyReview = { id: string; meal: string; rating: number; date: string; text: string; author?: string }
export type PublicMeal = { id: string; title: string; host: string; city: string; date: string; time: string; price: number; left: number; photo: string; tags: string[]; allergens: string[] }

type BookingRow = { id: string; meal_id: string; seats: number; total_amount: number; status: string; refunded_amount: number | null; meals: (MealRow & { host_id: string; profiles: { full_name: string | null } | null }) | null }

export async function loadGuest(uid: string) {
  const { data: b } = await supabase.from('bookings')
    .select(`id, meal_id, seats, total_amount, status, refunded_amount, meals(${MEAL_COLS}, host_id, profiles(full_name))`)
    .eq('guest_id', uid).neq('status', 'pending').order('created_at', { ascending: false })
  const rows = ((b ?? []) as unknown as BookingRow[]).filter(r => r.meals)
  const { data: mine } = await supabase.from('reviews').select('id, booking_id, meal_id, rating, comment, created_at').eq('reviewer_id', uid).eq('type', 'guest_to_host').order('created_at', { ascending: false })
  const reviewedIds = new Set((mine ?? []).map((r: { booking_id: string }) => r.booking_id))

  // Adresse exacte : la base ne la renvoie qu'aux invités ayant payé.
  const activeMealIds = [...new Set(rows.filter(r => r.status === 'confirmed' || r.status === 'completed').map(r => r.meal_id))]
  const addresses = new Map<string, string>()
  if (activeMealIds.length) {
    const { data: a } = await supabase.from('meal_private').select('meal_id, address').in('meal_id', activeMealIds)
    ;(a ?? []).forEach((x: { meal_id: string; address: string }) => addresses.set(x.meal_id, x.address))
  }

  const bookings: GuestBooking[] = rows.map(r => {
    const m = r.meals!
    const t = (m.time || '19:30').slice(0, 5)
    const status: GuestBooking['status'] = r.status === 'cancelled' ? 'cancelled' : isPast(m.date, t) || r.status === 'completed' ? 'past' : 'confirmed'
    return {
      id: r.id, ref: r.id.slice(0, 8).toUpperCase(), mealId: r.meal_id, hostId: m.host_id, host: m.profiles?.full_name?.trim() || 'Hôte',
      title: m.title, cuisine: m.cuisine, date: m.date, time: t, city: m.city, photo: mealPhoto(m.photo_url, m.cuisine),
      seats: r.seats, total: Number(r.total_amount), refunded: Number(r.refunded_amount ?? 0), status,
      address: addresses.get(r.meal_id) ?? null, reviewed: reviewedIds.has(r.id),
    }
  })

  const titles = new Map(rows.map(r => [r.meal_id, r.meals!.title]))
  const myReviews: MyReview[] = ((mine ?? []) as { id: string; meal_id: string; rating: number; comment: string | null; created_at: string }[])
    .map(r => ({ id: r.id, meal: titles.get(r.meal_id) ?? 'Repas', rating: r.rating, date: r.created_at.slice(0, 10), text: r.comment ?? '' }))

  const { data: about } = await supabase.from('reviews')
    .select('id, rating, comment, created_at, meals(title), profiles!reviews_reviewer_id_fkey(full_name)')
    .eq('reviewed_id', uid).eq('type', 'host_to_guest').order('created_at', { ascending: false })
  const aboutMe: MyReview[] = ((about ?? []) as unknown as { id: string; rating: number; comment: string | null; created_at: string; meals: { title: string } | null; profiles: { full_name: string | null } | null }[])
    .map(r => ({ id: r.id, meal: r.meals?.title ?? 'Repas', rating: r.rating, date: r.created_at.slice(0, 10), text: r.comment ?? '', author: r.profiles?.full_name?.trim() || 'Hôte' }))

  const { data: f } = await supabase.from('favorites')
    .select(`meal_id, meals(${MEAL_COLS}, profiles(full_name))`).eq('user_id', uid)
  const favorites = ((f ?? []) as unknown as { meals: (MealRow & { profiles: { full_name: string | null } | null }) | null }[])
    .map(x => x.meals).filter((m): m is MealRow & { profiles: { full_name: string | null } | null } => Boolean(m && m.is_active))
    .map(toPublic)

  return { bookings, myReviews, aboutMe, favorites }
}

function toPublic(m: MealRow & { profiles: { full_name: string | null } | null }): PublicMeal {
  return {
    id: m.id, title: m.title, host: m.profiles?.full_name?.trim() || 'Hôte', city: m.city, date: m.date, time: (m.time || '').slice(0, 5),
    price: Number(m.price_per_seat), left: m.available_seats, photo: mealPhoto(m.photo_url, m.cuisine), tags: m.tags ?? [], allergens: m.allergens ?? [],
  }
}

/** Prochains repas publiés (hors ceux de l'utilisateur). */
export async function loadUpcoming(uid: string, limit = 6): Promise<PublicMeal[]> {
  const { data } = await supabase.from('meals').select(`${MEAL_COLS}, host_id, profiles(full_name)`)
    .eq('is_active', true).gte('date', todayParis()).neq('host_id', uid).gt('available_seats', 0)
    .order('date', { ascending: true }).limit(limit)
  return ((data ?? []) as unknown as (MealRow & { profiles: { full_name: string | null } | null })[]).map(toPublic)
}

export async function toggleFavorite(uid: string, mealId: string, on: boolean) {
  const { error } = on
    ? await supabase.from('favorites').insert({ user_id: uid, meal_id: mealId })
    : await supabase.from('favorites').delete().eq('user_id', uid).eq('meal_id', mealId)
  return error && error.code !== '23505' ? error.message : null
}

// ─────────────── Messages ───────────────

export type Thread = { id: string; name: string; avatar: string | null; last: string; lastAt: string; unread: number }
export type ChatMessage = { id: string; content: string; sender_id: string; receiver_id: string; created_at: string; is_read: boolean }

export async function loadThreads(uid: string): Promise<Thread[]> {
  const { data } = await supabase.from('messages').select('id, content, sender_id, receiver_id, created_at, is_read')
    .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`).order('created_at', { ascending: false }).limit(500)
  const map = new Map<string, Thread>()
  ;((data ?? []) as ChatMessage[]).forEach(m => {
    const other = m.sender_id === uid ? m.receiver_id : m.sender_id
    if (!other) return
    const t = map.get(other) ?? { id: other, name: '', avatar: null, last: m.content, lastAt: m.created_at, unread: 0 }
    if (m.receiver_id === uid && !m.is_read) t.unread += 1
    map.set(other, t)
  })
  const ids = [...map.keys()]
  if (ids.length) {
    const { data: p } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
    ;(p ?? []).forEach((x: { id: string; full_name: string | null; avatar_url: string | null }) => {
      const t = map.get(x.id)
      if (t) { t.name = x.full_name?.trim() || ''; t.avatar = x.avatar_url }
    })
  }
  return [...map.values()].map(t => ({ ...t, name: t.name || 'Utilisateur' }))
}

export async function loadConversation(uid: string, other: string): Promise<ChatMessage[]> {
  const { data } = await supabase.from('messages').select('id, content, sender_id, receiver_id, created_at, is_read')
    .or(`and(sender_id.eq.${uid},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${uid})`)
    .order('created_at', { ascending: true })
  return (data ?? []) as ChatMessage[]
}

export async function markRead(uid: string, other: string) {
  await supabase.from('messages').update({ is_read: true }).eq('receiver_id', uid).eq('sender_id', other).eq('is_read', false)
}

/** Masque numéros et emails : les échanges et paiements restent sur Shareat. */
export const maskContacts = (v: string) => v
  .replace(/(\+?\d[\d .-]{7,}\d)/g, '[numéro masqué]')
  .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '[email masqué]')

export async function sendMessage(uid: string, to: string, content: string, mealId: string | null = null): Promise<ChatMessage> {
  const { data, error } = await supabase.from('messages')
    .insert({ sender_id: uid, receiver_id: to, content: maskContacts(content.trim()).slice(0, 2000), meal_id: mealId })
    .select('id, content, sender_id, receiver_id, created_at, is_read').single()
  if (error || !data) throw new Error(error?.message || 'Message non envoyé')
  api('/api/notify/message', { message_id: (data as ChatMessage).id }).catch(() => undefined)
  return data as ChatMessage
}
