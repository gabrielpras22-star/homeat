'use client'

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

type Page = 'home' | 'explore' | 'detail' | 'messages' | 'dashboard' | 'map' | 'become'
type DashTab = 'overview' | 'bookings' | 'favorites' | 'profile' | 'host'

// ═════════════════════════════ HELPERS ═════════════════════════════

const s = {
  terra: '#C4622D', sage: '#6B8F6B', cream: '#FAF6F0',
  dark: '#2C2416', mid: '#7A6652', border: '#EDE8E0',
}

const SERVICE_FEE = 2
const PROMO_CODE = 'HOMEAT10'
const PROMO_RATE = 0.1

const avatarColors = ['#C4622D', '#C44444', '#2d8659', '#D4851A', '#9C4400', '#8B7355', '#2E6DA4', '#B34700']
const getColor = (name?: string | null) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length]

const cuisineEmojis: Record<string, string> = {
  Marocaine: '🫔', Italienne: '🍕', Japonaise: '🍜', Mexicaine: '🌮',
  Indienne: '🍛', Française: '🥐', Libanaise: '🫒', Espagnole: '🥘', Autre: '🍽️'
}

/** Arrondi au centime. */
const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100
/** Affichage d'un montant : 12, 12,5 → "12", "12,50". */
const eur = (n: number) => {
  const v = money(n)
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + '€'
}

/** Date du jour au format AAAA-MM-JJ (heure locale). */
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : '')

const stars = (rating: number) => {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

const ratingLabel = (r: number | null | undefined, empty = '—') => (r && r > 0 ? Number(r).toFixed(1) : empty)

const totals = (price: number, guests: number, promo: boolean) => {
  const subtotal = money(price * guests)
  const discount = promo ? money(subtotal * PROMO_RATE) : 0
  const total = money(subtotal + SERVICE_FEE - discount)
  return { subtotal, discount, total }
}

// ═════════════════════════════ DATA ═════════════════════════════

async function fetchMeals(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, profiles(full_name, avatar_url, rating, bio)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  const today = todayISO()
  // On masque les repas déjà passés.
  return ((data || []) as Meal[]).filter(m => !m.date || m.date.slice(0, 10) >= today)
}

async function fetchProfile(user: User): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (data) return data as Profile
  // Aucun profil (pas de trigger côté base) : on le crée.
  const fullName = (user.user_metadata?.full_name as string | undefined) || ''
  const { data: created } = await supabase.from('profiles')
    .upsert({ id: user.id, full_name: fullName })
    .select('*')
    .maybeSingle()
  return (created as Profile | null) || null
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
    .select('*, profiles(full_name)')
    .eq('meal_id', mealId)
    .order('created_at', { ascending: false })
  return (data || []) as Review[]
}

