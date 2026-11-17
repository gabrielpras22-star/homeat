'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Header from './components/site/Header'
import Footer from './components/site/Footer'
import Icon from './components/site/Icons'
import { Counter, Tile } from './components/site/Interactive'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { ALLERGENS, CATEGORIES, CUISINES, COMMISSION_RATE, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, TRANSFER_DELAY_HOURS, displayPrice, parisDateTime, todayParis } from '../lib/shared'
import { geocodeAddress, approx, type GeoResult } from '../lib/geocode'
import MealMap, { type MapPoint } from './components/MealMap'

// ═════════════════════════════ TYPES ═════════════════════════════

type HostInfo = {
  full_name: string | null
  avatar_url?: string | null
  rating?: number | null
  bio?: string | null
}

type Profile = HostInfo & { id: string; city?: string | null }

type Meal = {
  id: string
  title: string
  cuisine: string
  price_per_seat: number
  available_seats: number
  max_seats?: number
  date: string
  time: string
  city: string
  menu: string[] | null
  tags: string[] | null
  allergens: string[] | null
  photo_url: string | null
  rating: number | null
  reviews_count: number | null
  description: string | null
  host_id: string
  is_active?: boolean
  lat: number | null
  lng: number | null
  profiles: HostInfo | null
}

type Message = { id: string; content: string; sender_id: string; receiver_id: string; created_at: string }

type Booking = {
  id: string
  meal_id: string
  seats: number
  total_amount: number
  status: string
  created_at: string
  refunded_amount: number | null
  meals: Meal | null
}

type HostBooking = { id: string; meal_id: string; seats: number; status: string; host_amount: number | null; profiles: { full_name: string | null } | null }

type Review = { id: string; rating: number; comment: string | null; created_at: string; profiles: { full_name: string | null } | null }

type ConvUser = { id: string; name: string }
type Conversation = ConvUser & { lastMsg: string }
type Payouts = { configured: boolean; active: boolean }

type Page = 'home' | 'explore' | 'map' | 'detail' | 'messages' | 'dashboard' | 'become'
type DashTab = 'overview' | 'bookings' | 'favorites' | 'profile' | 'host'
type Confirm = { kind: 'booking'; id: string; title: string; refundable: boolean } | { kind: 'meal'; id: string; title: string; guests: number }

// ═════════════════════════════ HELPERS ═════════════════════════════

/** Photo Unsplash (licence Unsplash : usage libre, commercial compris). */
const unsplash = (id: string, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

const HERO_PHOTO = '1528605248644-14dd04022da1'
const HOST_PHOTO = '1556910103-1c02745aae4d'

/** Illustration par défaut selon la cuisine, quand l'hôte n'a pas fourni de photo. */
const cuisinePhotos: Record<string, string> = {
  Marocaine: '1541518763669-27fef04b14ea',
  Italienne: '1473093295043-cdd812d0e601',
  Japonaise: '1569718212165-3a8278d5f624',
  Mexicaine: '1565299585323-38d6b0865b47',
  Indienne: '1585937421612-70a008356fbe',
  Française: '1467003909585-2f8a72700288',
  Libanaise: '1511690656952-34342bb7c2f2',
  Espagnole: '1534080564583-6be75777b70a',
  Autre: '1414235077428-338989a2e8c0',
}

const isHttpsUrl = (v?: string | null) => Boolean(v && /^https:\/\/\S+$/i.test(v.trim()))
const mealPhoto = (m: Pick<Meal, 'photo_url' | 'cuisine'>, w = 900) =>
  isHttpsUrl(m.photo_url) ? m.photo_url!.trim() : unsplash(cuisinePhotos[m.cuisine] || cuisinePhotos.Autre, w)

const avatarTones = ['#A7C7E7', '#8FB3DA', '#C3D7EE', '#7FA3CC', '#B5C9E6', '#9BB8DD']
const tone = (name?: string | null) => avatarTones[(name?.charCodeAt(0) || 0) % avatarTones.length]
const initial = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?'

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const eur = (n: number) => {
  const v = money(n)
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + ' €'
}

const fmtDate = (iso?: string | null, long = false) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', long
    ? { weekday: 'long', day: 'numeric', month: 'long' }
    : { weekday: 'short', day: 'numeric', month: 'short' })
}
const fmtTime = (t?: string | null) => (t ? t.slice(0, 5).replace(':', 'h') : '')

const stars = (rating: number) => {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}
const seatsLabel = (n: number) => (n > 0 ? `${n} place${n > 1 ? 's' : ''}` : 'Complet')
const hoursUntil = (m: Pick<Meal, 'date' | 'time'>) => (parisDateTime(m.date, m.time).getTime() - Date.now()) / 3_600_000

/** Prix hôte maximal pour que le prix affiché reste ≤ 10 € (repas étudiant). */
const STUDENT_MAX_HOST_PRICE = Math.floor((STUDENT_MAX_PRICE / (1 + COMMISSION_RATE)) * 100) / 100

const MEAL_COLS = 'id, title, cuisine, price_per_seat, available_seats, max_seats, date, time, city, menu, tags, allergens, photo_url, rating, reviews_count, description, host_id, is_active, lat, lng'
const PROFILE_COLS = 'id, full_name, avatar_url, bio, city, rating, reviews_count'

/** Appel d'une route serveur, avec le jeton de session de l'utilisateur. */
async function api<T>(path: string, body: unknown = {}): Promise<T> {
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

/** Réduit une photo (max 1600 px, JPEG) avant envoi : plus rapide sur mobile et moins de stockage. */
async function resizeImage(file: File, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/jpeg', 0.82))
}

// ═════════════════════════════ DATA ═════════════════════════════

async function fetchMeals(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select(`${MEAL_COLS}, profiles(full_name, avatar_url, rating, bio)`)
    .eq('is_active', true)
    .gte('date', todayParis())
    .order('date', { ascending: true })
  if (error) throw error
  return (data || []) as unknown as Meal[]
}

async function fetchProfile(uid: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', uid).maybeSingle()
  return (data as Profile | null) || null
}

async function fetchBookings(uid: string): Promise<Booking[]> {
  const { data } = await supabase.from('bookings')
    .select(`id, meal_id, seats, total_amount, status, created_at, refunded_amount, meals(${MEAL_COLS}, profiles(full_name))`)
    .eq('guest_id', uid)
    .neq('status', 'pending')
    .order('created_at', { ascending: false })
  return (data || []) as unknown as Booking[]
}

async function fetchMyReviewBookingIds(uid: string): Promise<Set<string>> {
  const { data } = await supabase.from('reviews').select('booking_id').eq('reviewer_id', uid)
  return new Set((data || []).map((r: { booking_id: string }) => r.booking_id))
}

async function fetchFavorites(uid: string): Promise<Meal[]> {
  const { data } = await supabase.from('favorites')
    .select(`meal_id, meals(${MEAL_COLS}, profiles(full_name, avatar_url, rating, bio))`)
    .eq('user_id', uid)
  return ((data || []) as unknown as { meals: Meal | null }[]).map(f => f.meals).filter((m): m is Meal => Boolean(m && m.is_active))
}

async function fetchReviews(mealId: string): Promise<Review[]> {
  const { data } = await supabase.from('reviews')
    .select('id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(full_name)')
    .eq('meal_id', mealId)
    .order('created_at', { ascending: false })
  return (data || []) as unknown as Review[]
}

async function fetchHostData(uid: string) {
  const { data: meals } = await supabase.from('meals').select(MEAL_COLS).eq('host_id', uid).order('date', { ascending: false })
  const list = (meals || []) as Meal[]
  let bookings: HostBooking[] = []
  if (list.length > 0) {
    const { data } = await supabase.from('bookings')
      .select('id, meal_id, seats, status, host_amount, profiles!bookings_guest_id_fkey(full_name)')
      .in('meal_id', list.map(m => m.id))
      .in('status', ['confirmed', 'completed'])
    bookings = (data || []) as unknown as HostBooking[]
  }
  return { meals: list, bookings }
}

async function fetchMealAddress(mealId: string): Promise<string | null> {
  const { data } = await supabase.from('meal_private').select('address').eq('meal_id', mealId).maybeSingle()
  return (data as { address: string } | null)?.address ?? null
}

async function fetchConversations(uid: string): Promise<Conversation[]> {
  const { data } = await supabase.from('messages')
    .select('*')
    .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
    .order('created_at', { ascending: false })
  const msgs = (data || []) as Message[]
  const convMap = new Map<string, Conversation>()
  msgs.forEach(m => {
    const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id
    if (otherId && !convMap.has(otherId)) convMap.set(otherId, { id: otherId, name: '', lastMsg: m.content })
  })
  const ids = [...convMap.keys()]
  if (ids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids)
    ;(profs || []).forEach((p: { id: string; full_name: string | null }) => {
      const c = convMap.get(p.id)
      if (c) c.name = p.full_name || ''
    })
  }
  return [...convMap.values()].map(c => ({ ...c, name: c.name || 'Utilisateur' }))
}

