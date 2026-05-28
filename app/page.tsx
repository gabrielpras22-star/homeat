'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Meal = {
  id: string
  title: string
  cuisine: string
  price_per_seat: number
  available_seats: number
  date: string
  time: string
  city: string
  menu: string[]
  tags: string[]
  photo_url: string
  rating: number
  reviews_count: number
  description: string
  host_id: string
  profiles: {
    full_name: string
    avatar_url: string
    rating: number
    bio: string
  }
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
  meals: Meal
}

type Review = {
  id: string
  rating: number
  comment: string
  created_at: string
  profiles: { full_name: string }
}

const s = {
  terra: '#C4622D', sage: '#6B8F6B', cream: '#FAF6F0',
  dark: '#2C2416', mid: '#7A6652', border: '#EDE8E0',
}

const avatarColors = ['#C4622D','#C44444','#2d8659','#D4851A','#9C4400','#8B7355','#2E6DA4','#B34700']
const getColor = (name: string) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length]

const cuisineEmojis: Record<string, string> = {
  Marocaine:'🫔', Italienne:'🍕', Japonaise:'🍜', Mexicaine:'🌮',
  Indienne:'🍛', Française:'🥐', Libanaise:'🫒', Espagnole:'🥘', Autre:'🍽️'
}

export default function HomEat() {
  const [page, setPage] = useState('home')
  const [prevPage, setPrevPage] = useState('home')
  const [meals, setMeals] = useState<Meal[]>([])
  const [filtered, setFiltered] = useState<Meal[]>([])
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [mealReviews, setMealReviews] = useState<Review[]>([])
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [guests, setGuests] = useState(1)
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login')
  const [showAuth, setShowAuth] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payDone, setPayDone] = useState(false)
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
  const [dashTab, setDashTab] = useState('overview')
  const [msgInput, setMsgInput] = useState('')
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
  const [selectedConvUser, setSelectedConvUser] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const bubblesRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const nav = (p: string) => {
    setPrevPage(page)
    setPage(p)
    window.scrollTo(0, 0)
  }

  const goBack = () => nav(prevPage)

  // ── LOAD MEALS ──
  const loadMeals = async () => {
    const { data, error } = await supabase
      .from('meals')
      .select('*, profiles(full_name, avatar_url, rating, bio)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (data) { setMeals(data); setFiltered(data) }
  }

  // ── AUTH ──
  useEffect(() => {
    loadMeals()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { setUser(session.user); loadProfile(session.user.id) }
      else { setUser(null); setProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      setProfileFname(data.full_name?.split(' ')[0] || '')
      setProfileLname(data.full_name?.split(' ').slice(1).join(' ') || '')
      setProfileCity(data.city || '')
      setProfileBio(data.bio || '')
    }
  }

  const loadBookings = async () => {
    if (!user) return
    const { data } = await supabase.from('bookings').select('*, meals(*, profiles(full_name))').eq('guest_id', user.id).order('created_at', { ascending: false })
    if (data) setBookings(data)
  }

  const loadFavorites = async () => {
    if (!user) return
    const { data } = await supabase.from('favorites').select('meal_id, meals(*, profiles(full_name, avatar_url, rating))').eq('user_id', user.id)
    if (data) setFavMeals(data.map((f: any) => f.meals).filter(Boolean))
  }

  const loadMealReviews = async (mealId: string) => {
    const { data } = await supabase.from('reviews').select('*, profiles(full_name)').eq('meal_id', mealId).order('created_at', { ascending: false })
    if (data) setMealReviews(data)
  }

  const loadHostStats = async () => {
    if (!user) return
    const { data: hostMeals } = await supabase.from('meals').select('id').eq('host_id', user.id)
    const { data: hostBookings } = await supabase.from('bookings').select('total_amount').eq('status', 'confirmed')
    const { data: hostProfile } = await supabase.from('profiles').select('rating').eq('id', user.id).single()
    setHostStats({
      meals: hostMeals?.length || 0,
      revenue: hostBookings?.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0,
      rating: hostProfile?.rating || 0
    })
  }

  const loadConversations = async () => {
    if (!user) return
    const { data } = await supabase.from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name), receiver:profiles!messages_receiver_id_fkey(full_name)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (data) {
      const convMap: any = {}
      data.forEach((m: any) => {
        const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id
        const otherName = m.sender_id === user.id ? m.receiver?.full_name : m.sender?.full_name
        if (!convMap[otherId]) convMap[otherId] = { id: otherId, name: otherName, lastMsg: m.content }
      })
      setConversations(Object.values(convMap))
    }
  }

  const loadMessages = async (otherUserId: string) => {
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    if (data) {
      setMessages(data)
      setTimeout(() => { if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight }, 100)
    }
    // Subscribe realtime
    supabase.channel('messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new as Message
      if ((m.sender_id === user.id && m.receiver_id === otherUserId) || (m.sender_id === otherUserId && m.receiver_id === user.id)) {
        setMessages(prev => [...prev, m])
        setTimeout(() => { if (bubblesRef.current) bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight }, 100)
      }
    }).subscribe()
  }

  // ── FILTER ──
  const applyFilter = (cuisine: string, city: string) => {
    let r = meals
    if (cuisine !== 'all') r = r.filter(m => m.cuisine === cuisine)
    if (city) r = r.filter(m => m.city?.toLowerCase().includes(city.toLowerCase()))
    setFiltered(r)
  }

  // ── AUTH ACTIONS ──
  const doLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    setShowAuth(false)
    showToast('👋 Bienvenue !')
    setEmail(''); setPassword('')
  }

  const doSignup = async () => {
    if (password.length < 8) { showToast('⚠️ Mot de passe trop court (8 car. min)'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    setShowAuth(false)
    showToast('🎉 Compte créé ! Vérifiez votre email.')
    setEmail(''); setPassword(''); setFullName('')
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    nav('home')
    showToast('À bientôt !')
  }

  // ── BOOKING ──
  const createBooking = async () => {
    if (!user || !selectedMeal) return
    setLoading(true)
    const total = selectedMeal.price_per_seat * guests + 2
    const { error } = await supabase.from('bookings').insert({
      meal_id: selectedMeal.id,
      guest_id: user.id,
      seats: guests,
      total_amount: promoApplied ? total - Math.round(selectedMeal.price_per_seat * guests * 0.1) : total,
      status: 'confirmed'
    })
    setLoading(false)
    if (error) { showToast('❌ Erreur : ' + error.message); return }
    setPayDone(true)
    loadMeals()
  }

  // ── FAVORITE ──
  const toggleFavorite = async (mealId: string) => {
    if (!user) { setShowAuth(true); return }
    const exists = favMeals.find(m => m.id === mealId)
    if (exists) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('meal_id', mealId)
      setFavMeals(prev => prev.filter(m => m.id !== mealId))
      showToast('💔 Retiré des favoris')
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, meal_id: mealId })
      showToast('❤️ Ajouté aux favoris')
      loadFavorites()
    }
  }

  // ── MESSAGE ──
  const sendMessage = async () => {
    if (!msgInput.trim() || !user || !selectedConvUser) return
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedConvUser.id,
      content: msgInput,
      meal_id: selectedMeal?.id || null
    })
    setMsgInput('')
  }

  // ── HOST MEAL ──
  const publishMeal = async () => {
    if (!user || !hostTitle || !hostPrice || !hostDate || !hostSeats || !hostCity) {
      showToast('⚠️ Remplissez tous les champs obligatoires'); return
    }
    setLoading(true)
    const { error } = await supabase.from('meals').insert({
      host_id: user.id,
      title: hostTitle,
      cuisine: hostCuisine,
      price_per_seat: parseFloat(hostPrice),
      max_seats: parseInt(hostSeats),
      available_seats: parseInt(hostSeats),
      date: hostDate,
      time: hostTime,
      city: hostCity,
      description: hostDesc,
      menu: hostMenu.split('\n').filter(Boolean),
      tags: [],
      is_active: true,
      photo_url: cuisineEmojis[hostCuisine] || '🍽️'
    })
    setLoading(false)
    if (error) { showToast('❌ ' + error.message); return }
    showToast('🎉 Repas publié avec succès !')
    loadMeals()
    loadHostStats()
    setHostTitle(''); setHostPrice(''); setHostDate(''); setHostSeats(''); setHostCity(''); setHostDesc(''); setHostMenu('')
  }

  // ── SAVE PROFILE ──
  const saveProfile = async () => {
    if (!user) return
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profileFname + ' ' + profileLname,
      city: profileCity,
      bio: profileBio
    })
    if (error) { showToast('❌ ' + error.message); return }
    showToast('✅ Profil enregistré !')
    loadProfile(user.id)
  }

  const total = selectedMeal ? selectedMeal.price_per_seat * guests + 2 : 0
  const discounted = promoApplied ? total - Math.round((selectedMeal?.price_per_seat || 0) * guests * 0.1) : total

  // ── COMPONENTS ──
  const Inp = ({ placeholder, value, onChange, type = 'text' }: any) => (
    <input type={type} placeholder={placeholder} value={value} onChange={(e: any) => onChange(e.target.value)}
      style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', marginBottom: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box' }} />
  )

  const MealCard = ({ m }: { m: Meal }) => {
    const isFav = favMeals.some(f => f.id === m.id)
    return (
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', transition: 'transform 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
        <div onClick={() => { setSelectedMeal(m); setGuests(1); setPromoApplied(false); loadMealReviews(m.id); nav('detail') }}
          style={{ height: 170, background: `linear-gradient(135deg, ${getColor(m.profiles?.full_name || 'A')}88, ${getColor(m.profiles?.full_name || 'A')})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', position: 'relative' }}>
          {m.photo_url || '🍽️'}
          <div style={{ position: 'absolute', top: 10, left: 10, background: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
            ⭐ {m.rating > 0 ? m.rating.toFixed(1) : 'Nouveau'}
          </div>
          <div onClick={e => { e.stopPropagation(); toggleFavorite(m.id) }}
            style={{ position: 'absolute', top: 10, right: 10, background: '#fff', borderRadius: '50%', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', fontSize: '0.85rem' }}>
            {isFav ? '❤️' : '♡'}
          </div>
        </div>
        <div onClick={() => { setSelectedMeal(m); setGuests(1); setPromoApplied(false); loadMealReviews(m.id); nav('detail') }} style={{ padding: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: getColor(m.profiles?.full_name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>
              {m.profiles?.full_name?.charAt(0) || '?'}
            </div>
            <span style={{ fontSize: '0.78rem', color: s.mid }}>Chez {m.profiles?.full_name} · {m.city}</span>
          </div>
          <div style={{ fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.3 }}>{m.title}</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem', color: s.mid, marginBottom: '0.6rem' }}>
            <span>📅 {m.date}</span><span>👥 {m.available_seats} places</span>
            {m.tags?.slice(0, 2).map(t => <span key={t} style={{ background: s.cream, border: `1px solid ${s.border}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{t}</span>)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${s.border}`, paddingTop: '0.6rem' }}>
            <span style={{ fontWeight: 800 }}>{m.price_per_seat}€ <span style={{ fontWeight: 400, fontSize: '0.75rem', color: s.mid }}>/ couvert</span></span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>⭐ {m.rating > 0 ? m.rating.toFixed(1) : '—'} <span style={{ color: s.mid, fontWeight: 400 }}>({m.reviews_count})</span></span>
          </div>
        </div>
      </div>
    )
  }

  const Grid = ({ data }: { data: Meal[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
      {data.length === 0
        ? <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: s.mid }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
            <p style={{ fontWeight: 700 }}>Aucun repas disponible pour le moment</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Soyez le premier à proposer votre table !</p>
            <button onClick={() => nav('become')} style={{ marginTop: '1rem', background: s.sage, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Devenir hôte</button>
          </div>
        : data.map(m => <MealCard key={m.id} m={m} />)
      }
    </div>
  )

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", background: s.cream, minHeight: '100vh', color: s.dark }}>

      {/* ── NAV ── */}
      <nav style={{ background: '#fff', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${s.border}`, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div onClick={() => nav('home')} style={{ fontSize: '1.6rem', fontWeight: 900, color: s.terra, cursor: 'pointer', letterSpacing: -1 }}>
          Hom<span style={{ color: s.sage }}>Eat</span>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span onClick={() => nav('explore')} style={{ color: s.mid, fontSize: '0.88rem', cursor: 'pointer' }}>Explorer</span>
          <span onClick={() => { nav('messages'); if (user) loadConversations() }} style={{ color: s.mid, fontSize: '0.88rem', cursor: 'pointer' }}>Messages</span>
          <span onClick={() => nav('become')} style={{ color: s.mid, fontSize: '0.88rem', cursor: 'pointer' }}>Devenir hôte</span>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', color: s.mid }}>{profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
              <div onClick={() => { nav('dashboard'); loadBookings(); loadFavorites(); loadHostStats() }}
                style={{ width: 36, height: 36, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button onClick={() => { setAuthMode('login'); setShowAuth(true) }} style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 999, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>Connexion</button>
              <button onClick={() => { setAuthMode('signup'); setShowAuth(true) }} style={{ background: s.terra, border: 'none', color: '#fff', borderRadius: 999, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}>S'inscrire</button>
            </div>
          )}
        </div>
      </nav>

      {/* ══ HOME ══ */}
      {page === 'home' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #2C2416 0%, #5C3A1E 50%, #C4622D 100%)', padding: '5rem 2rem 4rem', textAlign: 'center', color: '#fff' }}>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}>🌍 Partagez une table, découvrez une culture</div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1rem' }}>Dînez chez l'<span style={{ color: '#E8845A' }}>habitant</span>,<br />découvrez une culture</h1>
            <p style={{ fontSize: '1rem', opacity: 0.85, maxWidth: 500, margin: '0 auto 2.5rem' }}>Trouvez un hôte qui partage sa table, sa cuisine et son histoire. Une expérience unique à chaque repas.</p>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.2rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: 680, margin: '0 auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>📍 Où ?</div>
                <input value={searchCity} onChange={e => setSearchCity(e.target.value)} placeholder="Bordeaux, Paris…" style={{ border: 'none', outline: 'none', fontSize: '0.92rem', width: '100%', fontFamily: 'inherit' }} />
              </div>
              <div style={{ width: 1, height: 36, background: s.border }} />
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>🍴 Cuisine</div>
                <select value={filterCuisine} onChange={e => setFilterCuisine(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.92rem', background: 'transparent', fontFamily: 'inherit' }}>
                  <option value="all">Toutes</option>
                  {Object.keys(cuisineEmojis).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={() => { applyFilter(filterCuisine, searchCity); nav('explore') }}
                style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                🔍 Rechercher
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', padding: '1.5rem', background: '#fff', flexWrap: 'wrap' }}>
            {[['🏠', 'Hôtes actifs', meals.length > 0 ? meals.length + '+' : '0'], ['🌍', 'Pays couverts', '1'], ['🍽️', 'Repas proposés', meals.length.toString()], ['⭐', 'Note moyenne', meals.length > 0 ? (meals.reduce((s, m) => s + (m.rating || 0), 0) / meals.filter(m => m.rating > 0).length || 0).toFixed(1) : '—']].map(([icon, label, val]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <strong style={{ display: 'block', fontSize: '1.4rem', color: s.terra, fontWeight: 800 }}>{icon} {val}</strong>
                <span style={{ fontSize: '0.8rem', color: s.mid }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>Explorez par cuisine</h2>
            <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
              {[['🍽️', 'Tout', 'all'], ...Object.entries(cuisineEmojis).map(([k, v]) => [v, k, k])].map(([icon, label, val]) => (
                <div key={val} onClick={() => { setFilterCuisine(val); applyFilter(val, searchCity) }}
                  style={{ flexShrink: 0, background: filterCuisine === val ? '#FEF3ED' : '#fff', border: `2px solid ${filterCuisine === val ? s.terra : s.border}`, borderRadius: 12, padding: '0.6rem 1rem', cursor: 'pointer', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '1.4rem' }}>{icon}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontWeight: 800 }}>✨ Repas disponibles</h2>
              <span onClick={() => nav('explore')} style={{ color: s.terra, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>Voir tout →</span>
            </div>
            <Grid data={filtered.slice(0, 4)} />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem', maxWidth: 1060, margin: '0 2rem 2rem', marginLeft: 'auto', marginRight: 'auto' }}>
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

          <div style={{ padding: '0 2rem 3rem', maxWidth: 1100, margin: '0 auto' }}>
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
          <div style={{ background: s.terra, color: '#fff', padding: '2rem' }}>
            <h1 style={{ fontWeight: 800, marginBottom: '1rem' }}>🍽️ Explorer les repas</h1>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              {['all', ...Object.keys(cuisineEmojis)].map(c => (
                <button key={c} onClick={() => { setFilterCuisine(c); applyFilter(c, searchCity) }}
                  style={{ background: filterCuisine === c ? '#fff' : 'rgba(255,255,255,0.2)', color: filterCuisine === c ? s.terra : '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '0.35rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  {c === 'all' ? 'Tous' : c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
            <p style={{ color: s.mid, fontSize: '0.88rem', marginBottom: '1.2rem' }}>{filtered.length} repas disponible{filtered.length > 1 ? 's' : ''}</p>
            <Grid data={filtered} />
          </div>
        </div>
      )}

      {/* ══ DETAIL ══ */}
      {page === 'detail' && selectedMeal && (
        <div>
          <div style={{ height: 260, background: `linear-gradient(135deg, ${getColor(selectedMeal.profiles?.full_name || 'A')}88, ${getColor(selectedMeal.profiles?.full_name || 'A')})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', position: 'relative' }}>
            <button onClick={goBack} style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: 600 }}>← Retour</button>
            {selectedMeal.photo_url || '🍽️'}
          </div>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: '0.5rem' }}>{selectedMeal.title}</h1>
            <div style={{ display: 'flex', gap: '0.8rem', color: s.mid, fontSize: '0.88rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <span>📍 {selectedMeal.city}</span><span>🍴 {selectedMeal.cuisine}</span>
              <span>📅 {selectedMeal.date} à {selectedMeal.time}</span>
              <span>👥 {selectedMeal.available_seats} places dispo</span>
              {selectedMeal.rating > 0 && <span>⭐ {selectedMeal.rating.toFixed(1)} ({selectedMeal.reviews_count} avis)</span>}
            </div>

            {selectedMeal.description && <p style={{ color: s.mid, lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.92rem' }}>{selectedMeal.description}</p>}

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: s.cream, borderRadius: 16, padding: '1.1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: getColor(selectedMeal.profiles?.full_name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>
                {selectedMeal.profiles?.full_name?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{selectedMeal.profiles?.full_name} <span style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>✓ Vérifié</span></div>
                {selectedMeal.profiles?.bio && <div style={{ fontSize: '0.8rem', color: s.mid, marginTop: '0.2rem' }}>{selectedMeal.profiles.bio}</div>}
              </div>
              <button onClick={() => {
                if (!user) { setShowAuth(true); return }
                setSelectedConvUser({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name })
                nav('messages')
                loadMessages(selectedMeal.host_id)
              }} style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 10, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>💬 Message</button>
            </div>

            {selectedMeal.menu?.length > 0 && (
              <>
                <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>🍽️ Au menu</h3>
                <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
                  {selectedMeal.menu.map((item, i) => (
                    <li key={i} style={{ padding: '0.55rem 0', borderBottom: `1px solid ${s.border}`, fontSize: '0.9rem' }}>✦ {item}</li>
                  ))}
                </ul>
              </>
            )}

            <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>⭐ Avis</h3>
            {mealReviews.length === 0
              ? <p style={{ color: s.mid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>Aucun avis pour l'instant. Soyez le premier !</p>
              : mealReviews.map(r => (
                <div key={r.id} style={{ background: s.cream, borderRadius: 12, padding: '1rem', marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: getColor(r.profiles?.full_name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{r.profiles?.full_name?.charAt(0) || '?'}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.profiles?.full_name}</div>
                      <div style={{ color: '#F6AD55', fontSize: '0.82rem' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: s.mid }}>{new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                  {r.comment && <p style={{ fontSize: '0.85rem', color: s.mid }}>{r.comment}</p>}
                </div>
              ))
            }

            <div style={{ background: '#fff', border: `2px solid ${s.border}`, borderRadius: 20, padding: '1.5rem', marginTop: '2rem' }}>
              <h3 style={{ fontWeight: 800, marginBottom: '1rem' }}>Réserver votre couvert</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.7rem' }}>
                <span>Nombre de convives</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <button onClick={() => setGuests(Math.max(1, guests - 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${s.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>−</button>
                  <span style={{ fontWeight: 700 }}>{guests}</span>
                  <button onClick={() => setGuests(Math.min(selectedMeal.available_seats, guests + 1))} style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${s.border}`, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>+</button>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}><span>{selectedMeal.price_per_seat}€ × {guests}</span><span>{selectedMeal.price_per_seat * guests}€</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.7rem' }}><span>Frais de service</span><span>2€</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `2px solid ${s.border}`, paddingTop: '0.7rem' }}><span>Total</span><span>{total}€</span></div>
              <button onClick={() => { if (!user) { setShowAuth(true); showToast('Connectez-vous pour réserver') } else { setPayDone(false); setShowPayment(true) } }}
                style={{ width: '100%', marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                💳 Réserver & Payer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MESSAGES ══ */}
      {page === 'messages' && (
        <div style={{ maxWidth: 900, margin: '2rem auto', padding: '0 2rem' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>💬 Messages</h2>
          {!user ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 16 }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
              <p style={{ color: s.mid, marginBottom: '1rem' }}>Connectez-vous pour accéder à vos messages</p>
              <button onClick={() => setShowAuth(true)} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Se connecter</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: conversations.length > 0 ? '260px 1fr' : '1fr', gap: '1rem' }}>
              {conversations.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                  <div style={{ padding: '1rem', borderBottom: `1px solid ${s.border}`, fontWeight: 800 }}>Conversations</div>
                  {conversations.map(c => (
                    <div key={c.id} onClick={() => { setSelectedConvUser(c); loadMessages(c.id) }}
                      style={{ display: 'flex', gap: '0.7rem', padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: `1px solid ${s.border}`, background: selectedConvUser?.id === c.id ? s.cream : '#fff' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: getColor(c.name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>{c.name?.charAt(0) || '?'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.name}</div>
                        <div style={{ fontSize: '0.78rem', color: s.mid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMsg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
                {selectedConvUser ? (
                  <>
                    <div style={{ padding: '1rem', borderBottom: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: getColor(selectedConvUser.name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{selectedConvUser.name?.charAt(0) || '?'}</div>
                      <div style={{ fontWeight: 700 }}>{selectedConvUser.name}</div>
                    </div>
                    <div ref={bubblesRef} style={{ flex: 1, minHeight: 300, maxHeight: 400, overflowY: 'auto', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                      {messages.map((msg, i) => (
                        <div key={i} style={{ maxWidth: '70%', padding: '0.7rem 1rem', borderRadius: 18, fontSize: '0.88rem', lineHeight: 1.5, alignSelf: msg.sender_id === user.id ? 'flex-end' : 'flex-start', background: msg.sender_id === user.id ? s.terra : s.cream, color: msg.sender_id === user.id ? '#fff' : s.dark }}>
                          {msg.content}
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '1rem', borderTop: `1px solid ${s.border}`, display: 'flex', gap: '0.7rem' }}>
                      <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Écrivez un message…"
                        style={{ flex: 1, border: `1.5px solid ${s.border}`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} />
                      <button onClick={sendMessage} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.55rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Envoyer</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: s.mid, flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '3rem' }}>💬</div>
                    <p>Sélectionnez une conversation ou contactez un hôte depuis la page d'un repas</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ DASHBOARD ══ */}
      {page === 'dashboard' && (
        <div style={{ maxWidth: 1060, margin: '2rem auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
          {!user ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 16 }}>
              <p style={{ color: s.mid, marginBottom: '1rem' }}>Connectez-vous pour accéder à votre tableau de bord</p>
              <button onClick={() => setShowAuth(true)} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>Se connecter</button>
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.2rem', height: 'fit-content', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: `1px solid ${s.border}`, marginBottom: '0.8rem' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>
                    {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ fontWeight: 700 }}>{profile?.full_name || user.email}</div>
                  <div style={{ fontSize: '0.75rem', color: s.mid }}>Membre HomEat</div>
                </div>
                {[['overview','📊','Vue d\'ensemble'],['bookings','🍽️','Réservations'],['favorites','❤️','Favoris'],['profile','👤','Mon profil'],['host','🏠','Espace hôte']].map(([id,icon,label]) => (
                  <div key={id} onClick={() => { setDashTab(id); if (id === 'bookings') loadBookings(); if (id === 'favorites') loadFavorites(); if (id === 'host') loadHostStats() }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', fontWeight: dashTab === id ? 700 : 500, background: dashTab === id ? s.cream : 'transparent', color: dashTab === id ? s.terra : s.dark, marginBottom: '0.3rem' }}>
                    <span>{icon}</span>{label}
                  </div>
                ))}
                <div onClick={doLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', color: '#E53E3E', marginTop: '1rem' }}>🚪 Déconnexion</div>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
                {dashTab === 'overview' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Bonjour {profile?.full_name?.split(' ')[0] || ''} 👋</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {[[bookings.length.toString(), 'Réservations'],[favMeals.length.toString(), 'Favoris'],[meals.length.toString(), 'Repas dispo']].map(([v,l]) => (
                        <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                          <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                          <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Repas disponibles</h3>
                    <Grid data={meals.slice(0, 3)} />
                  </div>
                )}

                {dashTab === 'bookings' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🍽️ Mes réservations</h2>
                    {bookings.length === 0
                      ? <div style={{ textAlign: 'center', padding: '2rem', color: s.mid }}><div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>🍽️</div><p>Aucune réservation pour l'instant</p><button onClick={() => nav('explore')} style={{ marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Explorer les repas</button></div>
                      : bookings.map(b => (
                        <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem', border: `1.5px solid ${s.border}`, borderRadius: 12, marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '2rem' }}>{b.meals?.photo_url || '🍽️'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.meals?.title}</div>
                            <div style={{ fontSize: '0.78rem', color: s.mid }}>📍 {b.meals?.city} · {b.seats} couvert(s) · {b.total_amount}€</div>
                          </div>
                          <span style={{ background: b.status === 'confirmed' ? '#E8F5E9' : b.status === 'pending' ? '#EBF8FF' : '#f0f0f0', color: b.status === 'confirmed' ? '#38A169' : b.status === 'pending' ? '#3182CE' : s.mid, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
                            {b.status === 'confirmed' ? 'Confirmé' : b.status === 'pending' ? 'En attente' : 'Terminé'}
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
                      ? <div style={{ textAlign: 'center', padding: '2rem', color: s.mid }}><div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>❤️</div><p>Aucun favori pour l'instant</p></div>
                      : <Grid data={favMeals} />
                    }
                  </div>
                )}

                {dashTab === 'profile' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>👤 Mon profil</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <Inp placeholder="Prénom" value={profileFname} onChange={setProfileFname} />
                      <Inp placeholder="Nom" value={profileLname} onChange={setProfileLname} />
                    </div>
                    <Inp placeholder="Email" value={user.email} onChange={() => {}} type="email" />
                    <Inp placeholder="Ville" value={profileCity} onChange={setProfileCity} />
                    <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Parlez de vous, vos passions culinaires…" rows={3}
                      style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '1rem', boxSizing: 'border-box' }} />
                    <button onClick={saveProfile} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer' }}>💾 Enregistrer</button>
                  </div>
                )}

                {dashTab === 'host' && (
                  <div>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🏠 Espace hôte</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      {[[hostStats.meals.toString(), 'Repas proposés'],[hostStats.revenue + '€', 'Revenus totaux'],[hostStats.rating > 0 ? hostStats.rating.toFixed(1) + '⭐' : '—', 'Note hôte']].map(([v,l]) => (
                        <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                          <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                          <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                        </div>
                      ))}
                    </div>
                    <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Proposer un nouveau repas</h3>
                    <Inp placeholder="Titre du repas *" value={hostTitle} onChange={setHostTitle} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <select value={hostCuisine} onChange={e => setHostCuisine(e.target.value)} style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', marginBottom: '0.8rem', fontFamily: 'inherit', boxSizing: 'border-box' }}>
                          {Object.keys(cuisineEmojis).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <Inp placeholder="Prix / couvert (€) *" value={hostPrice} onChange={setHostPrice} type="number" />
                    </div>
                    <Inp placeholder="Ville *" value={hostCity} onChange={setHostCity} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <Inp placeholder="Date *" value={hostDate} onChange={setHostDate} type="date" />
                      <Inp placeholder="Heure" value={hostTime} onChange={setHostTime} type="time" />
                    </div>
                    <Inp placeholder="Nombre de couverts *" value={hostSeats} onChange={setHostSeats} type="number" />
                    <textarea value={hostDesc} onChange={e => setHostDesc(e.target.value)} placeholder="Description du repas, ambiance…" rows={3}
                      style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.8rem', boxSizing: 'border-box' }} />
                    <textarea value={hostMenu} onChange={e => setHostMenu(e.target.value)} placeholder={"Menu (1 plat par ligne) :\nEntrée : Salade composée\nPlat : Poulet rôti\nDessert : Tarte maison"} rows={4}
                      style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '0.8rem', boxSizing: 'border-box' }} />
                    <button onClick={publishMeal} disabled={loading}
                      style={{ width: '100%', background: loading ? '#ccc' : s.sage, color: '#fff', border: 'none', borderRadius: 12, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                      {loading ? 'Publication…' : '🎉 Publier mon repas'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ BECOME ══ */}
      {page === 'become' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #6B8F6B, #3D6B45)', color: '#fff', padding: '4rem 2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>🏠 Partagez votre table</h1>
            <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto 2rem', fontSize: '1rem' }}>Rencontrez des gens du monde entier et gagnez un revenu complémentaire.</p>
          </div>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem', textAlign: 'center' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {[['💶','#FEF3ED','Revenus complémentaires','Gagnez selon vos disponibilités.'],['🌍','#E8F5E9','Rencontres mondiales','Accueillez des voyageurs curieux.'],['🛡️','#EBF8FF','Sécurité garantie','Profils vérifiés, paiements sécurisés.']].map(([icon,bg,title,desc]) => (
                <div key={title} style={{ textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem' }}>{icon}</div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.85rem', color: s.mid }}>{desc}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { if (user) { nav('dashboard'); setDashTab('host') } else { setAuthMode('signup'); setShowAuth(true) } }}
              style={{ background: s.sage, color: '#fff', border: 'none', borderRadius: 999, padding: '0.85rem 2.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
              {user ? 'Proposer un repas →' : 'Créer mon profil hôte →'}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL AUTH ══ */}
      {showAuth && (
        <div onClick={e => e.target === e.currentTarget && setShowAuth(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowAuth(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: s.mid }}>✕</button>
            <div style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '0.5rem' }}>🍴</div>
            <h2 style={{ textAlign: 'center', fontWeight: 800, marginBottom: '0.3rem' }}>Bienvenue sur HomEat</h2>
            <p style={{ textAlign: 'center', color: s.mid, fontSize: '0.85rem', marginBottom: '1.3rem' }}>La table qui unit les cultures</p>
            <div style={{ display: 'flex', border: `1.5px solid ${s.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: '1.5rem' }}>
              {(['login','signup'] as const).map(t => (
                <div key={t} onClick={() => setAuthMode(t)}
                  style={{ flex: 1, padding: '0.55rem', textAlign: 'center', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', background: authMode === t ? s.terra : 'transparent', color: authMode === t ? '#fff' : s.dark }}>
                  {t === 'login' ? 'Connexion' : 'Inscription'}
                </div>
              ))}
            </div>
            {authMode === 'login' ? (
              <div>
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" />
                <Inp placeholder="Mot de passe" value={password} onChange={setPassword} type="password" />
                <button onClick={doLogin} disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                  {loading ? 'Connexion…' : 'Se connecter'}
                </button>
              </div>
            ) : (
              <div>
                <Inp placeholder="Prénom et nom" value={fullName} onChange={setFullName} />
                <Inp placeholder="Email" value={email} onChange={setEmail} type="email" />
                <Inp placeholder="Mot de passe (8 car. min)" value={password} onChange={setPassword} type="password" />
                <p style={{ fontSize: '0.75rem', color: s.mid, marginBottom: '1rem' }}>En créant un compte, vous acceptez les CGU.</p>
                <button onClick={doSignup} disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}>
                  {loading ? 'Création…' : 'Créer mon compte'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL PAYMENT ══ */}
      {showPayment && selectedMeal && (
        <div onClick={e => e.target === e.currentTarget && setShowPayment(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: '2rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setShowPayment(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: s.mid }}>✕</button>
            {payDone ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Réservation confirmée !</h2>
                <p style={{ color: s.mid, marginBottom: '1.5rem' }}>Votre repas chez <strong>{selectedMeal.profiles?.full_name}</strong> est confirmé pour <strong>{guests} couvert(s)</strong>.</p>
                <div style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.5rem 1.2rem', display: 'inline-block', fontWeight: 700, marginBottom: '1.5rem' }}>✅ Paiement accepté</div>
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { setShowPayment(false); nav('dashboard'); setDashTab('bookings'); loadBookings() }} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Mes réservations</button>
                  <button onClick={() => { setShowPayment(false); setSelectedConvUser({ id: selectedMeal.host_id, name: selectedMeal.profiles?.full_name }); nav('messages'); loadMessages(selectedMeal.host_id) }}
                    style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>💬 Contacter l'hôte</button>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>💳 Paiement sécurisé</h2>
                <div style={{ display: 'flex', gap: '0.7rem', background: s.cream, borderRadius: 12, padding: '0.9rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>{selectedMeal.photo_url || '🍽️'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{selectedMeal.title}</div>
                    <div style={{ fontSize: '0.78rem', color: s.mid }}>Chez {selectedMeal.profiles?.full_name} · {guests} couvert(s)</div>
                  </div>
                </div>
                <Inp placeholder="Numéro de carte" value={cardNum} onChange={(v: string) => setCardNum(v.replace(/\D/g,'').substring(0,16).replace(/(.{4})/g,'$1 ').trim())} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <Inp placeholder="MM / AA" value={cardExp} onChange={setCardExp} />
                  <Inp placeholder="CVV" value={cardCvv} onChange={setCardCvv} type="password" />
                </div>
                <Inp placeholder="Nom sur la carte" value={cardName} onChange={setCardName} />
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                  <input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Code promo (ex: HOMEAT10)"
                    style={{ flex: 1, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} />
                  <button onClick={() => { if (promo.toUpperCase() === 'HOMEAT10') { setPromoApplied(true); showToast('🎉 -10% appliqué !') } else showToast('❌ Code invalide') }}
                    style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 10, padding: '0.5rem 0.9rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Appliquer</button>
                </div>
                <div style={{ fontSize: '0.75rem', color: s.mid, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>🔒 Paiement SSL 256 bits sécurisé</div>
                <div style={{ borderTop: `1px solid ${s.border}`, paddingTop: '0.8rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}><span>{selectedMeal.price_per_seat}€ × {guests}</span><span>{selectedMeal.price_per_seat * guests}€</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.4rem' }}><span>Frais de service</span><span>2€</span></div>
                  {promoApplied && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#38A169', marginBottom: '0.4rem' }}><span>🎉 Promo -10%</span><span>-{Math.round(selectedMeal.price_per_seat * guests * 0.1)}€</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `2px solid ${s.border}`, paddingTop: '0.6rem', marginTop: '0.4rem' }}><span>Total</span><span>{discounted}€</span></div>
                </div>
                <button onClick={() => { if (!cardNum || cardNum.replace(/\s/g,'').length < 16) { showToast('⚠️ Numéro de carte invalide'); return }; if (!cardName) { showToast('⚠️ Entrez le nom sur la carte'); return }; createBooking() }} disabled={loading}
                  style={{ width: '100%', background: loading ? '#ccc' : s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1rem' }}>
                  {loading ? 'Traitement…' : `Confirmer et payer — ${discounted}€`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: s.dark, color: '#fff', padding: '0.7rem 1.5rem', borderRadius: 999, fontWeight: 600, fontSize: '0.88rem', zIndex: 500, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toastMsg}
        </div>
      )}

      <footer style={{ background: s.dark, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '2rem', fontSize: '0.82rem', marginTop: '3rem' }}>
        <strong style={{ color: '#fff' }}>HomEat</strong> — Partagez une table, découvrez le monde 🌍<br />
        <span style={{ fontSize: '0.75rem' }}>© 2025 HomEat · CGU · Confidentialité · Aide</span>
      </footer>
    </div>
  )
}