async function fetchHostStats(uid: string) {
  const { data: hostMeals } = await supabase.from('meals').select('id').eq('host_id', uid)
  const ids = (hostMeals || []).map((m: { id: string }) => m.id)
  let revenue = 0
  if (ids.length > 0) {
    // Uniquement les réservations des repas de CET hôte.
    const { data: hostBookings } = await supabase.from('bookings')
      .select('total_amount')
      .in('meal_id', ids)
      .eq('status', 'confirmed')
    revenue = money((hostBookings || []).reduce((sum: number, b: { total_amount: number | null }) => sum + (Number(b.total_amount) || 0), 0))
  }
  const { data: hostProfile } = await supabase.from('profiles').select('rating').eq('id', uid).maybeSingle()
  return { meals: ids.length, revenue, rating: Number(hostProfile?.rating) || 0 }
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

const inpStyle = { width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', marginBottom: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff', color: s.dark }

type InpProps = {
  placeholder: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
  min?: string
  maxLength?: number
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
  autoComplete?: string
}

const Inp = ({ placeholder, value, onChange, type = 'text', readOnly, min, maxLength, inputMode, autoComplete }: InpProps) => (
  <input type={type} placeholder={placeholder} aria-label={placeholder} value={value} readOnly={readOnly} min={min} maxLength={maxLength}
    inputMode={inputMode} autoComplete={autoComplete}
    onChange={e => onChange?.(e.target.value)}
    style={{ ...inpStyle, ...(readOnly ? { background: s.cream, color: s.mid } : {}) }} />
)

type MealCardProps = { m: Meal; isFav: boolean; onOpen: (m: Meal) => void; onToggleFav: (id: string) => void }

const MealCard = ({ m, isFav, onOpen, onToggleFav }: MealCardProps) => {
  const hostName = m.profiles?.full_name || 'Hôte'
  return (
    <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', transition: 'transform 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
      <div onClick={() => onOpen(m)}
        style={{ height: 170, background: `linear-gradient(135deg, ${getColor(hostName)}88, ${getColor(hostName)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', position: 'relative' }}>
        {m.photo_url || '🍽️'}
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
          ⭐ {ratingLabel(m.rating, 'Nouveau')}
        </div>
        <button aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={e => { e.stopPropagation(); onToggleFav(m.id) }}
          style={{ position: 'absolute', top: 10, right: 10, background: '#fff', border: 'none', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '0.85rem', color: s.terra }}>
          {isFav ? '❤️' : '♡'}
        </button>
      </div>
      <div onClick={() => onOpen(m)} style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: getColor(hostName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>
            {hostName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: '0.78rem', color: s.mid }}>Chez {hostName} · {m.city}</span>
        </div>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.3 }}>{m.title}</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem', color: s.mid, marginBottom: '0.6rem' }}>
          <span>📅 {fmtDate(m.date)}</span>
          <span>👥 {m.available_seats > 0 ? `${m.available_seats} place${m.available_seats > 1 ? 's' : ''}` : 'Complet'}</span>
          {m.tags?.slice(0, 2).map(t => <span key={t} style={{ background: s.cream, border: `1px solid ${s.border}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{t}</span>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${s.border}`, paddingTop: '0.6rem' }}>
          <span style={{ fontWeight: 800 }}>{eur(m.price_per_seat)} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: s.mid }}>/ couvert</span></span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>⭐ {ratingLabel(m.rating)} <span style={{ color: s.mid, fontWeight: 400 }}>({m.reviews_count ?? 0})</span></span>
        </div>
      </div>
    </div>
  )
}

type GridProps = {
  data: Meal[]
  favIds: Set<string>
  loading?: boolean
  emptyTitle?: string
  emptyAction?: ReactNode
  onOpen: (m: Meal) => void
  onToggleFav: (id: string) => void
}

const Grid = ({ data, favIds, loading, emptyTitle, emptyAction, onOpen, onToggleFav }: GridProps) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.2rem' }}>
    {loading
      ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: s.mid }}>⏳ Chargement des repas…</div>
      : data.length === 0
        ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: s.mid }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
            <p style={{ fontWeight: 700 }}>{emptyTitle || 'Aucun repas disponible pour le moment'}</p>
            {emptyAction}
          </div>
        : data.map(m => <MealCard key={m.id} m={m} isFav={favIds.has(m.id)} onOpen={onOpen} onToggleFav={onToggleFav} />)
    }
  </div>
)

// ═════════════════════════════ PAGE ═════════════════════════════

export default function HomEat() {
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
  const [showPayment, setShowPayment] = useState(false)
  const [payDone, setPayDone] = useState(false)
  const [bookedSeats, setBookedSeats] = useState(0)
  const [toastMsg, setToastMsg] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [cardNum, setCardNum] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardName, setCardName] = useState('')
  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
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
  const [profileFname, setProfileFname] = useState('')
  const [profileLname, setProfileLname] = useState('')
  const [profileCity, setProfileCity] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [hostStats, setHostStats] = useState({ meals: 0, revenue: 0, rating: 0 })
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
      .catch(() => setMealsError('Impossible de charger les repas.'))
  }

  // ── EFFETS ──

  // Chargement initial des repas.
  useEffect(() => {
    let cancelled = false
    fetchMeals()
      .then(data => { if (!cancelled) setMeals(data) })
      .catch(() => { if (!cancelled) setMealsError(supabaseConfigured ? 'Impossible de charger les repas.' : 'Supabase n’est pas configuré (variables d’environnement manquantes).') })
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

  const homeStats = useMemo(() => {
    const hosts = new Set(meals.map(m => m.host_id)).size
    const rated = meals.filter(m => (m.rating || 0) > 0)
    const avg = rated.length > 0 ? (rated.reduce((sum, m) => sum + (m.rating || 0), 0) / rated.length).toFixed(1) : '—'
    const countries = meals.length > 0 ? '1' : '0'
    return { hosts, avg, countries }
  }, [meals])

  const { subtotal, discount, total } = selectedMeal
    ? totals(selectedMeal.price_per_seat, guests, promoApplied)
    : { subtotal: 0, discount: 0, total: 0 }

  const isOwnMeal = Boolean(selectedMeal && user && selectedMeal.host_id === user.id)
  const soldOut = Boolean(selectedMeal && selectedMeal.available_seats <= 0)

  // ── ACTIONS ──

  const openMeal = (m: Meal) => {
    setSelectedMeal(m)
    setGuests(1)
    setPromo(''); setPromoApplied(false)
    setMealReviews([])
    fetchReviews(m.id).then(setMealReviews)
    nav('detail')
  }

  const openConversation = (other: ConvUser) => {
    if (!user) { requireAuth('Connectez-vous pour envoyer un message'); return }
    if (other.id === user.id) { showToast('C’est votre propre repas 🙂'); return }
    if (other.id !== selectedConvUser?.id) setMessages([])
    setSelectedConvUser(other)
    nav('messages')
  }

  const doLogin = async () => {
    if (!email.trim() || !password) { showToast('⚠️ Email et mot de passe requis'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    setShowAuth(false)
    showToast('👋 Bienvenue !')
    setEmail(''); setPassword('')
  }

  const doSignup = async () => {
    if (!fullName.trim()) { showToast('⚠️ Indiquez votre prénom et nom'); return }
    if (!email.trim()) { showToast('⚠️ Indiquez votre email'); return }
    if (password.length < 8) { showToast('⚠️ Mot de passe trop court (8 car. min)'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    setShowAuth(false)
    showToast(data.session ? '🎉 Compte créé, bienvenue !' : '🎉 Compte créé ! Vérifiez votre email.')
    setEmail(''); setPassword(''); setFullName('')
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    nav('home')
    setDashTab('overview')
    showToast('À bientôt !')
  }

  const openPayment = () => {
    if (!user) { requireAuth('Connectez-vous pour réserver'); return }
    if (isOwnMeal) { showToast('Vous ne pouvez pas réserver votre propre repas'); return }
    if (soldOut) { showToast('Ce repas est complet'); return }
    setPayDone(false)
    setShowPayment(true)
  }

  const resetCard = () => { setCardNum(''); setCardExp(''); setCardCvv(''); setCardName('') }

  const validateCard = () => {
    if (cardNum.replace(/\s/g, '').length !== 16) return 'Numéro de carte invalide'
    const m = cardExp.match(/^(\d{2})\/(\d{2})$/)
    if (!m) return 'Date d’expiration invalide (MM/AA)'
    const month = Number(m[1]), year = 2000 + Number(m[2])
    const now = new Date()
    if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'Carte expirée ou date invalide'
    if (!/^\d{3,4}$/.test(cardCvv)) return 'CVV invalide'
    if (!cardName.trim()) return 'Entrez le nom sur la carte'
    return ''
  }

  const createBooking = async () => {
    if (!user || !selectedMeal) return
    const cardError = validateCard()
    if (cardError) { showToast('⚠️ ' + cardError); return }
    setLoading(true)
    // On revérifie les places restantes juste avant de réserver.
    const { data: fresh } = await supabase.from('meals').select('available_seats').eq('id', selectedMeal.id).maybeSingle()
    const seatsLeft = fresh ? Number(fresh.available_seats) : selectedMeal.available_seats
    if (seatsLeft < guests) {
      setLoading(false)
      showToast(seatsLeft > 0 ? `⚠️ Plus que ${seatsLeft} place(s) disponible(s)` : '⚠️ Ce repas est complet')
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
    if (error) { setLoading(false); showToast('❌ Erreur : ' + error.message); return }
    // Mise à jour des places restantes (ignorée si la base l'interdit).
    await supabase.from('meals').update({ available_seats: seatsLeft - guests }).eq('id', selectedMeal.id)
    setLoading(false)
    setBookedSeats(guests)
    setSelectedMeal({ ...selectedMeal, available_seats: seatsLeft - guests })
    setGuests(1)
    resetCard()
    setPayDone(true)
    reloadMeals()
  }

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === PROMO_CODE) { setPromoApplied(true); showToast('🎉 -10% appliqué !') }
    else { setPromoApplied(false); showToast('❌ Code invalide') }
  }

  const toggleFavorite = async (mealId: string) => {
    if (!user) { requireAuth('Connectez-vous pour ajouter des favoris'); return }
    if (favIds.has(mealId)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('meal_id', mealId)
      if (error) { showToast('❌ ' + error.message); return }
      setFavMeals(prev => prev.filter(m => m.id !== mealId))
      showToast('💔 Retiré des favoris')
    } else {
      const meal = meals.find(m => m.id === mealId) || (selectedMeal?.id === mealId ? selectedMeal : null)
      if (meal) setFavMeals(prev => [...prev, meal])
      const { error } = await supabase.from('favorites').insert({ user_id: user.id, meal_id: mealId })
      if (error) {
        setFavMeals(prev => prev.filter(m => m.id !== mealId))
        showToast('❌ ' + error.message)
        return
      }
      showToast('❤️ Ajouté aux favoris')
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
    if (error) { showToast('❌ ' + error.message); return }
    setMsgInput('')
    const m = data as Message
    setMessages(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]))
    fetchConversations(user.id).then(setConversations)
  }

  const publishMeal = async () => {
    if (!user) { requireAuth(); return }
    if (!hostTitle.trim() || !hostPrice || !hostDate || !hostSeats || !hostCity.trim()) {
      showToast('⚠️ Remplissez tous les champs obligatoires'); return
    }
    const price = parseFloat(hostPrice.replace(',', '.'))
    const seats = Number(hostSeats)
    if (!Number.isFinite(price) || price <= 0) { showToast('⚠️ Prix invalide'); return }
    if (!Number.isInteger(seats) || seats < 1 || seats > 50) { showToast('⚠️ Nombre de couverts invalide (1 à 50)'); return }
    if (hostDate < todayISO()) { showToast('⚠️ La date doit être aujourd’hui ou plus tard'); return }
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
      photo_url: cuisineEmojis[hostCuisine] || '🍽️'
    })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    showToast('🎉 Repas publié avec succès !')
    reloadMeals()
    fetchHostStats(user.id).then(setHostStats)
    setHostTitle(''); setHostPrice(''); setHostDate(''); setHostSeats(''); setHostCity(''); setHostDesc(''); setHostMenu('')
  }

  const saveProfile = async () => {
    if (!user) return
    const full_name = `${profileFname.trim()} ${profileLname.trim()}`.trim()
    if (!full_name) { showToast('⚠️ Indiquez au moins votre prénom'); return }
    setLoading(true)
    const { data, error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name,
      city: profileCity.trim(),
      bio: profileBio.trim()
    }).select('*').maybeSingle()
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    if (data) setProfile(data as Profile)
    showToast('✅ Profil enregistré !')
  }

  const formatCardNum = (v: string) => v.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const formatCardExp = (v: string) => {
    const d = v.replace(/\D/g, '').substring(0, 4)
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
  }

  const gridProps = { favIds, onOpen: openMeal, onToggleFav: toggleFavorite }
  const becomeHostBtn = (
    <>
      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Soyez le premier à proposer votre table !</p>
      <button onClick={() => nav('become')} style={{ marginTop: '1rem', background: s.sage, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Devenir hôte</button>
    </>
  )
  const noMatchAction = (
    <button onClick={() => { setFilterCuisine('all'); setSearchCity(''); setAppliedCity('') }} style={{ marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Réinitialiser les filtres</button>
  )
  const filteredEmpty = meals.length > 0
    ? { emptyTitle: 'Aucun repas ne correspond à votre recherche', emptyAction: noMatchAction }
    : { emptyTitle: mealsError || undefined, emptyAction: mealsError ? undefined : becomeHostBtn }

  const navLink = (p: Page, label: string, onClick?: () => void) => (
    <span onClick={onClick || (() => nav(p))} style={{ color: page === p ? s.terra : s.mid, fontWeight: page === p ? 700 : 400, fontSize: '0.88rem', cursor: 'pointer' }}>{label}</span>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: s.cream, minHeight: '100vh', color: s.dark, display: 'flex', flexDirection: 'column', width: '100%' }}>

      {/* ── NAV ── */}
      <nav className="he-nav" style={{ background: '#fff', borderBottom: `1px solid ${s.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div onClick={() => nav('home')} style={{ fontSize: '1.6rem', fontWeight: 900, color: s.terra, cursor: 'pointer', letterSpacing: -1 }}>
          Hom<span style={{ color: s.sage }}>Eat</span>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {navLink('explore', 'Explorer')}
          {navLink('map', 'Carte')}
          {navLink('messages', 'Messages')}
          {navLink('become', 'Devenir hôte')}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', color: s.mid }}>{profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
              <div onClick={() => nav('dashboard')} title="Mon tableau de bord"
                style={{ width: 36, height: 36, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => { setAuthMode('login'); setShowAuth(true) }} style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 999, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Connexion</button>
              <button onClick={() => { setAuthMode('signup'); setShowAuth(true) }} style={{ background: s.terra, border: 'none', color: '#fff', borderRadius: 999, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>S&apos;inscrire</button>
            </div>
          )}
        </div>
      </nav>

      <main style={{ flex: 1 }}>

      {/* ══ HOME ══ */}
      {page === 'home' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #2C2416 0%, #5C3A1E 50%, #C4622D 100%)', padding: '5rem 1.25rem 4rem', textAlign: 'center', color: '#fff' }}>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}>🌍 Partagez une table, découvrez une culture</div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1rem' }}>Dînez chez l&apos;<span style={{ color: '#E8845A' }}>habitant</span>,<br />découvrez une culture</h1>
            <p style={{ fontSize: '1rem', opacity: 0.85, maxWidth: 500, margin: '0 auto 2.5rem' }}>Trouvez un hôte qui partage sa table, sa cuisine et son histoire. Une expérience unique à chaque repas.</p>
            <form onSubmit={e => { e.preventDefault(); setAppliedCity(searchCity); nav('explore') }}
              style={{ background: '#fff', color: s.dark, borderRadius: 16, padding: '1.2rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: 680, margin: '0 auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)', flexWrap: 'wrap', textAlign: 'left' }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>📍 Où ?</div>
                <input value={searchCity} onChange={e => setSearchCity(e.target.value)} placeholder="Bordeaux, Paris…" aria-label="Ville" style={{ border: 'none', outline: 'none', fontSize: '0.92rem', width: '100%', fontFamily: 'inherit', background: 'transparent' }} />
              </div>
              <div style={{ width: 1, height: 36, background: s.border }} />
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>🍴 Cuisine</div>
                <select value={filterCuisine} onChange={e => setFilterCuisine(e.target.value)} aria-label="Cuisine" style={{ border: 'none', outline: 'none', fontSize: '0.92rem', background: 'transparent', fontFamily: 'inherit', width: '100%' }}>
                  <option value="all">Toutes</option>
                  {Object.keys(cuisineEmojis).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit"
                style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                🔍 Rechercher
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', padding: '1.5rem', background: '#fff', flexWrap: 'wrap' }}>
            {[['🏠', 'Hôtes actifs', String(homeStats.hosts)], ['🌍', 'Pays couverts', homeStats.countries], ['🍽️', 'Repas proposés', String(meals.length)], ['⭐', 'Note moyenne', homeStats.avg]].map(([icon, label, val]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <strong style={{ display: 'block', fontSize: '1.4rem', color: s.terra, fontWeight: 800 }}>{icon} {val}</strong>
                <span style={{ fontSize: '0.8rem', color: s.mid }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="he-section" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>Explorez par cuisine</h2>
            <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
              {[['🍽️', 'Tout', 'all'], ...Object.entries(cuisineEmojis).map(([k, v]) => [v, k, k])].map(([icon, label, val]) => (
                <div key={val} onClick={() => setFilterCuisine(val)}
                  style={{ flexShrink: 0, background: filterCuisine === val ? '#FEF3ED' : '#fff', border: `2px solid ${filterCuisine === val ? s.terra : s.border}`, borderRadius: 12, padding: '0.6rem 1rem', cursor: 'pointer', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '1.4rem' }}>{icon}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', gap: '1rem' }}>
              <h2 style={{ fontWeight: 800 }}>✨ Repas disponibles</h2>
              <span onClick={() => nav('explore')} style={{ color: s.terra, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', whiteSpace: 'nowrap' }}>Voir tout →</span>
            </div>
            <Grid data={filtered.slice(0, 4)} loading={mealsLoading} {...filteredEmpty} {...gridProps} />
          </div>

          <div className="he-section">
            <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem 1.5rem', maxWidth: 1060, margin: '0 auto' }}>
              <h2 style={{ fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>Comment ça marche ?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                {[['🔍', '#FEF3ED', 'Cherchez', 'Filtrez par ville, cuisine, budget.'], ['💬', '#E8F5E9', 'Messagez', 'Discutez avec l\'hôte avant.'], ['💳', '#EBF8FF', 'Payez', 'Paiement 100% sécurisé.'], ['🍴', '#FFF8E1', 'Dînez', 'Vivez une expérience unique.'], ['⭐', '#F0E8FF', 'Évaluez', 'Laissez un avis après.']].map(([icon, bg, title, desc]) => (
                  <div key={title} style={{ textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', margin: '0 auto 0.8rem' }}>{icon}</div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.3rem' }}>{title}</h3>
                    <p style={{ fontSize: '0.82rem', color: s.mid }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="he-section" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ background: 'linear-gradient(135deg, #6B8F6B, #3D6B45)', borderRadius: 20, padding: '2.5rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div><h2 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Devenez hôte HomEat</h2><p style={{ opacity: 0.9, maxWidth: 400, fontSize: '0.9rem' }}>Partagez votre passion culinaire et rencontrez des gens du monde entier.</p></div>
              <button onClick={() => nav('become')} style={{ background: '#fff', color: '#6B8F6B', border: 'none', borderRadius: 999, padding: '0.8rem 1.8rem', fontWeight: 700, cursor: 'pointer' }}>Commencer →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXPLORE ══ */}
      {page === 'explore' && (
        <div>
          <div className="he-section" style={{ background: s.terra, color: '#fff' }}>
            <h1 style={{ fontWeight: 800, marginBottom: '1rem' }}>🍽️ Explorer les repas</h1>
            <input value={searchCity} onChange={e => { setSearchCity(e.target.value); setAppliedCity(e.target.value) }} placeholder="📍 Filtrer par ville…" aria-label="Filtrer par ville"
              style={{ width: '100%', maxWidth: 360, border: 'none', borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', marginBottom: '1rem', background: '#fff', color: s.dark }} />
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {['all', ...Object.keys(cuisineEmojis)].map(c => (
                <button key={c} onClick={() => setFilterCuisine(c)}
                  style={{ background: filterCuisine === c ? '#fff' : 'rgba(255,255,255,0.2)', color: filterCuisine === c ? s.terra : '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '0.35rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  {c === 'all' ? 'Tous' : c}
                </button>
              ))}
            </div>
          </div>
          <div className="he-section" style={{ maxWidth: 1100, margin: '0 auto' }}>
            {!mealsLoading && <p style={{ color: s.mid, fontSize: '0.88rem', marginBottom: '1.2rem' }}>{filtered.length} repas disponible{filtered.length > 1 ? 's' : ''}</p>}
            <Grid data={filtered} loading={mealsLoading} {...filteredEmpty} {...gridProps} />
          </div>
        </div>
      )}

      {/* ══ DETAIL ══ */}
      {page === 'detail' && selectedMeal && (
        <div>
          <div style={{ height: 260, background: `linear-gradient(135deg, ${getColor(selectedMeal.profiles?.full_name)}88, ${getColor(selectedMeal.profiles?.full_name)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', position: 'relative' }}>
            <button onClick={goBack} style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: 600, color: s.dark }}>← Retour</button>
            <button onClick={() => toggleFavorite(selectedMeal.id)} aria-label="Favori" style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: 600, color: s.terra }}>{favIds.has(selectedMeal.id) ? '❤️ Favori' : '♡ Favori'}</button>
            {selectedMeal.photo_url || '🍽️'}
          </div>
          <div className="he-section" style={{ maxWidth: 780, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: '0.5rem' }}>{selectedMeal.title}</h1>
            <div style={{ display: 'flex', gap: '0.8rem', color: s.mid, fontSize: '0.88rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <span>📍 {selectedMeal.city}</span><span>🍴 {selectedMeal.cuisine}</span>
              <span>📅 {fmtDate(selectedMeal.date)}{selectedMeal.time ? ` à ${fmtTime(selectedMeal.time)}` : ''}</span>
              <span>👥 {soldOut ? 'Complet' : `${selectedMeal.available_seats} place${selectedMeal.available_seats > 1 ? 's' : ''} dispo`}</span>
              {(selectedMeal.rating || 0) > 0 && <span>⭐ {ratingLabel(selectedMeal.rating)} ({selectedMeal.reviews_count ?? 0} avis)</span>}
            </div>

            {selectedMeal.description && <p style={{ color: s.mid, lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.92rem', whiteSpace: 'pre-line' }}>{selectedMeal.description}</p>}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: '#fff', borderRadius: 16, padding: '1.1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: getColor(selectedMeal.profiles?.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>
                {(selectedMeal.profiles?.full_name || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontWeight: 700 }}>{selectedMeal.profiles?.full_name || 'Hôte'} <span style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>✓ Vérifié</span></div>
                {selectedMeal.profiles?.bio && <div style={{ fontSize: '0.8rem', color: s.mid, marginTop: '0.2rem' }}>{selectedMeal.profiles.bio}</div>}
              </div>
              {!isOwnMeal && (
                <button onClick={() => openConversation({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name || 'Hôte' })}
                  style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 10, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>💬 Message</button>
              )}
            </div>

            {(selectedMeal.menu?.length || 0) > 0 && (
              <>
                <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>🍽️ Au menu</h3>
                <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
                  {selectedMeal.menu!.map((item, i) => (
                    <li key={i} style={{ padding: '0.55rem 0', borderBottom: `1px solid ${s.border}`, fontSize: '0.9rem' }}>✦ {item}</li>
                  ))}
                </ul>
              </>
            )}

            <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>⭐ Avis</h3>
            {mealReviews.length === 0
              ? <p style={{ color: s.mid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>Aucun avis pour l&apos;instant.</p>
              : mealReviews.map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: '1rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: getColor(r.profiles?.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{(r.profiles?.full_name || '?').charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.profiles?.full_name || 'Utilisateur'}</div>
                      <div style={{ color: '#F6AD55', fontSize: '0.82rem' }}>{stars(r.rating)}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: s.mid }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {r.comment && <p style={{ fontSize: '0.85rem', color: s.mid }}>{r.comment}</p>}
                </div>
              ))
            }

            <div style={{ background: '#fff', border: `2px solid ${s.border}`, borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
              <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>Réserver votre couvert</h3>
              {isOwnMeal ? (
                <p style={{ color: s.mid, fontSize: '0.9rem' }}>C&apos;est votre repas. Retrouvez vos statistiques dans l&apos;espace hôte.</p>
              ) : soldOut ? (
                <p style={{ color: s.mid, fontSize: '0.9rem', fontWeight: 600 }}>😔 Ce repas est complet.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                    <span>Nombre de convives</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <button aria-label="Moins" disabled={guests <= 1} onClick={() => setGuests(g => Math.max(1, g - 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${s.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: s.dark, opacity: guests <= 1 ? 0.4 : 1 }}>−</button>
                      <span style={{ fontWeight: 700 }}>{guests}</span>
                      <button aria-label="Plus" disabled={guests >= selectedMeal.available_seats} onClick={() => setGuests(g => Math.min(selectedMeal.available_seats, g + 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${s.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', color: s.dark, opacity: guests >= selectedMeal.available_seats ? 0.4 : 1 }}>+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}><span>{eur(selectedMeal.price_per_seat)} × {guests}</span><span>{eur(subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}><span>Frais de service</span><span>{eur(SERVICE_FEE)}</span></div>
                  {promoApplied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#38A169', marginBottom: '0.5rem' }}><span>🎉 Promo -10%</span><span>-{eur(discount)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `2px solid ${s.border}`, paddingTop: '0.7rem' }}><span>Total</span><span>{eur(total)}</span></div>
                  <button onClick={openPayment}
                    style={{ width: '100%', marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                    💳 Réserver & Payer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MESSAGES ══ */}
      {page === 'messages' && (
        <div className="he-section" style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>💬 Messages</h2>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 16 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
              <p style={{ color: s.mid, marginBottom: '1rem' }}>Connectez-vous pour accéder à vos messages</p>
              <button onClick={() => requireAuth()} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Se connecter</button>
            </div>
          ) : (
            <div className={conversations.length > 0 ? 'he-msg-grid' : ''} style={{ display: 'grid', gap: '1rem' }}>
              {conversations.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', maxHeight: 520, overflowY: 'auto' }}>
                  <div style={{ padding: '1rem', borderBottom: `1px solid ${s.border}`, fontWeight: 800 }}>Conversations</div>
                  {conversations.map(c => (
                    <div key={c.id} onClick={() => { if (c.id !== selectedConvUser?.id) { setMessages([]); setSelectedConvUser({ id: c.id, name: c.name }) } }}
                      style={{ display: 'flex', gap: '0.7rem', padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: `1px solid ${s.border}`, background: selectedConvUser?.id === c.id ? s.cream : '#fff' }}>
                      <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: getColor(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{c.name.charAt(0).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.78rem', color: s.mid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMsg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                {selectedConvUser ? (
                  <>
                    <div style={{ padding: '1rem', borderBottom: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: getColor(selectedConvUser.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{(selectedConvUser.name || '?').charAt(0).toUpperCase()}</div>
                      <div style={{ fontWeight: 700 }}>{selectedConvUser.name}</div>
                    </div>
                    <div ref={bubblesRef} style={{ flex: 1, minHeight: 300, maxHeight: 400, overflowY: 'auto', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                      {messages.length === 0 && <p style={{ color: s.mid, fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>Aucun message. Dites bonjour 👋</p>}
                      {messages.map(msg => (
                        <div key={msg.id} style={{ maxWidth: '70%', padding: '0.7rem 1rem', borderRadius: 18, fontSize: '0.88rem', lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap', alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start', background: msg.sender_id === user.id ? s.terra : s.cream, color: msg.sender_id === user.id ? '#fff' : s.dark }}>
                          {msg.content}
                        </div>
                      ))}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); sendMessage() }} style={{ padding: '1rem', borderTop: `1px solid ${s.border}`, display: 'flex', gap: '0.7rem' }}>
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Écrivez un message…" aria-label="Message" maxLength={2000}
                        style={{ flex: 1, minWidth: 0, border: `1.5px solid ${s.border}`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', background: '#fff', color: s.dark }} />
                      <button type="submit" disabled={sending || !msgInput.trim()} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.55rem 1.2rem', fontWeight: 600, cursor: 'pointer', opacity: sending || !msgInput.trim() ? 0.6 : 1 }}>Envoyer</button>
                    </form>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: s.mid, flexDirection: 'column', gap: '1rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem' }}>💬</div>
                    <p>Sélectionnez une conversation ou contactez un hôte depuis la page d&apos;un repas</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ DASHBOARD ══ */}
      {page === 'dashboard' && (
        <div className="he-section" style={{ maxWidth: 1060, margin: '0 auto' }}>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 16 }}>
              <p style={{ color: s.mid, marginBottom: '1rem' }}>Connectez-vous pour accéder à votre tableau de bord</p>
              <button onClick={() => requireAuth()} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Se connecter</button>
            </div>
          ) : (
            <div className="he-dash">
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.2rem', height: 'fit-content', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: `1px solid ${s.border}`, marginBottom: '0.8rem' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>
                    {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{profile?.full_name || user.email}</div>
                  <div style={{ fontSize: '0.75rem', color: s.mid }}>Membre HomEat</div>
                </div>
                {([['overview', '📊', 'Vue d\'ensemble'], ['bookings', '🍽️', 'Réservations'], ['favorites', '❤️', 'Favoris'], ['profile', '👤', 'Mon profil'], ['host', '🏠', 'Espace hôte']] as [DashTab, string, string][]).map(([id, icon, label]) => (
                  <div key={id} onClick={() => setDashTab(id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', fontWeight: dashTab === id ? 700 : 500, background: dashTab === id ? s.cream : 'transparent', color: dashTab === id ? s.terra : s.dark, marginBottom: '0.3rem' }}>
                    <span>{icon}</span>{label}
                  </div>
                ))}
                <div onClick={doLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', color: '#E53E3E', marginTop: '1rem' }}>🚪 Déconnexion</div>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', minWidth: 0 }}>
                {dashTab === 'overview' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Bonjour {profile?.full_name?.split(' ')[0] || ''} 👋</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {[[bookings.length.toString(), 'Réservations'], [favMeals.length.toString(), 'Favoris'], [meals.length.toString(), 'Repas dispo']].map(([v, l]) => (
                        <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                          <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                          <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Repas disponibles</h3>
                    <Grid data={meals.slice(0, 3)} loading={mealsLoading} {...gridProps} />
                  </div>
                )}

                {dashTab === 'bookings' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🍽️ Mes réservations</h2>
                    {bookings.length === 0
                      ? <div style={{ textAlign: 'center', padding: '2rem', color: s.mid }}><div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🍽️</div><p>Aucune réservation pour l&apos;instant</p><button onClick={() => nav('explore')} style={{ marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Explorer les repas</button></div>
                      : bookings.map(b => (
                        <div key={b.id} onClick={() => { if (b.meals) openMeal(b.meals) }} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem', border: `1.5px solid ${s.border}`, borderRadius: 12, marginBottom: '0.8rem', flexWrap: 'wrap', cursor: b.meals ? 'pointer' : 'default' }}>
                          <span style={{ fontSize: '2rem' }}>{b.meals?.photo_url || '🍽️'}</span>
                          <div style={{ flex: 1, minWidth: 150 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.meals?.title || 'Repas supprimé'}</div>
                            <div style={{ fontSize: '0.78rem', color: s.mid }}>{b.meals ? `📍 ${b.meals.city} · 📅 ${fmtDate(b.meals.date)} · ` : ''}{b.seats} couvert(s) · {eur(b.total_amount)}</div>
                          </div>
                          <span style={{ background: b.status === 'confirmed' ? '#E8F5E9' : b.status === 'pending' ? '#EBF8FF' : b.status === 'cancelled' ? '#FDECEC' : '#f0f0f0', color: b.status === 'confirmed' ? '#38A169' : b.status === 'pending' ? '#3182CE' : b.status === 'cancelled' ? '#E53E3E' : s.mid, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            {b.status === 'confirmed' ? 'Confirmé' : b.status === 'pending' ? 'En attente' : b.status === 'cancelled' ? 'Annulé' : 'Terminé'}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                )}

                {dashTab === 'favorites' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>❤️ Mes favoris</h2>
                    {favMeals.length === 0
                      ? <div style={{ textAlign: 'center', padding: '2rem', color: s.mid }}><div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>❤️</div><p>Aucun favori pour l&apos;instant</p></div>
                      : <Grid data={favMeals} {...gridProps} />
                    }
                  </div>
                )}

                {dashTab === 'profile' && (
                  <form onSubmit={e => { e.preventDefault(); saveProfile() }}>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>👤 Mon profil</h2>
                    <div className="he-2col">
                      <Inp placeholder="Prénom" value={profileFname} onChange={setProfileFname} autoComplete="given-name" />
                      <Inp placeholder="Nom" value={profileLname} onChange={setProfileLname} autoComplete="family-name" />
                    </div>
                    <Inp placeholder="Email" value={user.email || ''} type="email" readOnly />
                    <Inp placeholder="Ville" value={profileCity} onChange={setProfileCity} />
                    <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Parlez de vous, vos passions culinaires…" rows={3} aria-label="Bio"
                      style={{ ...inpStyle, fontSize: '0.88rem', resize: 'vertical', marginBottom: '1rem' }} />
                    <button type="submit" disabled={loading} style={{ background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>💾 Enregistrer</button>
                  </form>
                )}

                {dashTab === 'host' && (
                  <form onSubmit={e => { e.preventDefault(); publishMeal() }}>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🏠 Espace hôte</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {[[hostStats.meals.toString(), 'Repas proposés'], [eur(hostStats.revenue), 'Revenus totaux'], [hostStats.rating > 0 ? hostStats.rating.toFixed(1) + '⭐' : '—', 'Note hôte']].map(([v, l]) => (
                        <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                          <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                          <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Proposer un nouveau repas</h3>
                    <Inp placeholder="Titre du repas *" value={hostTitle} onChange={setHostTitle} maxLength={120} />
                    <div className="he-2col">
                      <select value={hostCuisine} onChange={e => setHostCuisine(e.target.value)} aria-label="Cuisine" style={inpStyle}>
                        {Object.keys(cuisineEmojis).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <Inp placeholder="Prix / couvert (€) *" value={hostPrice} onChange={setHostPrice} type="number" min="1" inputMode="decimal" />
                    </div>
                    <Inp placeholder="Ville *" value={hostCity} onChange={setHostCity} />
                    <div className="he-2col">
                      <Inp placeholder="Date *" value={hostDate} onChange={setHostDate} type="date" min={todayISO()} />
                      <Inp placeholder="Heure" value={hostTime} onChange={setHostTime} type="time" />
                    </div>
                    <Inp placeholder="Nombre de couverts *" value={hostSeats} onChange={setHostSeats} type="number" min="1" inputMode="numeric" />
                    <textarea value={hostDesc} onChange={e => setHostDesc(e.target.value)} placeholder="Description du repas, ambiance…" rows={3} aria-label="Description"
                      style={{ ...inpStyle, fontSize: '0.88rem', resize: 'vertical' }} />
                    <textarea value={hostMenu} onChange={e => setHostMenu(e.target.value)} placeholder={'Menu (1 plat par ligne) :\nEntrée : Salade composée\nPlat : Poulet rôti\nDessert : Tarte maison'} rows={4} aria-label="Menu"
                      style={{ ...inpStyle, fontSize: '0.88rem', resize: 'vertical' }} />
                    <button type="submit" disabled={loading}
                      style={{ width: '100%', background: loading ? '#ccc' : s.sage, color: '#fff', border: 'none', borderRadius: 12, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                      {loading ? 'Publication…' : '🎉 Publier mon repas'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ MAP ══ */}
      {page === 'map' && (
        <div className="he-section" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>🗺️ Carte des repas</h2>
          <div style={{ borderRadius: 16, overflow: 'hidden', height: 380, background: 'linear-gradient(180deg, #c8e6c9, #a5d6a7)', position: 'relative', marginBottom: '1.5rem' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, #81c784 39px, #81c784 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #81c784 39px, #81c784 40px)' }} />
            {!mealsLoading && filtered.length === 0 && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '3rem' }}>🗺️</div>
                <p style={{ color: s.mid, fontWeight: 600 }}>Aucun repas à afficher sur la carte</p>
              </div>
            )}
            {filtered.map((m, i) => (
              <div key={m.id} onClick={() => openMeal(m)} title={`${m.title} — ${m.city}`}
                style={{ position: 'absolute', left: `${12 + (i * 17) % 76}%`, top: `${20 + (i * 23) % 65}%`, transform: 'translate(-50%, -100%)', cursor: 'pointer', zIndex: 10 }}>
                <div style={{ background: s.terra, color: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 3px 12px rgba(196,98,45,0.4)' }}>
                  {m.photo_url || '🍽️'} {eur(m.price_per_seat)}
                </div>
                <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${s.terra}`, margin: '0 auto' }} />
              </div>
            ))}
          </div>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Repas à proximité</h3>
          <Grid data={filtered.slice(0, 4)} loading={mealsLoading} {...filteredEmpty} {...gridProps} />
        </div>
      )}

      {/* ══ BECOME ══ */}
      {page === 'become' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #6B8F6B, #3D6B45)', color: '#fff', padding: '4rem 1.25rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>🏠 Partagez votre table</h1>
            <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto 2rem', fontSize: '1rem' }}>Rencontrez des gens du monde entier et gagnez un revenu complémentaire.</p>
          </div>
          <div className="he-section" style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {[['💶', '#FEF3ED', 'Revenus complémentaires', 'Gagnez selon vos disponibilités.'], ['🌍', '#E8F5E9', 'Rencontres mondiales', 'Accueillez des voyageurs curieux.'], ['🛡️', '#EBF8FF', 'Sécurité garantie', 'Profils vérifiés, paiements sécurisés.']].map(([icon, bg, title, desc]) => (
                <div key={title} style={{ textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem' }}>{icon}</div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.85rem', color: s.mid }}>{desc}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { if (user) { setDashTab('host'); nav('dashboard') } else { setAuthMode('signup'); setShowAuth(true) } }}
              style={{ background: s.sage, color: '#fff', border: 'none', borderRadius: 999, padding: '0.85rem 2.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
              {user ? 'Proposer un repas →' : 'Créer mon profil hôte →'}
            </button>
          </div>
        </div>
      )}

      </main>

      {/* ══ MODAL AUTH ══ */}
      {showAuth && !user && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAuth(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowAuth(false)} aria-label="Fermer" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: s.mid }}>✕</button>
            <div style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '0.5rem' }}>🍴</div>
            <h2 style={{ textAlign: 'center', fontWeight: 800, marginBottom: '0.3rem' }}>Bienvenue sur HomEat</h2>
            <p style={{ textAlign: 'center', color: s.mid, fontSize: '0.85rem', marginBottom: '1.3rem' }}>La table qui unit les cultures</p>
            <div style={{ display: 'flex', border: `1.5px solid ${s.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
              {(['login', 'signup'] as const).map(t => (
                <div key={t} onClick={() => setAuthMode(t)}
                  style={{ flex: 1, padding: '0.55rem', textAlign: 'center', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', background: authMode === t ? s.terra : 'transparent', color: authMode === t ? '#fff' : s.dark }}>
                  {t === 'login' ? 'Connexion' : 'Inscription'}
                </div>
              ))}
            </div>
            {authMode === 'login' ? (
              <form onSubmit={e => { e.preventDefault(); doLogin() }}>
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                <Inp placeholder="Mot de passe" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
                <button type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                  {loading ? 'Connexion…' : 'Se connecter'}
                </button>
              </form>
            ) : (
              <form onSubmit={e => { e.preventDefault(); doSignup() }}>
                <Inp placeholder="Prénom et nom" value={fullName} onChange={setFullName} autoComplete="name" />
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
                <Inp placeholder="Mot de passe (8 car. min)" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
                <p style={{ fontSize: '0.75rem', color: s.mid, marginBottom: '1rem' }}>En créant un compte, vous acceptez les CGU.</p>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                  {loading ? 'Création…' : 'Créer mon compte'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL PAYMENT ══ */}
      {showPayment && selectedMeal && (
        <div onClick={e => { if (e.target === e.currentTarget && !loading) setShowPayment(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div role="dialog" aria-modal="true" style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => { if (!loading) setShowPayment(false) }} aria-label="Fermer" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: s.mid }}>✕</button>
            {payDone ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Réservation confirmée !</h2>
                <p style={{ color: s.mid, marginBottom: '1.5rem' }}>Votre repas chez <strong>{selectedMeal.profiles?.full_name || 'votre hôte'}</strong> est confirmé pour <strong>{bookedSeats} couvert(s)</strong>.</p>
                <div style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.5rem 1.2rem', display: 'inline-block', fontWeight: 700, marginBottom: '1.5rem' }}>✅ Paiement accepté</div>
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { setShowPayment(false); setDashTab('bookings'); nav('dashboard') }} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Mes réservations</button>
                  <button onClick={() => { setShowPayment(false); openConversation({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name || 'Hôte' }) }}
                    style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>💬 Contacter l&apos;hôte</button>
                </div>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); createBooking() }}>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>💳 Paiement sécurisé</h2>
                <div style={{ display: 'flex', gap: '0.7rem', background: s.cream, borderRadius: 12, padding: '0.9rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>{selectedMeal.photo_url || '🍽️'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{selectedMeal.title}</div>
                    <div style={{ fontSize: '0.78rem', color: s.mid }}>Chez {selectedMeal.profiles?.full_name || 'Hôte'} · {guests} couvert(s) · {fmtDate(selectedMeal.date)}</div>
                  </div>
                </div>
                <Inp placeholder="Numéro de carte" value={cardNum} onChange={v => setCardNum(formatCardNum(v))} inputMode="numeric" autoComplete="cc-number" />
                <div className="he-2col" style={{ gap: '0.8rem' }}>
                  <Inp placeholder="MM / AA" value={cardExp} onChange={v => setCardExp(formatCardExp(v))} inputMode="numeric" autoComplete="cc-exp" />
                  <Inp placeholder="CVV" value={cardCvv} onChange={v => setCardCvv(v.replace(/\D/g, '').substring(0, 4))} type="password" inputMode="numeric" autoComplete="cc-csc" />
                </div>
                <Inp placeholder="Nom sur la carte" value={cardName} onChange={setCardName} autoComplete="cc-name" />
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                  <input value={promo} onChange={e => setPromo(e.target.value)} placeholder={`Code promo (ex: ${PROMO_CODE})`} aria-label="Code promo"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPromo() } }}
                    style={{ flex: 1, minWidth: 0, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit', background: '#fff', color: s.dark }} />
                  <button type="button" onClick={applyPromo}
                    style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 10, padding: '0.5rem 0.9rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Appliquer</button>
                </div>
                <div style={{ fontSize: '0.75rem', color: s.mid, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>🔒 Paiement SSL 256 bits sécurisé</div>
                <div style={{ borderTop: `1px solid ${s.border}`, paddingTop: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}><span>{eur(selectedMeal.price_per_seat)} × {guests}</span><span>{eur(subtotal)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}><span>Frais de service</span><span>{eur(SERVICE_FEE)}</span></div>
                  {promoApplied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#38A169', marginBottom: '0.4rem' }}><span>🎉 Promo -10%</span><span>-{eur(discount)}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `2px solid ${s.border}`, paddingTop: '0.6rem', marginTop: '0.4rem' }}><span>Total</span><span>{eur(total)}</span></div>
                </div>
                <button type="submit" disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem' }}>
                  {loading ? 'Traitement…' : `Confirmer et payer — ${eur(total)}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toastMsg && (
        <div role="status" style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: s.dark, color: '#fff', padding: '0.7rem 1.5rem', borderRadius: 999, fontWeight: 600, fontSize: '0.88rem', zIndex: 500, maxWidth: 'calc(100vw - 2rem)', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toastMsg}
        </div>
      )}

      <footer style={{ background: s.dark, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '2rem', fontSize: '0.82rem', marginTop: '3rem' }}>
        <strong style={{ color: '#fff' }}>HomEat</strong> — Partagez une table, découvrez le monde 🌍<br />
        <span style={{ fontSize: '0.75rem' }}>© 2026 HomEat · CGU · Confidentialité · Aide</span>
      </footer>
    </div>
  )
}