async function fetchMessages(uid: string, otherId: string): Promise<Message[]> {
  const { data } = await supabase.from('messages')
    .select('*')
    .or(`and(sender_id.eq.${uid},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${uid})`)
    .order('created_at', { ascending: true })
  return (data || []) as Message[]
}

// ═════════════════════════════ UI COMPONENTS ═════════════════════════════
// Déclarés HORS du composant principal : sinon ils sont recréés à chaque
// rendu et les champs perdent le focus à chaque frappe.

type InpProps = {
  placeholder: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  min?: string
  maxLength?: number
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'url'
  autoComplete?: string
  label?: string
  hint?: ReactNode
}

const Inp = ({ placeholder, value, onChange, type = 'text', readOnly, min, maxLength, inputMode, autoComplete, label, hint }: InpProps) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <input className="input" type={type} placeholder={placeholder} aria-label={label || placeholder} value={value} readOnly={readOnly}
      min={min} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete}
      onChange={e => onChange?.(e.target.value)} />
    {hint && <span className="field-hint">{hint}</span>}
  </label>
)

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
    <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.1 3.4 4.5 7 4.5c2.1 0 3.5 1.2 5 3 1.5-1.8 2.9-3 5-3 3.6 0 5.5 3.6 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" />
  </svg>
)

const Avatar = ({ name, size = 36 }: { name?: string | null; size?: number }) => (
  <span className="avatar" style={{ width: size, height: size, background: tone(name), fontSize: size * 0.4 }}>{initial(name)}</span>
)

type MealCardProps = { m: Meal; isFav: boolean; onOpen: (m: Meal) => void; onToggleFav: (id: string) => void }

const MealCard = ({ m, isFav, onOpen, onToggleFav }: MealCardProps) => (
  <article className="meal-card" onClick={() => onOpen(m)} onKeyDown={e => { if (e.key === 'Enter') onOpen(m) }} tabIndex={0} role="button" aria-label={m.title}>
    <div className="meal-photo">
      <img src={mealPhoto(m, 700)} alt={m.title} loading="lazy" />
      <button className={`fav-btn${isFav ? ' on' : ''}`} aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        onClick={e => { e.stopPropagation(); onToggleFav(m.id) }}>
        <HeartIcon filled={isFav} />
      </button>
      {(m.rating || 0) > 0 && <span className="meal-rating">★ {Number(m.rating).toFixed(1)}</span>}
    </div>
    <div className="meal-body">
      <h3 className="meal-title">{m.title}</h3>
      <p className="meal-host">Chez {m.profiles?.full_name || 'votre hôte'}</p>
      <div className="meal-meta">
        <span>{m.city}</span><span>·</span><span>{fmtDate(m.date)}</span><span>·</span><span>{seatsLabel(m.available_seats)}</span>
      </div>
      {(m.tags?.length || 0) > 0 && (
        <div className="tag-row">{m.tags!.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}</div>
      )}
      <div className="meal-foot">
        <span className="meal-cuisine">{m.cuisine}</span>
        <span className="meal-price">{eur(displayPrice(m.price_per_seat))} <small>/ couvert</small></span>
      </div>
    </div>
  </article>
)

type GridProps = {
  data: Meal[]
  favIds: Set<string>
  loading?: boolean
  empty?: ReactNode
  onOpen: (m: Meal) => void
  onToggleFav: (id: string) => void
}

const Grid = ({ data, favIds, loading, empty, onOpen, onToggleFav }: GridProps) => (
  <div className="meal-grid">
    {loading
      ? <div className="empty">Chargement des tables…</div>
      : data.length === 0
        ? <div className="empty">{empty || 'Aucune table disponible pour le moment.'}</div>
        : data.map(m => <MealCard key={m.id} m={m} isFav={favIds.has(m.id)} onOpen={onOpen} onToggleFav={onToggleFav} />)
    }
  </div>
)

// ═════════════════════════════ PAGE ═════════════════════════════

