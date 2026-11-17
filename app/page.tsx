'use client'
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

// ═════════════════════════════ TYPES ═════════════════════════════

type HostInfo = {
  full_name: string | null
  avatar_url?: string | null
  rating?: number | null
  bio?: string | null
}

type Profile = HostInfo & {
  id: string
  city?: string | null
}

type Meal = {
  id: string
  title: string
  cuisine: string
  price_per_seat: number
  available_seats: number
  date: string
  time: string
  city: string
  menu: string[] | null
  tags: string[] | null
  photo_url: string | null
  rating: number | null
  reviews_count: number | null
  description: string | null
  host_id: string
  profiles: HostInfo | null
}

type Message = {
  id: string
  content: string
  sender_id: string
  receiver_id: string
  created_at: string
}

type Booking = {
  id: string
  meal_id: string
  seats: number
  total_amount: number
  status: string
  created_at: string
  meals: Meal | null
}

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  profiles: { full_name: string | null } | null
}

type ConvUser = { id: string; name: string }
type Conversation = ConvUser & { lastMsg: string }

type Page = 'home' | 'explore' | 'detail' | 'messages' | 'dashboard' | 'become'
type DashTab = 'overview' | 'bookings' | 'favorites' | 'profile' | 'host'

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
const CUISINES = Object.keys(cuisinePhotos)

const isHttpsUrl = (v?: string | null) => Boolean(v && /^https:\/\/\S+$/i.test(v.trim()))
const mealPhoto = (m: Pick<Meal, 'photo_url' | 'cuisine'>, w = 900) =>
  isHttpsUrl(m.photo_url) ? m.photo_url!.trim() : unsplash(cuisinePhotos[m.cuisine] || cuisinePhotos.Autre, w)

const avatarTones = ['#A7C7E7', '#8FB3DA', '#C3D7EE', '#7FA3CC', '#B5C9E6', '#9BB8DD']
const tone = (name?: string | null) => avatarTones[(name?.charCodeAt(0) || 0) % avatarTones.length]
const initial = (name?: string | null) => (name || '?').trim().charAt(0).toUpperCase() || '?'

/** Arrondi au centime. */
const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100
/** Affichage d'un montant : 12 → "12 €", 12.5 → "12,50 €". */
const eur = (n: number) => {
  const v = money(n)
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + ' €'
}

/** Date du jour au format AAAA-MM-JJ (heure locale). */
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

// ═════════════════════════════ DATA ═════════════════════════════

async function fetchMeals(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, profiles(full_name, avatar_url, rating, bio)')
    .eq('is_active', true)
    .order('date', { ascending: true })
  if (error) throw error
  const today = todayISO()
  // On masque les repas déjà passés.
  return ((data || []) as Meal[]).filter(m => !m.date || m.date.slice(0, 10) >= today)
}

async function fetchProfile(user: User): Promise<Profile | null> {
  // Le profil est créé automatiquement par la base à l'inscription.
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return (data as Profile | null) || null
}

async function fetchBookings(uid: string): Promise<Booking[]> {
  const { data } = await supabase.from('bookings')
    .select('*, meals(*, profiles(full_name))')
    .eq('guest_id', uid)
    .order('created_at', { ascending: false })
  return (data || []) as Booking[]
}

async function fetchFavorites(uid: string): Promise<Meal[]> {
  const { data } = await supabase.from('favorites')
    .select('meal_id, meals(*, profiles(full_name, avatar_url, rating, bio))')
    .eq('user_id', uid)
  return ((data || []) as unknown as { meals: Meal | null }[]).map(f => f.meals).filter((m): m is Meal => Boolean(m))
}

async function fetchReviews(mealId: string): Promise<Review[]> {
  const { data } = await supabase.from('reviews')
    .select('*, profiles!reviews_reviewer_id_fkey(full_name)')
    .eq('meal_id', mealId)
    .order('created_at', { ascending: false })
  return (data || []) as Review[]
}