export default function Shareat() {
  const router = useRouter()
  const [page, setPage] = useState<Page>('home')
  const [prevPage, setPrevPage] = useState<Page>('home')
  const [meals, setMeals] = useState<Meal[]>([])
  const [mealsLoading, setMealsLoading] = useState(true)
  const [mealsError, setMealsError] = useState('')
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [mealReviews, setMealReviews] = useState<Review[]>([])
  const [mealAddress, setMealAddress] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [guests, setGuests] = useState(1)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [showAuth, setShowAuth] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [paying, setPaying] = useState(false)
  const [bookingResult, setBookingResult] = useState<{ status: 'confirmed' | 'refunded' | 'unpaid'; meal: Meal | null; seats: number } | null>(null)
  const [toastMsg, setToastMsg] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [filterCuisine, setFilterCuisine] = useState('all')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [searchCity, setSearchCity] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const [dashTab, setDashTab] = useState<DashTab>('overview')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())
  const [favMeals, setFavMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(false)
  const [hostTitle, setHostTitle] = useState('')
  const [hostCuisine, setHostCuisine] = useState('Française')
  const [hostPrice, setHostPrice] = useState('')
  const [hostDate, setHostDate] = useState('')
  const [hostTime, setHostTime] = useState('19:30')
  const [hostSeats, setHostSeats] = useState('')
  const [hostDesc, setHostDesc] = useState('')
  const [hostMenu, setHostMenu] = useState('')
  const [hostPhoto, setHostPhoto] = useState('')
  const [hostTags, setHostTags] = useState<string[]>([])
  const [hostAllergens, setHostAllergens] = useState<string[]>([])
  const [noAllergens, setNoAllergens] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [hostAddress, setHostAddress] = useState('')
  const [addressMatches, setAddressMatches] = useState<GeoResult[]>([])
  const [addressPick, setAddressPick] = useState<GeoResult | null>(null)
  const [addressBusy, setAddressBusy] = useState(false)
  const [profileFname, setProfileFname] = useState('')
  const [profileLname, setProfileLname] = useState('')
  const [profileCity, setProfileCity] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [payouts, setPayouts] = useState<Payouts | null>(null)
  const [payoutsBusy, setPayoutsBusy] = useState(false)
  const [hostMeals, setHostMeals] = useState<Meal[]>([])
  const [hostBookings, setHostBookings] = useState<HostBooking[]>([])
  const [hostReload, setHostReload] = useState(0)
  const [confirmAction, setConfirmAction] = useState<Confirm | null>(null)
  const [reviewFor, setReviewFor] = useState<Booking | null>(null)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [selectedConvUser, setSelectedConvUser] = useState<ConvUser | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const bubblesRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const returnHandled = useRef(false)

  const userId = user?.id ?? null

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(''), 4500)
  }

  const nav = (p: Page) => {
    if (p !== page) setPrevPage(page)
    setPage(p)
    window.scrollTo(0, 0)
  }

  const goBack = () => {
    const target: Page = prevPage === 'detail' || prevPage === page ? 'explore' : prevPage
    setPage(target)
    window.scrollTo(0, 0)
  }

  const requireAuth = (msg?: string) => {
    setAuthMode('login')
    setShowAuth(true)
    if (msg) showToast(msg)
  }

  const reloadMeals = () => {
    fetchMeals()
      .then(data => { setMeals(data); setMealsError('') })
      .catch(() => setMealsError('Impossible de charger les tables.'))
  }

  const reloadBookings = (uid: string) => {
    fetchBookings(uid).then(setBookings)
    fetchMyReviewBookingIds(uid).then(setReviewedIds)
  }

  // ── EFFETS ──

  // Liens « /?vue=explorer » ou « /?vue=carte » venant des autres pages.
  useEffect(() => {
    const vue = new URLSearchParams(window.location.search).get('vue')
    if (vue === 'explorer' || vue === 'carte') queueMicrotask(() => setPage(vue === 'carte' ? 'map' : 'explore'))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchMeals()
      .then(data => { if (!cancelled) setMeals(data) })
      .catch(() => { if (!cancelled) setMealsError(supabaseConfigured ? 'Impossible de charger les tables.' : 'Supabase n’est pas configuré (variables d’environnement manquantes).') })
      .finally(() => { if (!cancelled) setMealsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handle = (session: Session | null) => {
      const u = session?.user ?? null
      setUser(prev => (prev?.id === u?.id ? (u ? prev : null) : u))
      setAuthReady(true)
      if (u) setShowAuth(false)
      else {
        setProfile(null); setBookings([]); setFavMeals([]); setConversations([])
        setMessages([]); setSelectedConvUser(null); setPayouts(null); setHostMeals([]); setHostBookings([])
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => handle(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchProfile(userId).then(p => {
      if (cancelled || !p) return
      setProfile(p)
      const parts = (p.full_name || '').trim().split(/\s+/)
      setProfileFname(parts[0] || '')
      setProfileLname(parts.slice(1).join(' '))
      setProfileCity(p.city || '')
      setProfileBio(p.bio || '')
    })
    fetchFavorites(userId).then(f => { if (!cancelled) setFavMeals(f) })
    fetchBookings(userId).then(b => { if (!cancelled) setBookings(b) })
    // Finalise un éventuel paiement abouti dont le retour sur le site n'a pas eu lieu.
    api<{ confirmed: number }>('/api/checkout/reconcile')
      .then(r => { if (!cancelled && r.confirmed > 0) { fetchBookings(userId).then(setBookings); showToast('Votre paiement a été confirmé : réservation enregistrée.') } })
      .catch(() => undefined)
    supabase.from('host_payouts').select('transfers_active').eq('host_id', userId).maybeSingle()
      // Ne jamais écraser un statut « actif » obtenu entre-temps auprès de Stripe (retour d'inscription).
      .then(({ data }) => { if (!cancelled) setPayouts(prev => (prev?.active ? prev : { configured: Boolean(data), active: Boolean(data?.transfers_active) })) })
    return () => { cancelled = true }
  }, [userId])

  // Retour depuis Stripe (paiement ou inscription aux versements).
  useEffect(() => {
    if (!authReady || returnHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const paiement = params.get('paiement')
    const versements = params.get('versements')
    if (!paiement && !versements) return
    returnHandled.current = true
    window.history.replaceState({}, '', window.location.pathname)
    // Traitement différé : évite des mises à jour d'état synchrones dans l'effet.
    queueMicrotask(() => {
    if (!userId) { requireAuth('Reconnectez-vous pour finaliser.'); return }

    if (paiement === 'ok' && params.get('session_id')) {
      api<{ status: 'confirmed' | 'refunded' | 'unpaid'; meal_id: string; seats: number }>('/api/checkout/confirm', { session_id: params.get('session_id') })
        .then(async r => {
          const { data } = await supabase.from('meals').select(`${MEAL_COLS}, profiles(full_name, avatar_url, rating, bio)`).eq('id', r.meal_id).maybeSingle()
          setBookingResult({ status: r.status, meal: (data as Meal | null) ?? null, seats: r.seats })
          reloadMeals()
          reloadBookings(userId)
        })
        .catch(e => showToast(e.message))
    } else if (paiement === 'annule' && params.get('reservation')) {
      api('/api/bookings/cancel', { booking_id: params.get('reservation') }).catch(() => undefined)
      showToast('Paiement annulé : aucune somme n’a été prélevée.')
    } else if (versements === 'retour') {
      setDashTab('host'); setPage('dashboard')
      api<Payouts>('/api/connect/status')
        .then(r => { setPayouts(r); showToast(r.active ? 'Versements activés : vous pouvez publier vos tables.' : 'Inscription Stripe incomplète : il reste des informations à fournir.') })
        .catch(e => showToast(e.message))
    } else if (versements === 'relancer') {
      setDashTab('host'); setPage('dashboard')
      api<{ url: string }>('/api/connect/onboard').then(r => { window.location.href = r.url }).catch(e => showToast(e.message))
    }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, userId])

  useEffect(() => {
    if (page !== 'dashboard' || !userId) return
    let cancelled = false
    fetchBookings(userId).then(b => { if (!cancelled) setBookings(b) })
    fetchMyReviewBookingIds(userId).then(s => { if (!cancelled) setReviewedIds(s) })
    fetchFavorites(userId).then(f => { if (!cancelled) setFavMeals(f) })
    if (dashTab === 'host') {
      fetchHostData(userId).then(d => { if (!cancelled) { setHostMeals(d.meals); setHostBookings(d.bookings) } })
    }
    return () => { cancelled = true }
  }, [page, dashTab, userId, hostReload])

  // Adresse exacte : seulement pour un invité ayant réservé (filtrée par la base).
  const selectedId = selectedMeal?.id ?? null
  useEffect(() => {
    if (!selectedId || !userId) return
    let cancelled = false
    fetchMealAddress(selectedId).then(a => { if (!cancelled) setMealAddress(a) })
    return () => { cancelled = true }
  }, [selectedId, userId, bookings])

  useEffect(() => {
    if (page !== 'messages' || !userId) return
    let cancelled = false
    fetchConversations(userId).then(c => { if (!cancelled) setConversations(c) })
    return () => { cancelled = true }
  }, [page, userId])

  const convId = selectedConvUser?.id ?? null
  useEffect(() => {
    if (!userId || !convId) return
    let cancelled = false
    fetchMessages(userId, convId).then(m => { if (!cancelled) setMessages(m) })
    const channel = supabase
      .channel(`messages-${userId}-${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new as Message
        const inConv = (m.sender_id === userId && m.receiver_id === convId) || (m.sender_id === convId && m.receiver_id === userId)
        if (inConv) setMessages(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]))
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [userId, convId])

  useEffect(() => {
    if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight
  }, [messages])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // ── DÉRIVÉS ──

  const filtered = useMemo(() => {
    let r = meals
    if (filterCuisine !== 'all') r = r.filter(m => m.cuisine === filterCuisine)
    if (filterTags.length > 0) r = r.filter(m => filterTags.every(t => m.tags?.includes(t)))
    const city = appliedCity.trim().toLowerCase()
    if (city) r = r.filter(m => m.city?.toLowerCase().includes(city))
    return r
  }, [meals, filterCuisine, filterTags, appliedCity])

  const mapPoints: MapPoint[] = useMemo(() => filtered
    .filter(m => m.lat != null && m.lng != null)
    .map(m => ({ id: m.id, lat: m.lat!, lng: m.lng!, title: m.title, label: eur(displayPrice(m.price_per_seat)) })), [filtered])

  const favIds = useMemo(() => new Set(favMeals.map(m => m.id)), [favMeals])

  const total = selectedMeal ? money(displayPrice(selectedMeal.price_per_seat) * guests) : 0
  const isOwnMeal = Boolean(selectedMeal && user && selectedMeal.host_id === user.id)
  const soldOut = Boolean(selectedMeal && selectedMeal.available_seats <= 0)
  const hasBooked = Boolean(selectedMeal && bookings.some(b => b.meal_id === selectedMeal.id && (b.status === 'confirmed' || b.status === 'completed')))

  const priceNum = parseFloat(hostPrice.replace(',', '.'))
  const pricePreview = Number.isFinite(priceNum) && priceNum > 0 ? displayPrice(priceNum) : null

  // ── ACTIONS ──

  const openMeal = (m: Meal) => {
    setSelectedMeal(m)
    setGuests(1)
    setMealReviews([])
    setMealAddress(null)
    fetchReviews(m.id).then(setMealReviews)
    nav('detail')
  }

  const openMealById = (id: string) => {
    const m = meals.find(x => x.id === id)
    if (m) openMeal(m)
  }

  const openConversation = (other: ConvUser) => {
    if (!user) { requireAuth('Connectez-vous pour envoyer un message'); return }
    if (other.id === user.id) { showToast('C’est votre propre table'); return }
    if (other.id !== selectedConvUser?.id) setMessages([])
    setSelectedConvUser(other)
    nav('messages')
  }

  const resetFilters = () => { setFilterCuisine('all'); setFilterTags([]); setSearchCity(''); setAppliedCity('') }
  const toggleFilterTag = (t: string) => setFilterTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))

  const doLogin = async () => {
    if (!email.trim() || !password) { showToast('Email et mot de passe requis'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { showToast(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message); return }
    setShowAuth(false)
    showToast('Bienvenue')
    setEmail(''); setPassword('')
  }

  const doSignup = async () => {
    if (!fullName.trim()) { showToast('Indiquez votre prénom et votre nom'); return }
    if (!email.trim()) { showToast('Indiquez votre email'); return }
    if (password.length < 8) { showToast('Mot de passe trop court (8 caractères minimum)'); return }
    if (!acceptTerms) { showToast('Acceptez les conditions et confirmez avoir 18 ans pour créer un compte'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) { showToast(error.message); return }
    setShowAuth(false)
    showToast(data.session ? 'Compte créé, bienvenue' : 'Compte créé. Confirmez votre adresse depuis l’email reçu.')
    setEmail(''); setPassword(''); setFullName(''); setAcceptTerms(false)
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    nav('home')
    setDashTab('overview')
    showToast('À bientôt')
  }

  const startPayment = async () => {
    if (!user) { requireAuth('Connectez-vous pour réserver'); return }
    if (!selectedMeal) return
    if (isOwnMeal) { showToast('Vous ne pouvez pas réserver votre propre table'); return }
    if (soldOut) { showToast('Cette table est complète'); return }
    setPaying(true)
    try {
      const { url } = await api<{ url: string }>('/api/checkout', { meal_id: selectedMeal.id, seats: guests })
      window.location.href = url
    } catch (e) {
      setPaying(false)
      showToast((e as Error).message)
    }
  }

  const startPayoutsOnboarding = async () => {
    setPayoutsBusy(true)
    try {
      const { url } = await api<{ url: string }>('/api/connect/onboard')
      window.location.href = url
    } catch (e) {
      setPayoutsBusy(false)
      showToast((e as Error).message)
    }
  }

  const openPayoutsDashboard = async () => {
    setPayoutsBusy(true)
    try {
      const { url } = await api<{ url: string }>('/api/connect/dashboard')
      window.location.href = url
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setPayoutsBusy(false)
    }
  }

  const runConfirmAction = async () => {
    if (!confirmAction || !userId) return
    setLoading(true)
    try {
      if (confirmAction.kind === 'booking') {
        const r = await api<{ refunded: number }>('/api/bookings/cancel', { booking_id: confirmAction.id })
        showToast(r.refunded > 0 ? `Réservation annulée : ${eur(r.refunded)} remboursés sous 5 à 10 jours.` : 'Réservation annulée')
        reloadBookings(userId)
      } else {
        const r = await api<{ refunded_guests: number }>('/api/meals/cancel', { meal_id: confirmAction.id })
        showToast(r.refunded_guests > 0 ? `Table annulée : ${r.refunded_guests} invité(s) remboursé(s).` : 'Table annulée')
        setHostReload(n => n + 1)
      }
      reloadMeals()
      setConfirmAction(null)
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const submitReview = async () => {
    if (!user || !reviewFor?.meals) return
    setLoading(true)
    const { error } = await supabase.from('reviews').insert({
      booking_id: reviewFor.id,
      reviewer_id: user.id,
      reviewed_id: reviewFor.meals.host_id,
      meal_id: reviewFor.meal_id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
      type: 'guest_to_host',
    })
    setLoading(false)
    if (error) { showToast(error.code === '23505' ? 'Vous avez déjà laissé un avis pour ce repas' : 'Avis impossible : ' + error.message); return }
    showToast('Merci pour votre avis')
    setReviewFor(null); setReviewComment(''); setReviewRating(5)
    reloadBookings(user.id)
    reloadMeals()
  }

  const toggleFavorite = async (mealId: string) => {
    if (!user) { requireAuth('Connectez-vous pour enregistrer des favoris'); return }
    if (favIds.has(mealId)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('meal_id', mealId)
      if (error) { showToast(error.message); return }
      setFavMeals(prev => prev.filter(m => m.id !== mealId))
      showToast('Retiré des favoris')
    } else {
      const meal = meals.find(m => m.id === mealId) || (selectedMeal?.id === mealId ? selectedMeal : null)
      if (meal) setFavMeals(prev => [...prev, meal])
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, meal_id: mealId })
      if (error && error.code !== '23505') {
        setFavMeals(prev => prev.filter(m => m.id !== mealId))
        showToast(error.message)
        return
      }
      showToast('Ajouté aux favoris')
      fetchFavorites(user.id).then(setFavMeals)
    }
  }

  const sendMessage = async () => {
    const content = msgInput.trim()
    if (!content || !user || !selectedConvUser || sending) return
    setSending(true)
    const { data, error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedConvUser.id,
      content,
      meal_id: selectedMeal && selectedMeal.host_id === selectedConvUser.id ? selectedMeal.id : null
    }).select('*').single()
    setSending(false)
    if (error) { showToast(error.message); return }
    setMsgInput('')
    const m = data as Message
    setMessages(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]))
    fetchConversations(user.id).then(setConversations)
    api('/api/notify/message', { message_id: m.id }).catch(() => undefined)
  }

  const searchAddress = async () => {
    setAddressBusy(true)
    setAddressPick(null)
    try {
      const results = await geocodeAddress(hostAddress)
      setAddressMatches(results)
      if (results.length === 0) showToast('Adresse introuvable : précisez le numéro, la rue et la ville.')
      if (results.length === 1) { setAddressPick(results[0]); setAddressMatches([]) }
    } catch {
      showToast('Le service d’adresses ne répond pas. Réessayez dans un instant.')
    } finally {
      setAddressBusy(false)
    }
  }

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { showToast('Choisissez une image (JPEG, PNG ou WebP)'); return }
    setPhotoBusy(true)
    try {
      const blob = await resizeImage(file)
      const path = `${user.id}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('meal-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      setHostPhoto(supabase.storage.from('meal-photos').getPublicUrl(path).data.publicUrl)
    } catch (e) {
      showToast('Envoi de la photo impossible : ' + ((e as Error).message || 'réessayez'))
    } finally {
      setPhotoBusy(false)
    }
  }

  const publishMeal = async () => {
    if (!user) { requireAuth(); return }
    if (!payouts?.active) { showToast('Activez vos versements avant de publier'); return }
    if (!hostTitle.trim() || !hostPrice || !hostDate || !hostSeats) { showToast('Remplissez tous les champs obligatoires'); return }
    if (!addressPick) { showToast('Vérifiez votre adresse avant de publier'); return }
    const price = parseFloat(hostPrice.replace(',', '.'))
    const seats = Number(hostSeats)
    if (!Number.isFinite(price) || price <= 0 || price > 500) { showToast('Prix invalide (entre 1 et 500 €)'); return }
    if (!Number.isInteger(seats) || seats < 1 || seats > 50) { showToast('Nombre de couverts invalide (1 à 50)'); return }
    if (hostDate < todayParis()) { showToast('La date doit être aujourd’hui ou plus tard'); return }
    if (hostAllergens.length === 0 && !noAllergens) { showToast('Indiquez les allergènes présents, ou cochez « aucun allergène majeur »'); return }
    if (hostTags.includes('Repas étudiant') && displayPrice(price) > STUDENT_MAX_PRICE) { showToast(`Repas étudiant : votre prix doit être de ${eur(STUDENT_MAX_HOST_PRICE)} maximum (${STUDENT_MAX_PRICE} € pour l’invité)`); return }
    if (photoBusy) { showToast('Patientez pendant l’envoi de la photo'); return }
    setLoading(true)
    const { data: created, error } = await supabase.from('meals').insert({
      host_id: user.id,
      title: hostTitle.trim(),
      cuisine: hostCuisine,
      price_per_seat: money(price),
      max_seats: seats,
      available_seats: seats,
      date: hostDate,
      time: hostTime || '19:30',
      city: addressPick.city || addressPick.label,
      description: hostDesc.trim(),
      menu: hostMenu.split('\n').map(l => l.trim()).filter(Boolean),
      tags: hostTags,
      allergens: noAllergens ? [] : hostAllergens,
      is_active: true,
      photo_url: hostPhoto.trim() || null,
      lat: approx(addressPick.lat),
      lng: approx(addressPick.lng),
    }).select('id').single()
    if (error || !created) { setLoading(false); showToast(error?.message || 'Publication impossible'); return }
    const { error: addrError } = await supabase.from('meal_private').insert({
      meal_id: created.id, address: addressPick.label, lat: addressPick.lat, lng: addressPick.lng,
    })
    setLoading(false)
    if (addrError) showToast('Table publiée, mais l’adresse n’a pas pu être enregistrée : ' + addrError.message)
    else showToast('Votre table est publiée')
    reloadMeals()
    setHostReload(n => n + 1)
    setHostTitle(''); setHostPrice(''); setHostDate(''); setHostSeats(''); setHostDesc(''); setHostMenu(''); setHostPhoto(''); setHostTags([]); setHostAllergens([]); setNoAllergens(false)
  }

  const saveProfile = async () => {
    if (!user) return
    const full_name = `${profileFname.trim()} ${profileLname.trim()}`.trim()
    if (!full_name) { showToast('Indiquez au moins votre prénom'); return }
    setLoading(true)
    const { data, error } = await supabase.from('profiles').update({
      full_name,
      city: profileCity.trim(),
      bio: profileBio.trim()
    }).eq('id', user.id).select(PROFILE_COLS).maybeSingle()
    setLoading(false)
    if (error) { showToast(error.message); return }
    if (data) setProfile(data as Profile)
    showToast('Profil enregistré')
  }

  // ── RENDU ──

  const gridProps = { favIds, onOpen: openMeal, onToggleFav: toggleFavorite }
  const emptyState = mealsError
    ? <p>{mealsError}</p>
    : meals.length > 0
      ? <><p>Aucune table ne correspond à votre recherche.</p><button className="btn btn-ghost" onClick={resetFilters}>Réinitialiser les filtres</button></>
      : <><p className="empty-title">Les premières tables arrivent.</p><p>Shareat vient d’ouvrir : proposez la vôtre et accueillez vos premiers invités.</p><button className="btn btn-primary" onClick={() => router.push('/devenir-hote')}>Proposer une table</button></>

  const filters = (
    <div className="filters">
      <div className="chips" role="group" aria-label="Cuisine">
        {['all', ...CUISINES].map(c => (
          <button key={c} aria-pressed={filterCuisine === c} className={`chip${filterCuisine === c ? ' on' : ''}`} onClick={() => setFilterCuisine(c)}>
            {c === 'all' ? 'Toutes les cuisines' : c}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Catégories">
        {CATEGORIES.map(t => (
          <button key={t} aria-pressed={filterTags.includes(t)} className={`chip chip-soft${filterTags.includes(t) ? ' on' : ''}`} onClick={() => toggleFilterTag(t)}>{t}</button>
        ))}
      </div>
    </div>
  )

  const cityFilter = (
    <div className="explore-bar">
      <input className="input input-pill" value={searchCity} onChange={e => { setSearchCity(e.target.value); setAppliedCity(e.target.value) }} placeholder="Filtrer par ville…" aria-label="Filtrer par ville" />
      {!mealsLoading && <span className="muted">{filtered.length} table{filtered.length > 1 ? 's' : ''}</span>}
    </div>
  )


  const dashTabs: [DashTab, string][] = [['overview', 'Vue d’ensemble'], ['bookings', 'Réservations'], ['favorites', 'Favoris'], ['profile', 'Mon profil'], ['host', 'Espace hôte']]

  const hostSeatsBooked = (mealId: string) => hostBookings.filter(b => b.meal_id === mealId).reduce((s, b) => s + b.seats, 0)
  const hostEarned = hostBookings.reduce((s, b) => s + (Number(b.host_amount) || 0), 0)

  return (
    <div className="shell">

      <Header
        current={page === 'home' ? '/' : page === 'explore' ? '/?vue=explorer' : page === 'map' ? '/?vue=carte' : `/#${page}`}
        onNavigate={href => { if (href === '/') nav('home'); else if (href === '/?vue=explorer') nav('explore'); else if (href === '/?vue=carte') nav('map') }}
        account={user ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => nav('messages')}>Messages</button>
            <button className="nav-user" onClick={() => nav('dashboard')} title="Mon espace">
              <span className="nav-user-name">{profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
              <Avatar name={profile?.full_name || user.email} size={34} />
            </button>
          </>
        ) : undefined}
      />

      <main className="main">

      {/* ══ ACCUEIL ══ */}
      {page === 'home' && (
        <>
          <section className="hero">
            <img className="hero-bg" src={unsplash(HERO_PHOTO, 2000)} alt="" />
            <div className="hero-inner">
              <p className="eyebrow">Tables d’hôtes chez l’habitant</p>
              <h1 className="display">La table qui <span className="accent">rassemble</span> les cultures</h1>
              <p className="lead">Réservez une place chez un hôte près de chez vous. Cuisine maison, conversations, et des inconnus qui n’en sont plus à la fin du repas.</p>
              <form className="search" onSubmit={e => { e.preventDefault(); setAppliedCity(searchCity); nav('explore') }}>
                <label className="search-field">
                  <span>Ville</span>
                  <input value={searchCity} onChange={e => setSearchCity(e.target.value)} placeholder="Bordeaux, Paris…" aria-label="Ville" />
                </label>
                <label className="search-field">
                  <span>Cuisine</span>
                  <select value={filterCuisine} onChange={e => setFilterCuisine(e.target.value)} aria-label="Cuisine">
                    <option value="all">Toutes</option>
                    {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">Trouver une table</button>
              </form>
            </div>
          </section>

          <section className="section">
            <p className="eyebrow reveal">Par où commencer ?</p>
            <h2 className="title reveal">Que voulez-vous faire ?</h2>
            <div className="tiles">
              <button className="tile glass reveal" onClick={() => nav('explore')}>
                <span className="tile-icon"><Icon name="search" size={28} /></span>
                <h3>Je veux manger</h3>
                <p>Je cherche un repas fait maison près de chez moi et je réserve ma place.</p>
                <span className="tile-go">Voir les repas <Icon name="arrow" size={18} /></span>
              </button>
              <Tile href="/devenir-hote" icon="plate" title="Je veux cuisiner" text="Je reçois des invités chez moi, je fixe mon prix et je suis payé après le repas." go="Devenir hôte" delay={0.08} />
              <Tile href="/comment-ca-marche" icon="sparkle" title="Je veux comprendre" text="Comment ça marche, combien ça coûte, comment annuler : tout est expliqué simplement." go="Mode d’emploi" delay={0.16} />
            </div>
          </section>


          <section className="section">
            <p className="eyebrow reveal">Les règles en chiffres</p>
            <h2 className="title reveal">Simple et sans surprise</h2>
            <div className="cards">
              {([[Math.round(COMMISSION_RATE * 100), ' %', 'de commission prise par Shareat sur chaque place, pour le paiement sécurisé et le service client (taux provisoire).'], [FREE_CANCELLATION_HOURS, ' h', 'avant le repas : jusque-là, l’annulation est gratuite et remboursée en entier.'], [14, '', 'allergènes majeurs que chaque hôte doit déclarer pour chaque repas.'], [STUDENT_MAX_PRICE, ' €', 'maximum pour un repas étudiant. Bien manger, petit budget.']] as [number, string, string][]).map(([n, suf, d], i) => (
                <div key={d} className="info-card glass reveal" style={{ ['--d' as string]: `${i * 0.06}s` }}>
                  <Counter to={n} suffix={suf} />
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="split">
              <div className="reveal">
                <p className="eyebrow">Confiance</p>
                <h2 className="title">Vous êtes protégé</h2>
                <ul className="checklist">
                  {[['card', 'Paiement sécurisé par Stripe', 'Shareat ne voit jamais votre carte.'], ['map', 'Adresse cachée', 'Donnée seulement après la réservation.'], ['star', 'Avis vérifiés', 'Seuls les vrais invités peuvent noter.'], ['flag', 'Une équipe qui répond', 'Sous 24 h, tous les jours.']].map(([ic, t, d]) => (
                    <li key={t} className="done"><span className="tick"><Icon name={ic} size={15} /></span><div><strong>{t}</strong><small>{d}</small></div></li>
                  ))}
                </ul>
                <Link className="btn btn-ghost" href="/confiance-securite" style={{ marginTop: '1.2rem' }}>Tout savoir sur la sécurité <Icon name="arrow" size={18} /></Link>
              </div>
              <img className="reveal" style={{ ['--d' as string]: '0.1s' }} src={unsplash('1414235077428-338989a2e8c0', 1000)} alt="Une table dressée pour un repas partagé" />
            </div>
          </section>

          <section className="section">
            <div className="banner">
              <img src={unsplash(HOST_PHOTO, 1400)} alt="" />
              <div className="banner-txt">
                <p className="eyebrow">Hôtes</p>
                <h2 className="title">Ouvrez votre table</h2>
                <p>Fixez votre prix, vos dates et vos catégories. Vos gains vous sont virés automatiquement après chaque repas.</p>
                <button className="btn btn-primary" onClick={() => router.push('/devenir-hote')}>Devenir hôte</button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ══ EXPLORER ══ */}
      {page === 'explore' && (
        <section className="section">
          <p className="eyebrow">Explorer</p>
          <h1 className="title-xl">Toutes les tables</h1>
          {cityFilter}
          {filters}
          <Grid data={filtered} loading={mealsLoading} empty={emptyState} {...gridProps} />
        </section>
      )}

      {/* ══ CARTE ══ */}
      {page === 'map' && (
        <section className="section">
          <p className="eyebrow">Carte</p>
          <h1 className="title-xl">Les tables près de chez vous</h1>
          {cityFilter}
          {filters}
          <MealMap points={mapPoints} onSelect={openMealById} />
          <p className="muted small map-note">Les positions sont approximatives (environ 1 km) : l’adresse exacte est communiquée après la réservation.</p>
          {!mealsLoading && filtered.length > 0 && mapPoints.length < filtered.length && (
            <p className="muted small">{filtered.length - mapPoints.length} table(s) sans position ne sont pas affichées sur la carte.</p>
          )}
          <Grid data={filtered} loading={mealsLoading} empty={emptyState} {...gridProps} />
        </section>
      )}

      {/* ══ DÉTAIL ══ */}
      {page === 'detail' && selectedMeal && (
        <>
          <section className="detail-hero">
            <img src={mealPhoto(selectedMeal, 2000)} alt={selectedMeal.title} />
            <div className="detail-hero-txt">
              <button className="btn btn-glass btn-sm" onClick={goBack}>← Retour</button>
              <p className="eyebrow">{selectedMeal.cuisine} · {selectedMeal.city}</p>
              <h1 className="display display-sm">{selectedMeal.title}</h1>
            </div>
          </section>

          <section className="section detail">
            <div className="detail-main">
              <div className="facts">
                <div><span>Date</span><strong>{fmtDate(selectedMeal.date, true)}</strong></div>
                {selectedMeal.time && <div><span>Heure</span><strong>{fmtTime(selectedMeal.time)}</strong></div>}
                <div><span>Places</span><strong>{seatsLabel(selectedMeal.available_seats)}</strong></div>
                {(selectedMeal.rating || 0) > 0 && <div><span>Note</span><strong>★ {Number(selectedMeal.rating).toFixed(1)} ({selectedMeal.reviews_count ?? 0})</strong></div>}
              </div>

              {(selectedMeal.tags?.length || 0) > 0 && (
                <div className="tag-row tag-row-lg">{selectedMeal.tags!.map(t => <span key={t} className="tag">{t}</span>)}</div>
              )}

              {selectedMeal.description && <p className="prose">{selectedMeal.description}</p>}

              <div className="allergens">
                <span className="field-label">Allergènes</span>
                {selectedMeal.allergens == null
                  ? <p className="muted">Non renseignés : demandez à l’hôte avant de réserver.</p>
                  : selectedMeal.allergens.length === 0
                    ? <p>Aucun des 14 allergènes majeurs déclaré par l’hôte.</p>
                    : <div className="tag-row">{selectedMeal.allergens.map(a => <span key={a} className="tag tag-warn">{a}</span>)}</div>}
              </div>

              <div className="host-card">
                <Avatar name={selectedMeal.profiles?.full_name} size={52} />
                <div className="host-card-txt">
                  <p className="muted small">Votre hôte</p>
                  <p className="host-name">{selectedMeal.profiles?.full_name || 'Hôte'}</p>
                  {selectedMeal.profiles?.bio && <p className="muted small">{selectedMeal.profiles.bio}</p>}
                </div>
                {!isOwnMeal && (
                  <button className="btn btn-ghost btn-sm" onClick={() => openConversation({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name || 'Hôte' })}>Écrire à l’hôte</button>
                )}
              </div>

              {(selectedMeal.menu?.length || 0) > 0 && (
                <>
                  <h2 className="title">Au menu</h2>
                  <ul className="menu">
                    {selectedMeal.menu!.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </>
              )}

              <h2 className="title">Lieu</h2>
              {mealAddress
                ? <p className="address">{mealAddress}</p>
                : <p className="muted">{selectedMeal.city}. L’adresse exacte vous est communiquée après la réservation.</p>}
              {selectedMeal.lat != null && selectedMeal.lng != null && (
                <div className="detail-map">
                  <MealMap points={[{ id: selectedMeal.id, lat: selectedMeal.lat, lng: selectedMeal.lng, title: selectedMeal.title, label: '' }]} area height={280} />
                </div>
              )}

              <h2 className="title">Avis</h2>
              {mealReviews.length === 0
                ? <p className="muted">Pas encore d’avis pour cette table.</p>
                : mealReviews.map(r => (
                  <div key={r.id} className="review">
                    <Avatar name={r.profiles?.full_name} size={34} />
                    <div>
                      <p className="review-head"><strong>{r.profiles?.full_name || 'Invité'}</strong> <span className="stars">{stars(r.rating)}</span> <span className="muted small">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span></p>
                      {r.comment && <p className="muted">{r.comment}</p>}
                    </div>
                  </div>
                ))
              }
              <p className="muted small">Les avis sont publiés uniquement par des invités ayant réservé et payé ce repas, après sa date.</p>
              {!isHttpsUrl(selectedMeal.photo_url) && <p className="muted small">Photo d’illustration.</p>}
            </div>

            <aside className="book-card">
              <p className="book-price">{eur(displayPrice(selectedMeal.price_per_seat))} <small>/ couvert</small></p>
              {isOwnMeal ? (
                <p className="muted">C’est votre table. Suivez vos réservations depuis l’espace hôte.</p>
              ) : hasBooked ? (
                <p className="muted">Vous avez réservé cette table. Retrouvez-la dans vos réservations.</p>
              ) : soldOut ? (
                <p className="muted">Cette table est complète.</p>
              ) : (
                <>
                  <div className="stepper">
                    <span>Convives</span>
                    <div>
                      <button aria-label="Moins" disabled={guests <= 1} onClick={() => setGuests(g => Math.max(1, g - 1))}>−</button>
                      <strong>{guests}</strong>
                      <button aria-label="Plus" disabled={guests >= selectedMeal.available_seats} onClick={() => setGuests(g => Math.min(selectedMeal.available_seats, g + 1))}>+</button>
                    </div>
                  </div>
                  <div className="book-line"><span>{eur(displayPrice(selectedMeal.price_per_seat))} × {guests}</span><span>{eur(total)}</span></div>
                  <div className="book-line book-total"><span>Total</span><span>{eur(total)}</span></div>
                  <button className="btn btn-primary btn-block" onClick={startPayment} disabled={paying}>{paying ? 'Redirection vers le paiement…' : 'Réserver et payer'}</button>
                  <p className="muted small">Paiement sécurisé par Stripe. Annulation gratuite et remboursement intégral jusqu’à {FREE_CANCELLATION_HOURS} h avant le repas.</p>
                </>
              )}
            </aside>
          </section>
        </>
      )}

      {/* ══ MESSAGES ══ */}
      {page === 'messages' && (
        <section className="section narrow">
          <p className="eyebrow">Messagerie</p>
          <h1 className="title-xl">Messages</h1>
          {!user ? (
            <div className="panel center">
              <p className="muted">Connectez-vous pour accéder à vos messages.</p>
              <button className="btn btn-primary" onClick={() => requireAuth()}>Se connecter</button>
            </div>
          ) : (
            <div className={`msg-layout${conversations.length > 0 ? ' with-list' : ''}`}>
              {conversations.length > 0 && (
                <div className="panel conv-list">
                  {conversations.map(c => (
                    <button key={c.id} className={`conv${selectedConvUser?.id === c.id ? ' on' : ''}`}
                      onClick={() => { if (c.id !== selectedConvUser?.id) { setMessages([]); setSelectedConvUser({ id: c.id, name: c.name }) } }}>
                      <Avatar name={c.name} size={36} />
                      <span className="conv-txt"><strong>{c.name}</strong><span>{c.lastMsg}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <div className="panel chat">
                {selectedConvUser ? (
                  <>
                    <div className="chat-head"><Avatar name={selectedConvUser.name} size={36} /><strong>{selectedConvUser.name}</strong></div>
                    <div ref={bubblesRef} className="bubbles">
                      {messages.length === 0 && <p className="muted center">Aucun message pour l’instant.</p>}
                      {messages.map(msg => (
                        <div key={msg.id} className={`bubble${msg.sender_id === user.id ? ' me' : ''}`}>{msg.content}</div>
                      ))}
                    </div>
                    <form className="chat-input" onSubmit={e => { e.preventDefault(); sendMessage() }}>
                      <input className="input input-pill" value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Écrivez un message…" aria-label="Message" maxLength={2000} />
                      <button type="submit" className="btn btn-primary" disabled={sending || !msgInput.trim()}>Envoyer</button>
                    </form>
                  </>
                ) : (
                  <p className="muted center chat-empty">Choisissez une conversation, ou écrivez à un hôte depuis la page d’une table.</p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══ TABLEAU DE BORD ══ */}
      {page === 'dashboard' && (
        <section className="section">
          {!user ? (
            <div className="panel center">
              <p className="muted">Connectez-vous pour accéder à votre espace.</p>
              <button className="btn btn-primary" onClick={() => requireAuth()}>Se connecter</button>
            </div>
          ) : (
            <div className="dash">
              <aside className="panel dash-side">
                <div className="dash-id">
                  <Avatar name={profile?.full_name || user.email} size={56} />
                  <strong>{profile?.full_name || user.email}</strong>
                </div>
                {dashTabs.map(([id, label]) => (
                  <button key={id} className={`dash-tab${dashTab === id ? ' on' : ''}`} onClick={() => setDashTab(id)}>{label}</button>
                ))}
                <button className="dash-tab danger" onClick={doLogout}>Déconnexion</button>
              </aside>

              <div className="panel dash-body">
                {dashTab === 'overview' && (
                  <>
                    <h2 className="title">Bonjour {profile?.full_name?.split(' ')[0] || ''}</h2>
                    <div className="stats">
                      {[[bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length, 'Réservations'], [favMeals.length, 'Favoris'], [meals.length, 'Tables à venir']].map(([v, l]) => (
                        <div key={l} className="stat"><strong>{v}</strong><span>{l}</span></div>
                      ))}
                    </div>
                    <h3 className="subtitle">Prochaines tables</h3>
                    <Grid data={meals.slice(0, 3)} loading={mealsLoading} empty={emptyState} {...gridProps} />
                  </>
                )}

                {dashTab === 'bookings' && (
                  <>
                    <h2 className="title">Mes réservations</h2>
                    {bookings.length === 0
                      ? <div className="empty"><p>Aucune réservation pour l’instant.</p><button className="btn btn-primary" onClick={() => nav('explore')}>Explorer les tables</button></div>
                      : bookings.map(b => {
                        const past = b.status === 'completed' || (b.meals ? b.meals.date.slice(0, 10) <= todayParis() : false)
                        const canCancel = b.status === 'confirmed' && b.meals && hoursUntil(b.meals) >= FREE_CANCELLATION_HOURS
                        const canReview = (b.status === 'confirmed' || b.status === 'completed') && past && !reviewedIds.has(b.id)
                        return (
                          <div key={b.id} className="booking">
                            {b.meals && <img src={mealPhoto(b.meals, 300)} alt="" onClick={() => openMeal(b.meals!)} />}
                            <div className="booking-txt">
                              <strong>{b.meals?.title || 'Table supprimée'}</strong>
                              <span className="muted small">{b.meals ? `${b.meals.city} · ${fmtDate(b.meals.date)} à ${fmtTime(b.meals.time)} · ` : ''}{b.seats} couvert{b.seats > 1 ? 's' : ''} · {eur(b.total_amount)} payés</span>
                              {b.status === 'cancelled' && (b.refunded_amount || 0) > 0 && <span className="muted small">Remboursé : {eur(b.refunded_amount!)}</span>}
                              <span className="row-actions">
                                {canCancel && <button className="link" onClick={() => setConfirmAction({ kind: 'booking', id: b.id, title: b.meals?.title || '', refundable: true })}>Annuler</button>}
                                {canReview && <button className="link" onClick={() => { setReviewFor(b); setReviewRating(5); setReviewComment('') }}>Laisser un avis</button>}
                                {b.meals && !past && <button className="link" onClick={() => openConversation({ id: b.meals!.host_id, name: b.meals!.profiles?.full_name || 'Hôte' })}>Écrire à l’hôte</button>}
                              </span>
                            </div>
                            <span className={`status status-${b.status}`}>
                              {b.status === 'confirmed' ? (past ? 'Passée' : 'Confirmée') : b.status === 'cancelled' ? 'Annulée' : 'Terminée'}
                            </span>
                          </div>
                        )
                      })
                    }
                  </>
                )}

                {dashTab === 'favorites' && (
                  <>
                    <h2 className="title">Mes favoris</h2>
                    <Grid data={favMeals} empty={<p>Aucun favori pour l’instant.</p>} {...gridProps} />
                  </>
                )}

                {dashTab === 'profile' && (
                  <form onSubmit={e => { e.preventDefault(); saveProfile() }}>
                    <h2 className="title">Mon profil</h2>
                    <div className="two-col">
                      <Inp label="Prénom" placeholder="Prénom" value={profileFname} onChange={setProfileFname} autoComplete="given-name" />
                      <Inp label="Nom" placeholder="Nom" value={profileLname} onChange={setProfileLname} autoComplete="family-name" />
                    </div>
                    <Inp label="Email" placeholder="Email" value={user.email || ''} type="email" readOnly />
                    <Inp label="Ville" placeholder="Ville" value={profileCity} onChange={setProfileCity} />
                    <label className="field">
                      <span className="field-label">À propos de vous</span>
                      <textarea className="input" value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Vos passions culinaires, d’où vous venez…" rows={3} aria-label="Bio" />
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={loading}>Enregistrer</button>
                    <p className="muted small form-note">Pour exporter vos données ou supprimer votre compte, consultez la <Link className="inline-link" href="/confidentialite">politique de confidentialité</Link>.</p>
                  </form>
                )}

                {dashTab === 'host' && (
                  <>
                    <h2 className="title">Espace hôte</h2>

                    <div className={`payout-card${payouts?.active ? ' ok' : ''}`}>
                      <div>
                        <p className="subtitle payout-title">Versements</p>
                        {payouts?.active
                          ? <p>Vos versements sont activés. Vos gains sont virés {TRANSFER_DELAY_HOURS} h après chaque repas ; Shareat prend une commission de {Math.round(COMMISSION_RATE * 100)} % (taux provisoire).</p>
                          : <p>Pour publier une table et être payé, reliez un compte de versement Stripe (identité et IBAN). Cela prend environ 5 minutes.</p>}
                      </div>
                      {payouts?.active
                        ? <button className="btn btn-ghost" onClick={openPayoutsDashboard} disabled={payoutsBusy}>Voir mes versements</button>
                        : <button className="btn btn-primary" onClick={startPayoutsOnboarding} disabled={payoutsBusy}>{payoutsBusy ? 'Redirection…' : payouts?.configured ? 'Terminer mon inscription' : 'Activer mes versements'}</button>}
                    </div>

                    <div className="stats">
                      {[[hostMeals.length, 'Tables publiées'], [hostBookings.reduce((s, b) => s + b.seats, 0), 'Invités confirmés'], [eur(hostEarned), 'Vos gains'], [profile?.rating ? `★ ${Number(profile.rating).toFixed(1)}` : '—', 'Note hôte']].map(([v, l]) => (
                        <div key={l} className="stat"><strong>{v}</strong><span>{l}</span></div>
                      ))}
                    </div>

                    {hostMeals.length > 0 && (
                      <>
                        <h3 className="subtitle">Mes tables</h3>
                        {hostMeals.map(m => {
                          const booked = hostSeatsBooked(m.id)
                          const upcoming = m.is_active && m.date.slice(0, 10) >= todayParis()
                          return (
                            <div key={m.id} className="booking">
                              <img src={mealPhoto(m, 300)} alt="" />
                              <div className="booking-txt">
                                <strong>{m.title}</strong>
                                <span className="muted small">{m.city} · {fmtDate(m.date)} à {fmtTime(m.time)} · {booked} / {m.max_seats ?? m.available_seats + booked} places réservées</span>
                                {upcoming && (
                                  <span className="row-actions">
                                    <button className="link" onClick={() => openMeal(m)}>Voir</button>
                                    <button className="link danger-link" onClick={() => setConfirmAction({ kind: 'meal', id: m.id, title: m.title, guests: booked })}>Annuler la table</button>
                                  </span>
                                )}
                              </div>
                              <span className={`status ${upcoming ? 'status-confirmed' : m.is_active ? 'status-completed' : 'status-cancelled'}`}>{upcoming ? 'En ligne' : m.is_active ? 'Passée' : 'Annulée'}</span>
                            </div>
                          )
                        })}
                      </>
                    )}

                    <form onSubmit={e => { e.preventDefault(); publishMeal() }}>
                      <h3 className="subtitle">Proposer une table</h3>
                      <fieldset className="fieldset" disabled={!payouts?.active}>
                        <Inp label="Titre *" placeholder="Couscous du dimanche" value={hostTitle} onChange={setHostTitle} maxLength={120} />
                        <div className="two-col">
                          <label className="field">
                            <span className="field-label">Cuisine</span>
                            <select className="input" value={hostCuisine} onChange={e => setHostCuisine(e.target.value)} aria-label="Cuisine">
                              {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </label>
                          <Inp label="Votre prix par couvert (€) *" placeholder="20" value={hostPrice} onChange={setHostPrice} type="number" min="1" inputMode="decimal"
                            hint={<>
                              {pricePreview != null && <>Vous recevez {eur(priceNum)} par couvert. Prix affiché aux invités : {eur(pricePreview)} (commission Shareat {Math.round(COMMISSION_RATE * 100)} %).</>}
                              {hostTags.includes('Repas étudiant') && <> Repas étudiant : {eur(STUDENT_MAX_HOST_PRICE)} maximum ({STUDENT_MAX_PRICE} € pour l’invité).</>}
                            </>} />
                        </div>

                        <div className="field">
                          <span className="field-label">Catégories (plusieurs possibles)</span>
                          <div className="chips chips-wrap" role="group" aria-label="Catégories du repas">
                            {CATEGORIES.map(t => (
                              <button type="button" key={t} aria-pressed={hostTags.includes(t)} className={`chip chip-soft${hostTags.includes(t) ? ' on' : ''}`}
                                onClick={() => setHostTags(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))}>{t}</button>
                            ))}
                          </div>
                        </div>

                        <div className="field">
                          <span className="field-label">Adresse du repas *</span>
                          <div className="address-row">
                            <input className="input" value={hostAddress} onChange={e => { setHostAddress(e.target.value); setAddressPick(null); setAddressMatches([]) }}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchAddress() } }}
                              placeholder="12 rue des Lilas, 33000 Bordeaux" aria-label="Adresse du repas" autoComplete="street-address" />
                            <button type="button" className="btn btn-ghost" onClick={searchAddress} disabled={addressBusy || hostAddress.trim().length < 5}>{addressBusy ? 'Recherche…' : 'Vérifier'}</button>
                          </div>
                          {addressMatches.length > 1 && (
                            <div className="address-matches">
                              {addressMatches.map(r => (
                                <button type="button" key={r.label + r.lat} className="address-match" onClick={() => { setAddressPick(r); setHostAddress(r.label); setAddressMatches([]) }}>{r.label}</button>
                              ))}
                            </div>
                          )}
                          {addressPick
                            ? <span className="field-hint ok-hint">Adresse vérifiée : {addressPick.label}. Seule une zone d’environ 1 km est affichée publiquement ; l’adresse exacte est envoyée aux invités après paiement.</span>
                            : <span className="field-hint">L’adresse exacte reste privée jusqu’à la réservation.</span>}
                        </div>

                        <div className="two-col">
                          <Inp label="Date *" placeholder="Date" value={hostDate} onChange={setHostDate} type="date" min={todayParis()} />
                          <Inp label="Heure" placeholder="Heure" value={hostTime} onChange={setHostTime} type="time" />
                        </div>
                        <Inp label="Nombre de couverts *" placeholder="6" value={hostSeats} onChange={setHostSeats} type="number" min="1" inputMode="numeric" />
                        <div className="field">
                          <span className="field-label">Allergènes présents * (14 allergènes majeurs)</span>
                          <div className="chips chips-wrap" role="group" aria-label="Allergènes">
                            {ALLERGENS.map(a => (
                              <button type="button" key={a} aria-pressed={hostAllergens.includes(a)} disabled={noAllergens} className={`chip chip-soft${hostAllergens.includes(a) ? ' on' : ''}`}
                                onClick={() => setHostAllergens(prev => (prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]))}>{a}</button>
                            ))}
                          </div>
                          <label className="check check-tight">
                            <input type="checkbox" checked={noAllergens} onChange={e => { setNoAllergens(e.target.checked); if (e.target.checked) setHostAllergens([]) }} />
                            <span>Ce repas ne contient aucun de ces 14 allergènes</span>
                          </label>
                        </div>

                        <div className="field">
                          <span className="field-label">Photo de votre plat (facultatif)</span>
                          {hostPhoto ? (
                            <div className="photo-preview">
                              <img src={hostPhoto} alt="Aperçu de la photo" />
                              <button type="button" className="link danger-link" onClick={() => setHostPhoto('')}>Retirer la photo</button>
                            </div>
                          ) : (
                            <label className={`btn btn-ghost photo-btn${photoBusy ? ' busy' : ''}`}>
                              {photoBusy ? 'Envoi en cours…' : 'Prendre ou choisir une photo'}
                              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => { uploadPhoto(e.target.files?.[0]); e.target.value = '' }} />
                            </label>
                          )}
                          <span className="field-hint">Sans photo, une image d’illustration de la cuisine choisie est affichée.</span>
                        </div>
                        <label className="field">
                          <span className="field-label">Description</span>
                          <textarea className="input" value={hostDesc} onChange={e => setHostDesc(e.target.value)} placeholder="L’ambiance, l’histoire du plat…" rows={3} aria-label="Description" />
                        </label>
                        <label className="field">
                          <span className="field-label">Menu (un plat par ligne)</span>
                          <textarea className="input" value={hostMenu} onChange={e => setHostMenu(e.target.value)} placeholder={'Entrée : salade de saison\nPlat : couscous\nDessert : cornes de gazelle'} rows={4} aria-label="Menu" />
                        </label>
                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Publication…' : 'Publier ma table'}</button>
                      </fieldset>
                      {!payouts?.active && <p className="muted small form-note">Le formulaire s’active une fois vos versements configurés.</p>}
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ══ DEVENIR HÔTE ══ */}
      {page === 'become' && (
        <>
          <section className="hero hero-sm">
            <img className="hero-bg" src={unsplash(HOST_PHOTO, 2000)} alt="" />
            <div className="hero-inner">
              <p className="eyebrow">Devenir hôte</p>
              <h1 className="display">Partagez votre <span className="accent">table</span></h1>
              <p className="lead">Recevez chez vous des personnes curieuses de votre cuisine et de votre histoire.</p>
            </div>
          </section>
          <section className="section">
            <div className="steps">
              {[['01', 'Vous fixez votre prix', `Vos gains sont virés ${TRANSFER_DELAY_HOURS} h après le repas sur votre compte bancaire via Stripe. Shareat prend une commission de ${Math.round(COMMISSION_RATE * 100)} % (taux provisoire).`],
                ['02', 'Vous choisissez date et catégories', 'Une date, un nombre de couverts, et les catégories qui décrivent votre repas : repas étudiant, halal, casher, végétarien…'],
                ['03', 'Vous échangez avant', 'Vos invités peuvent vous écrire avant de réserver. Votre adresse exacte n’est communiquée qu’après le paiement.']].map(([n, t, d]) => (
                <div key={n} className="step">
                  <span className="step-num">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="center">
              <button className="btn btn-primary" onClick={() => { if (user) { setDashTab('host'); nav('dashboard') } else { setAuthMode('signup'); setShowAuth(true) } }}>
                {user ? 'Proposer une table' : 'Créer mon compte hôte'}
              </button>
              <p className="muted small form-note">En publiant, vous vous engagez à respecter les <Link className="inline-link" href="/conditions">conditions d’utilisation</Link> (hygiène, allergènes, déclaration de vos revenus).</p>
            </div>
          </section>
        </>
      )}

      </main>

      {/* ══ CONNEXION ══ */}
      {showAuth && !user && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Connexion">
            <button className="modal-close" onClick={() => setShowAuth(false)} aria-label="Fermer">×</button>
            <p className="logo logo-static">Shareat</p>
            <div className="seg">
              {(['login', 'signup'] as const).map(t => (
                <button key={t} className={authMode === t ? 'on' : ''} onClick={() => setAuthMode(t)}>{t === 'login' ? 'Connexion' : 'Inscription'}</button>
              ))}
            </div>
            {authMode === 'login' ? (
              <form onSubmit={e => { e.preventDefault(); doLogin() }}>
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                <Inp placeholder="Mot de passe" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); doSignup() }}>
                <Inp placeholder="Prénom et nom" value={fullName} onChange={setFullName} autoComplete="name" />
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                <Inp placeholder="Mot de passe (8 caractères minimum)" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
                <label className="check">
                  <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} />
                  <span>J’ai 18 ans ou plus et j’accepte les <Link className="inline-link" href="/conditions" target="_blank">conditions d’utilisation</Link> et la <Link className="inline-link" href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span>
                </label>
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ RÉSULTAT DU PAIEMENT ══ */}
      {bookingResult && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) setBookingResult(null) }}>
          <div className="modal center" role="dialog" aria-modal="true" aria-label="Réservation">
            <button className="modal-close" onClick={() => setBookingResult(null)} aria-label="Fermer">×</button>
            {bookingResult.status === 'confirmed' ? (
              <>
                <p className="eyebrow">Paiement accepté</p>
                <h2 className="title">À table !</h2>
                <p className="muted">
                  {bookingResult.meal
                    ? <>Votre place chez <strong>{bookingResult.meal.profiles?.full_name || 'votre hôte'}</strong> est réservée pour <strong>{bookingResult.seats} couvert{bookingResult.seats > 1 ? 's' : ''}</strong>, {fmtDate(bookingResult.meal.date, true)} à {fmtTime(bookingResult.meal.time)}.</>
                    : <>Votre réservation est confirmée.</>}
                </p>
                <p className="muted small">L’adresse exacte est visible sur la page du repas et dans l’email de confirmation. Un rappel vous sera envoyé la veille.</p>
                <div className="row-btns">
                  {bookingResult.meal && <button className="btn btn-primary" onClick={() => { const m = bookingResult.meal!; setBookingResult(null); openMeal(m) }}>Voir le repas et l’adresse</button>}
                  <button className="btn btn-ghost" onClick={() => { setBookingResult(null); setDashTab('bookings'); nav('dashboard') }}>Mes réservations</button>
                </div>
              </>
            ) : bookingResult.status === 'refunded' ? (
              <>
                <p className="eyebrow">Table complète</p>
                <h2 className="title">Désolé</h2>
                <p className="muted">La dernière place a été prise pendant votre paiement. Vous êtes intégralement remboursé (sous 5 à 10 jours selon votre banque).</p>
                <div className="row-btns"><button className="btn btn-primary" onClick={() => { setBookingResult(null); nav('explore') }}>Voir d’autres tables</button></div>
              </>
            ) : (
              <>
                <p className="eyebrow">Paiement en cours</p>
                <h2 className="title">Presque fini</h2>
                <p className="muted">Votre paiement est en cours de validation par votre banque. La réservation apparaîtra dans votre espace dès sa confirmation.</p>
                <div className="row-btns"><button className="btn btn-primary" onClick={() => setBookingResult(null)}>D’accord</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ CONFIRMATION D'ANNULATION ══ */}
      {confirmAction && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget && !loading) setConfirmAction(null) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Confirmer l’annulation">
            <button className="modal-close" onClick={() => { if (!loading) setConfirmAction(null) }} aria-label="Fermer">×</button>
            <h2 className="title">{confirmAction.kind === 'booking' ? 'Annuler la réservation ?' : 'Annuler la table ?'}</h2>
            <p className="muted">
              {confirmAction.kind === 'booking'
                ? <>Votre réservation pour « {confirmAction.title} » sera annulée et intégralement remboursée.</>
                : <>« {confirmAction.title} » sera retirée du site.{confirmAction.guests > 0 ? ` Les ${confirmAction.guests} invité(s) déjà inscrits seront intégralement remboursés.` : ''}</>}
            </p>
            <div className="row-btns">
              <button className="btn btn-ghost" onClick={() => setConfirmAction(null)} disabled={loading}>Garder</button>
              <button className="btn btn-danger" onClick={runConfirmAction} disabled={loading}>{loading ? 'Annulation…' : 'Confirmer l’annulation'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ AVIS ══ */}
      {reviewFor && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget && !loading) setReviewFor(null) }}>
          <form className="modal" role="dialog" aria-modal="true" aria-label="Laisser un avis" onSubmit={e => { e.preventDefault(); submitReview() }}>
            <button type="button" className="modal-close" onClick={() => setReviewFor(null)} aria-label="Fermer">×</button>
            <h2 className="title">Votre avis</h2>
            <p className="muted">{reviewFor.meals?.title} chez {reviewFor.meals?.profiles?.full_name || 'votre hôte'}</p>
            <div className="star-picker" role="radiogroup" aria-label="Note">
              {[1, 2, 3, 4, 5].map(n => (
                <button type="button" key={n} role="radio" aria-checked={reviewRating === n} aria-label={`${n} sur 5`} className={n <= reviewRating ? 'on' : ''} onClick={() => setReviewRating(n)}>★</button>
              ))}
            </div>
            <textarea className="input" rows={4} value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Racontez votre soirée…" maxLength={1000} aria-label="Commentaire" />
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Envoi…' : 'Publier mon avis'}</button>
          </form>
        </div>
      )}

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}

      <Footer />
    </div>
  )
}