async function fetchHostStats(uid: string) {
  const { data: hostMeals } = await supabase.from('meals').select('id').eq('host_id', uid)
  const ids = (hostMeals || []).map((m: { id: string }) => m.id)
  let revenue = 0
  let guests = 0
  if (ids.length > 0) {
    // Uniquement les réservations des repas de CET hôte.
    const { data: hostBookings } = await supabase.from('bookings')
      .select('total_amount, seats')
      .in('meal_id', ids)
      .eq('status', 'confirmed')
    ;(hostBookings || []).forEach((b: { total_amount: number | null; seats: number | null }) => {
      revenue += Number(b.total_amount) || 0
      guests += Number(b.seats) || 0
    })
  }
  const { data: hostProfile } = await supabase.from('profiles').select('rating').eq('id', uid).maybeSingle()
  return { meals: ids.length, revenue: money(revenue), guests, rating: Number(hostProfile?.rating) || 0 }
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
}

const Inp = ({ placeholder, value, onChange, type = 'text', readOnly, min, maxLength, inputMode, autoComplete, label }: InpProps) => (
  <label className="field">
    {label && <span className="field-label">{label}</span>}
    <input className="input" type={type} placeholder={placeholder} aria-label={label || placeholder} value={value} readOnly={readOnly}
      min={min} maxLength={maxLength} inputMode={inputMode} autoComplete={autoComplete}
      onChange={e => onChange?.(e.target.value)} />
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
  <article className="meal-card" onClick={() => onOpen(m)}>
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
      <div className="meal-foot">
        <span className="meal-cuisine">{m.cuisine}</span>
        <span className="meal-price">{eur(m.price_per_seat)} <small>/ couvert</small></span>
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
  const [page, setPage] = useState<Page>('home')
  const [prevPage, setPrevPage] = useState<Page>('home')
  const [meals, setMeals] = useState<Meal[]>([])
  const [mealsLoading, setMealsLoading] = useState(true)
  const [mealsError, setMealsError] = useState('')
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [mealReviews, setMealReviews] = useState<Review[]>([])
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [guests, setGuests] = useState(1)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [showAuth, setShowAuth] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [bookingDone, setBookingDone] = useState(false)
  const [bookedSeats, setBookedSeats] = useState(0)
  const [toastMsg, setToastMsg] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [filterCuisine, setFilterCuisine] = useState('all')
  const [searchCity, setSearchCity] = useState('')
  const [appliedCity, setAppliedCity] = useState('')
  const [dashTab, setDashTab] = useState<DashTab>('overview')
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [favMeals, setFavMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(false)
  const [hostTitle, setHostTitle] = useState('')
  const [hostCuisine, setHostCuisine] = useState('Française')
  const [hostPrice, setHostPrice] = useState('')
  const [hostDate, setHostDate] = useState('')
  const [hostTime, setHostTime] = useState('19:30')
  const [hostSeats, setHostSeats] = useState('')
  const [hostDesc, setHostDesc] = useState('')
  const [hostCity, setHostCity] = useState('')
  const [hostMenu, setHostMenu] = useState('')
  const [hostPhoto, setHostPhoto] = useState('')
  const [profileFname, setProfileFname] = useState('')
  const [profileLname, setProfileLname] = useState('')
  const [profileCity, setProfileCity] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [hostStats, setHostStats] = useState({ meals: 0, revenue: 0, guests: 0, rating: 0 })
  const [selectedConvUser, setSelectedConvUser] = useState<ConvUser | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const bubblesRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = user?.id ?? null

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastMsg(msg)
    toastTimer.current = setTimeout(() => setToastMsg(''), 3500)
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

  // ── EFFETS ──

  // Chargement initial des repas.
  useEffect(() => {
    let cancelled = false
    fetchMeals()
      .then(data => { if (!cancelled) setMeals(data) })
      .catch(() => { if (!cancelled) setMealsError(supabaseConfigured ? 'Impossible de charger les tables.' : 'Supabase n’est pas configuré (variables d’environnement manquantes).') })
      .finally(() => { if (!cancelled) setMealsLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Session utilisateur.
  useEffect(() => {
    const handle = (session: Session | null) => {
      const u = session?.user ?? null
      setUser(prev => (prev?.id === u?.id ? (u ? prev : null) : u))
      if (u) setShowAuth(false)
      else {
        setProfile(null); setBookings([]); setFavMeals([]); setConversations([])
        setMessages([]); setSelectedConvUser(null)
      }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => handle(session))
    return () => subscription.unsubscribe()
  }, [])

  // Profil + favoris dès qu'un utilisateur est connecté.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchProfile(user).then(p => {
      if (cancelled || !p) return
      setProfile(p)
      const parts = (p.full_name || '').trim().split(/\s+/)
      setProfileFname(parts[0] || '')
      setProfileLname(parts.slice(1).join(' '))
      setProfileCity(p.city || '')
      setProfileBio(p.bio || '')
    })
    fetchFavorites(user.id).then(f => { if (!cancelled) setFavMeals(f) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Données du tableau de bord.
  useEffect(() => {
    if (page !== 'dashboard' || !userId) return
    let cancelled = false
    fetchBookings(userId).then(b => { if (!cancelled) setBookings(b) })
    fetchFavorites(userId).then(f => { if (!cancelled) setFavMeals(f) })
    if (dashTab === 'host') fetchHostStats(userId).then(st => { if (!cancelled) setHostStats(st) })
    return () => { cancelled = true }
  }, [page, dashTab, userId])

  // Liste des conversations.
  useEffect(() => {
    if (page !== 'messages' || !userId) return
    let cancelled = false
    fetchConversations(userId).then(c => { if (!cancelled) setConversations(c) })
    return () => { cancelled = true }
  }, [page, userId])

  // Messages de la conversation ouverte + temps réel (un seul abonnement, nettoyé).
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

  // Défilement automatique en bas de la conversation.
  useEffect(() => {
    if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight
  }, [messages])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  // ── DÉRIVÉS ──

  const filtered = useMemo(() => {
    let r = meals
    if (filterCuisine !== 'all') r = r.filter(m => m.cuisine === filterCuisine)
    const city = appliedCity.trim().toLowerCase()
    if (city) r = r.filter(m => m.city?.toLowerCase().includes(city))
    return r
  }, [meals, filterCuisine, appliedCity])

  const favIds = useMemo(() => new Set(favMeals.map(m => m.id)), [favMeals])

  const total = selectedMeal ? money(selectedMeal.price_per_seat * guests) : 0
  const isOwnMeal = Boolean(selectedMeal && user && selectedMeal.host_id === user.id)
  const soldOut = Boolean(selectedMeal && selectedMeal.available_seats <= 0)

  // ── ACTIONS ──

  const openMeal = (m: Meal) => {
    setSelectedMeal(m)
    setGuests(1)
    setMealReviews([])
    fetchReviews(m.id).then(setMealReviews)
    nav('detail')
  }

  const openConversation = (other: ConvUser) => {
    if (!user) { requireAuth('Connectez-vous pour envoyer un message'); return }
    if (other.id === user.id) { showToast('C’est votre propre table'); return }
    if (other.id !== selectedConvUser?.id) setMessages([])
    setSelectedConvUser(other)
    nav('messages')
  }

  const resetFilters = () => { setFilterCuisine('all'); setSearchCity(''); setAppliedCity('') }

  const doLogin = async () => {
    if (!email.trim() || !password) { showToast('Email et mot de passe requis'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { showToast(error.message); return }
    setShowAuth(false)
    showToast('Bienvenue')
    setEmail(''); setPassword('')
  }

  const doSignup = async () => {
    if (!fullName.trim()) { showToast('Indiquez votre prénom et votre nom'); return }
    if (!email.trim()) { showToast('Indiquez votre email'); return }
    if (password.length < 8) { showToast('Mot de passe trop court (8 caractères minimum)'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } })
    setLoading(false)
    if (error) { showToast(error.message); return }
    setShowAuth(false)
    showToast(data.session ? 'Compte créé, bienvenue' : 'Compte créé. Confirmez votre adresse depuis l’email reçu.')
    setEmail(''); setPassword(''); setFullName('')
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    nav('home')
    setDashTab('overview')
    showToast('À bientôt')
  }

  const openBooking = () => {
    if (!user) { requireAuth('Connectez-vous pour réserver'); return }
    if (isOwnMeal) { showToast('Vous ne pouvez pas réserver votre propre table'); return }
    if (soldOut) { showToast('Cette table est complète'); return }
    setBookingDone(false)
    setShowBooking(true)
  }

  const createBooking = async () => {
    if (!user || !selectedMeal) return
    setLoading(true)
    // On revérifie les places restantes juste avant de réserver.
    const { data: fresh } = await supabase.from('meals').select('available_seats').eq('id', selectedMeal.id).maybeSingle()
    const seatsLeft = fresh ? Number(fresh.available_seats) : selectedMeal.available_seats
    if (seatsLeft < guests) {
      setLoading(false)
      showToast(seatsLeft > 0 ? `Plus que ${seatsLeft} place(s) disponible(s)` : 'Cette table est complète')
      setSelectedMeal({ ...selectedMeal, available_seats: Math.max(0, seatsLeft) })
      setGuests(g => Math.max(1, Math.min(g, seatsLeft)))
      return
    }
    const { error } = await supabase.from('bookings').insert({
      meal_id: selectedMeal.id,
      guest_id: user.id,
      seats: guests,
      total_amount: total,
      status: 'confirmed'
    })
    setLoading(false)
    if (error) {
      showToast(/places/i.test(error.message) ? 'Plus assez de places disponibles' : 'Erreur : ' + error.message)
      return
    }
    // Les places restantes sont décrémentées par la base (trigger).
    setBookedSeats(guests)
    setSelectedMeal({ ...selectedMeal, available_seats: seatsLeft - guests })
    setGuests(1)
    setBookingDone(true)
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
      if (error) {
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
  }

  const publishMeal = async () => {
    if (!user) { requireAuth(); return }
    if (!hostTitle.trim() || !hostPrice || !hostDate || !hostSeats || !hostCity.trim()) {
      showToast('Remplissez tous les champs obligatoires'); return
    }
    const price = parseFloat(hostPrice.replace(',', '.'))
    const seats = Number(hostSeats)
    if (!Number.isFinite(price) || price <= 0) { showToast('Prix invalide'); return }
    if (!Number.isInteger(seats) || seats < 1 || seats > 50) { showToast('Nombre de couverts invalide (1 à 50)'); return }
    if (hostDate < todayISO()) { showToast('La date doit être aujourd’hui ou plus tard'); return }
    if (hostPhoto.trim() && !isHttpsUrl(hostPhoto)) { showToast('Le lien de la photo doit commencer par https://'); return }
    setLoading(true)
    const { error } = await supabase.from('meals').insert({
      host_id: user.id,
      title: hostTitle.trim(),
      cuisine: hostCuisine,
      price_per_seat: money(price),
      max_seats: seats,
      available_seats: seats,
      date: hostDate,
      time: hostTime || '19:30',
      city: hostCity.trim(),
      description: hostDesc.trim(),
      menu: hostMenu.split('\n').map(l => l.trim()).filter(Boolean),
      tags: [],
      is_active: true,
      photo_url: hostPhoto.trim() || null
    })
    setLoading(false)
    if (error) { showToast(error.message); return }
    showToast('Votre table est publiée')
    reloadMeals()
    fetchHostStats(user.id).then(setHostStats)
    setHostTitle(''); setHostPrice(''); setHostDate(''); setHostSeats(''); setHostCity(''); setHostDesc(''); setHostMenu(''); setHostPhoto('')
  }

  const saveProfile = async () => {
    if (!user) return
    const full_name = `${profileFname.trim()} ${profileLname.trim()}`.trim()
    if (!full_name) { showToast('Indiquez au moins votre prénom'); return }
    setLoading(true)
    // update (et non upsert) : la base n'autorise que la modification de son profil.
    const { data, error } = await supabase.from('profiles').update({
      full_name,
      city: profileCity.trim(),
      bio: profileBio.trim()
    }).eq('id', user.id).select('*').maybeSingle()
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
      : <><p className="empty-title">Les premières tables arrivent.</p><p>Shareat vient d’ouvrir : proposez la vôtre et accueillez vos premiers invités.</p><button className="btn btn-primary" onClick={() => nav('become')}>Proposer une table</button></>

  const cuisineChips = (
    <div className="chips" role="tablist" aria-label="Cuisine">
      {['all', ...CUISINES].map(c => (
        <button key={c} role="tab" aria-selected={filterCuisine === c} className={`chip${filterCuisine === c ? ' on' : ''}`} onClick={() => setFilterCuisine(c)}>
          {c === 'all' ? 'Toutes' : c}
        </button>
      ))}
    </div>
  )

  const navLink = (p: Page, label: string) => (
    <button className={`nav-link${page === p ? ' active' : ''}`} onClick={() => nav(p)}>{label}</button>
  )

  const dashTabs: [DashTab, string][] = [['overview', 'Vue d’ensemble'], ['bookings', 'Réservations'], ['favorites', 'Favoris'], ['profile', 'Mon profil'], ['host', 'Espace hôte']]

  return (
    <div className="shell">

      {/* ── NAV ── */}
      <header className="nav">
        <button className="logo" onClick={() => nav('home')} aria-label="Shareat, accueil">Shareat</button>
        <nav className="nav-links">
          {navLink('explore', 'Explorer')}
          {navLink('messages', 'Messages')}
          {navLink('become', 'Devenir hôte')}
          {user ? (
            <button className="nav-user" onClick={() => nav('dashboard')} title="Mon espace">
              <span className="nav-user-name">{profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
              <Avatar name={profile?.full_name || user.email} size={34} />
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAuthMode('login'); setShowAuth(true) }}>Connexion</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setAuthMode('signup'); setShowAuth(true) }}>S’inscrire</button>
            </>
          )}
        </nav>
      </header>

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
            <div className="section-head">
              <div>
                <p className="eyebrow">À venir</p>
                <h2 className="title">Prochaines tables</h2>
              </div>
              {meals.length > 0 && <button className="link" onClick={() => nav('explore')}>Tout voir →</button>}
            </div>
            {meals.length > 0 && cuisineChips}
            <Grid data={filtered.slice(0, 8)} loading={mealsLoading} empty={emptyState} {...gridProps} />
          </section>

          <section className="section">
            <p className="eyebrow">Comment ça marche</p>
            <h2 className="title">Trois étapes, une table</h2>
            <div className="steps">
              {[['01', 'Cherchez', 'Filtrez les tables par ville et par cuisine, et découvrez le menu de chaque hôte.'],
                ['02', 'Échangez', 'Posez vos questions à l’hôte par message avant de réserver.'],
                ['03', 'Réservez', 'Réservez votre place en ligne, puis réglez votre repas directement auprès de l’hôte.']].map(([n, t, d]) => (
                <div key={n} className="step">
                  <span className="step-num">{n}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="banner">
              <img src={unsplash(HOST_PHOTO, 1400)} alt="" />
              <div className="banner-txt">
                <p className="eyebrow">Hôtes</p>
                <h2 className="title">Ouvrez votre table</h2>
                <p>Partagez votre cuisine, fixez vos dates et votre prix, et rencontrez vos invités.</p>
                <button className="btn btn-primary" onClick={() => nav('become')}>Devenir hôte</button>
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
          <div className="explore-bar">
            <input className="input input-pill" value={searchCity} onChange={e => { setSearchCity(e.target.value); setAppliedCity(e.target.value) }} placeholder="Filtrer par ville…" aria-label="Filtrer par ville" />
            {!mealsLoading && <span className="muted">{filtered.length} table{filtered.length > 1 ? 's' : ''}</span>}
          </div>
          {cuisineChips}
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

              {selectedMeal.description && <p className="prose">{selectedMeal.description}</p>}

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
              {!isHttpsUrl(selectedMeal.photo_url) && <p className="muted small photo-note">Photo d’illustration.</p>}
            </div>

            <aside className="book-card">
              <p className="book-price">{eur(selectedMeal.price_per_seat)} <small>/ couvert</small></p>
              {isOwnMeal ? (
                <p className="muted">C’est votre table. Suivez vos réservations depuis l’espace hôte.</p>
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
                  <div className="book-line"><span>{eur(selectedMeal.price_per_seat)} × {guests}</span><span>{eur(total)}</span></div>
                  <div className="book-line book-total"><span>Total</span><span>{eur(total)}</span></div>
                  <button className="btn btn-primary btn-block" onClick={openBooking}>Réserver ma place</button>
                  <p className="muted small">Aucun paiement en ligne : le repas se règle directement auprès de l’hôte.</p>
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
                      {[[bookings.length, 'Réservations'], [favMeals.length, 'Favoris'], [meals.length, 'Tables à venir']].map(([v, l]) => (
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
                      : bookings.map(b => (
                        <div key={b.id} className="booking" onClick={() => { if (b.meals) openMeal(b.meals) }}>
                          {b.meals && <img src={mealPhoto(b.meals, 300)} alt="" />}
                          <div className="booking-txt">
                            <strong>{b.meals?.title || 'Table supprimée'}</strong>
                            <span className="muted small">{b.meals ? `${b.meals.city} · ${fmtDate(b.meals.date)} · ` : ''}{b.seats} couvert{b.seats > 1 ? 's' : ''} · {eur(b.total_amount)} à régler sur place</span>
                          </div>
                          <span className={`status status-${b.status}`}>
                            {b.status === 'confirmed' ? 'Confirmée' : b.status === 'pending' ? 'En attente' : b.status === 'cancelled' ? 'Annulée' : 'Terminée'}
                          </span>
                        </div>
                      ))
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
                  </form>
                )}

                {dashTab === 'host' && (
                  <form onSubmit={e => { e.preventDefault(); publishMeal() }}>
                    <h2 className="title">Espace hôte</h2>
                    <div className="stats">
                      {[[hostStats.meals, 'Tables publiées'], [hostStats.guests, 'Invités confirmés'], [eur(hostStats.revenue), 'Montant réservé'], [hostStats.rating > 0 ? `★ ${hostStats.rating.toFixed(1)}` : '—', 'Note hôte']].map(([v, l]) => (
                        <div key={l} className="stat"><strong>{v}</strong><span>{l}</span></div>
                      ))}
                    </div>
                    <h3 className="subtitle">Proposer une table</h3>
                    <Inp label="Titre *" placeholder="Couscous du dimanche" value={hostTitle} onChange={setHostTitle} maxLength={120} />
                    <div className="two-col">
                      <label className="field">
                        <span className="field-label">Cuisine</span>
                        <select className="input" value={hostCuisine} onChange={e => setHostCuisine(e.target.value)} aria-label="Cuisine">
                          {CUISINES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <Inp label="Prix par couvert (€) *" placeholder="20" value={hostPrice} onChange={setHostPrice} type="number" min="1" inputMode="decimal" />
                    </div>
                    <Inp label="Ville *" placeholder="Lyon" value={hostCity} onChange={setHostCity} />
                    <div className="two-col">
                      <Inp label="Date *" placeholder="Date" value={hostDate} onChange={setHostDate} type="date" min={todayISO()} />
                      <Inp label="Heure" placeholder="Heure" value={hostTime} onChange={setHostTime} type="time" />
                    </div>
                    <Inp label="Nombre de couverts *" placeholder="6" value={hostSeats} onChange={setHostSeats} type="number" min="1" inputMode="numeric" />
                    <Inp label="Photo de votre plat (lien https, facultatif)" placeholder="https://…" value={hostPhoto} onChange={setHostPhoto} type="url" inputMode="url" />
                    <label className="field">
                      <span className="field-label">Description</span>
                      <textarea className="input" value={hostDesc} onChange={e => setHostDesc(e.target.value)} placeholder="L’ambiance, l’histoire du plat…" rows={3} aria-label="Description" />
                    </label>
                    <label className="field">
                      <span className="field-label">Menu (un plat par ligne)</span>
                      <textarea className="input" value={hostMenu} onChange={e => setHostMenu(e.target.value)} placeholder={'Entrée : salade de saison\nPlat : couscous\nDessert : cornes de gazelle'} rows={4} aria-label="Menu" />
                    </label>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Publication…' : 'Publier ma table'}</button>
                  </form>
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
              {[['01', 'Vous fixez le prix', 'Indiquez le prix par couvert. Vos invités le règlent directement auprès de vous.'],
                ['02', 'Vous choisissez la date', 'Une date, une heure, un nombre de couverts : vous gardez la main.'],
                ['03', 'Vous échangez avant', 'Vos invités peuvent vous écrire pour poser leurs questions avant de réserver.']].map(([n, t, d]) => (
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
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ RÉSERVATION ══ */}
      {showBooking && selectedMeal && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget && !loading) setShowBooking(false) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Réservation">
            <button className="modal-close" onClick={() => { if (!loading) setShowBooking(false) }} aria-label="Fermer">×</button>
            {bookingDone ? (
              <div className="center">
                <p className="eyebrow">C’est réservé</p>
                <h2 className="title">À table !</h2>
                <p className="muted">Votre place chez <strong>{selectedMeal.profiles?.full_name || 'votre hôte'}</strong> est réservée pour <strong>{bookedSeats} couvert{bookedSeats > 1 ? 's' : ''}</strong>, {fmtDate(selectedMeal.date, true)}.</p>
                <p className="muted small">Le repas se règle directement auprès de l’hôte.</p>
                <div className="row-btns">
                  <button className="btn btn-primary" onClick={() => { setShowBooking(false); setDashTab('bookings'); nav('dashboard') }}>Mes réservations</button>
                  <button className="btn btn-ghost" onClick={() => { setShowBooking(false); openConversation({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name || 'Hôte' }) }}>Écrire à l’hôte</button>
                </div>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); createBooking() }}>
                <h2 className="title">Confirmer la réservation</h2>
                <div className="recap">
                  <img src={mealPhoto(selectedMeal, 300)} alt="" />
                  <div>
                    <strong>{selectedMeal.title}</strong>
                    <span className="muted small">Chez {selectedMeal.profiles?.full_name || 'votre hôte'} · {selectedMeal.city}</span>
                    <span className="muted small">{fmtDate(selectedMeal.date, true)}{selectedMeal.time ? ` à ${fmtTime(selectedMeal.time)}` : ''}</span>
                  </div>
                </div>
                <div className="book-line"><span>{eur(selectedMeal.price_per_seat)} × {guests} couvert{guests > 1 ? 's' : ''}</span><span>{eur(total)}</span></div>
                <div className="book-line book-total"><span>À régler à l’hôte</span><span>{eur(total)}</span></div>
                <p className="muted small">Aucun paiement n’est demandé en ligne.</p>
                <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Réservation…' : 'Confirmer'}</button>
              </form>
            )}
          </div>
        </div>
      )}

      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}

      <footer className="footer">
        <span className="logo logo-static">Shareat</span>
        <span>Partagez une table, découvrez une culture.</span>
        <span className="muted small">© 2026 Shareat · Photos : Unsplash</span>
      </footer>
    </div>
  )
}
