'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── TYPES ──
type Meal = {
  id: string
  title: string
  cuisine: string
  price_per_seat: number
  available_seats: number
  date: string
  city: string
  menu: string[]
  tags: string[]
  photo_url: string
  rating: number
  reviews_count: number
  host: {
    full_name: string
    avatar_url: string
    rating: number
  }
}

type User = {
  id: string
  email: string
  full_name: string
}

// ── DEMO MEALS (affiché tant que Supabase est vide) ──
const demoMeals: Meal[] = [
  { id: '1', title: "Tajine d'agneau aux pruneaux", cuisine: 'Marocaine', price_per_seat: 18, available_seats: 2, date: 'Ce soir', city: 'Bordeaux', menu: ["Harira", "Tajine pruneaux", "Pastilla"], tags: ['Authentique', 'Fait maison'], photo_url: '🥘', rating: 4.9, reviews_count: 47, host: { full_name: 'Fatima B.', avatar_url: 'F', rating: 4.9 } },
  { id: '2', title: 'Soirée pâtes fraîches', cuisine: 'Italienne', price_per_seat: 22, available_seats: 4, date: 'Demain', city: 'Lyon', menu: ["Bruschetta", "Tagliatelles truffe", "Tiramisu"], tags: ['Végétarien'], photo_url: '🍝', rating: 4.8, reviews_count: 31, host: { full_name: 'Marco V.', avatar_url: 'M', rating: 4.8 } },
  { id: '3', title: 'Ramen maison Tokyo', cuisine: 'Japonaise', price_per_seat: 26, available_seats: 3, date: 'Vendredi', city: 'Paris', menu: ["Gyoza", "Ramen tonkotsu", "Mochi"], tags: ['⭐ Top hôte'], photo_url: '🍜', rating: 5.0, reviews_count: 89, host: { full_name: 'Yuki T.', avatar_url: 'Y', rating: 5.0 } },
  { id: '4', title: 'Taqueria familiale', cuisine: 'Mexicaine', price_per_seat: 15, available_seats: 5, date: 'Samedi', city: 'Toulouse', menu: ["Guacamole", "Tacos variés", "Churros"], tags: ['Budget'], photo_url: '🌮', rating: 4.7, reviews_count: 22, host: { full_name: 'Ana R.', avatar_url: 'A', rating: 4.7 } },
  { id: '5', title: 'Curry & naans tandoor', cuisine: 'Indienne', price_per_seat: 19, available_seats: 2, date: 'Dimanche', city: 'Bordeaux', menu: ["Samossas", "Dal makhani", "Kheer"], tags: ['Végétarien', 'Épicé'], photo_url: '🍛', rating: 4.9, reviews_count: 56, host: { full_name: 'Priya S.', avatar_url: 'P', rating: 4.9 } },
  { id: '6', title: 'Dîner bordelais', cuisine: 'Française', price_per_seat: 32, available_seats: 4, date: 'Vendredi', city: 'Bordeaux', menu: ["Foie gras", "Entrecôte bordelaise", "Bordeaux inclus"], tags: ['Vin inclus', 'Local'], photo_url: '🥐', rating: 4.8, reviews_count: 18, host: { full_name: 'Pierre L.', avatar_url: 'P', rating: 4.8 } },
]

const cuisineEmojis: Record<string, string> = {
  Marocaine: '🫔', Italienne: '🍕', Japonaise: '🍜',
  Mexicaine: '🌮', Indienne: '🍛', Française: '🥐',
  Libanaise: '🫒', Espagnole: '🥘'
}

const avatarColors = ['#C4622D','#C44444','#2d8659','#D4851A','#9C4400','#8B7355','#2E6DA4','#B34700']
const getColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length]

export default function HomEat() {
  const [page, setPage] = useState('home')
  const [prevPage, setPrevPage] = useState('home')
  const [meals, setMeals] = useState<Meal[]>(demoMeals)
  const [filtered, setFiltered] = useState<Meal[]>(demoMeals)
  const [selectedMeal, setSelectedMeal] = useState<Meal | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [guests, setGuests] = useState(1)
  const [authMode, setAuthMode] = useState<'login'|'signup'>('login')
  const [showAuth, setShowAuth] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payDone, setPayDone] = useState(false)
  const [toast, setToast] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [cardNum, setCardNum] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [filterCuisine, setFilterCuisine] = useState('all')
  const [searchCity, setSearchCity] = useState('')
  const [dashTab, setDashTab] = useState('overview')
  const [msgInput, setMsgInput] = useState('')
  const [messages, setMessages] = useState([
    { from: 'host', text: 'Bonjour ! Ravi de vous accueillir 😊' },
    { from: 'host', text: "N'hésitez pas si vous avez des allergies." },
  ])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const nav = (p: string) => {
    setPrevPage(page)
    setPage(p)
    window.scrollTo(0, 0)
  }

  const goBack = () => nav(prevPage)

  // Charger les repas depuis Supabase si disponible
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('meals')
        .select('*, host:profiles(full_name, avatar_url, rating)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (data && data.length > 0) {
        setMeals(data)
        setFiltered(data)
      }
    }
    load()

    // Auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email!, full_name: session.user.user_metadata?.full_name || session.user.email! })
      }
    })
  }, [])

  const applyFilter = (cuisine: string, city: string) => {
    let r = meals
    if (cuisine !== 'all') r = r.filter(m => m.cuisine === cuisine)
    if (city) r = r.filter(m => m.city.toLowerCase().includes(city.toLowerCase()))
    setFiltered(r)
  }

  const doLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { showToast('❌ ' + error.message); return }
    const u = data.user
    setUser({ id: u.id, email: u.email!, full_name: u.user_metadata?.full_name || u.email! })
    setShowAuth(false)
    showToast('👋 Bienvenue !')
  }

  const doSignup = async () => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    if (error) { showToast('❌ ' + error.message); return }
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email!, full_name: fullName })
      setShowAuth(false)
      showToast('🎉 Compte créé ! Bienvenue ' + fullName + ' !')
    }
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    nav('home')
    showToast('À bientôt !')
  }

  const sendMessage = () => {
    if (!msgInput.trim()) return
    if (!user) { setShowAuth(true); return }
    setMessages(prev => [...prev, { from: 'user', text: msgInput }])
    setMsgInput('')
    setTimeout(() => {
      const replies = ['Avec plaisir !', 'Bien sûr 😊', 'À très bientôt !', 'Parfait, je note !']
      setMessages(prev => [...prev, { from: 'host', text: replies[Math.floor(Math.random() * replies.length)] }])
    }, 1000)
  }

  const total = selectedMeal ? selectedMeal.price_per_seat * guests + 2 : 0
  const discounted = promoApplied ? total - Math.round(selectedMeal!.price_per_seat * guests * 0.1) : total

  // ── STYLES ──
  const s = {
    terra: '#C4622D', sage: '#6B8F6B', cream: '#FAF6F0',
    dark: '#2C2416', mid: '#7A6652', border: '#EDE8E0',
  }

  const btn = (color: string, text: string, onClick: () => void, full = false) => (
    <button onClick={onClick} style={{ background: color, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', width: full ? '100%' : 'auto', marginTop: full ? '0.5rem' : 0 }}>{text}</button>
  )

  const input = (placeholder: string, value: string, onChange: (v: string) => void, type = 'text') => (
    <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', marginBottom: '0.8rem', fontFamily: 'inherit' }} />
  )

  // ── MEAL CARD ──
  const MealCard = ({ m }: { m: Meal }) => (
    <div onClick={() => { setSelectedMeal(m); setGuests(1); nav('detail') }}
      style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', transition: 'transform 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
      <div style={{ height: 170, background: `linear-gradient(135deg, ${getColor(m.host?.full_name || 'A')}88, ${getColor(m.host?.full_name || 'A')})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', position: 'relative' }}>
        {m.photo_url?.length <= 2 ? m.photo_url : '🍽️'}
        <div style={{ position: 'absolute', top: 10, left: 10, background: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>⭐ {m.rating}</div>
      </div>
      <div style={{ padding: '0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: getColor(m.host?.full_name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{m.host?.full_name?.charAt(0) || '?'}</div>
          <span style={{ fontSize: '0.78rem', color: s.mid }}>Chez {m.host?.full_name} · {m.city}</span>
        </div>
        <div style={{ fontWeight: 700, marginBottom: '0.35rem', lineHeight: 1.3 }}>{m.title}</div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: s.mid, marginBottom: '0.6rem' }}>
          <span>📅 {m.date}</span><span>👥 {m.available_seats} places</span>
          {m.tags?.slice(0, 2).map(t => <span key={t} style={{ background: s.cream, border: `1px solid ${s.border}`, borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{t}</span>)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${s.border}`, paddingTop: '0.6rem' }}>
          <span style={{ fontWeight: 800 }}>{m.price_per_seat}€ <span style={{ fontWeight: 400, fontSize: '0.75rem', color: s.mid }}>/ couvert</span></span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>⭐ {m.rating} <span style={{ color: s.mid, fontWeight: 400 }}>({m.reviews_count})</span></span>
        </div>
      </div>
    </div>
  )

  const Grid = ({ data }: { data: Meal[] }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.2rem' }}>
      {data.map(m => <MealCard key={m.id} m={m} />)}
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
          {['explore', 'map', 'messages', 'become'].map(p => (
            <span key={p} onClick={() => nav(p)} style={{ color: s.mid, fontSize: '0.88rem', cursor: 'pointer', padding: '0.3rem 0.5rem' }}>
              {p === 'explore' ? 'Explorer' : p === 'map' ? 'Carte' : p === 'messages' ? 'Messages' : 'Devenir hôte'}
            </span>
          ))}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.85rem', color: s.mid }}>{user.full_name.split(' ')[0]}</span>
              <div onClick={() => nav('dashboard')} style={{ width: 36, height: 36, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, cursor: 'pointer', border: `2px solid ${s.terra}` }}>
                {user.full_name.charAt(0).toUpperCase()}
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
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.8rem', marginBottom: '1.5rem' }}>🌍 Disponible dans 42 pays</div>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1rem' }}>Dînez chez l'<span style={{ color: '#E8845A' }}>habitant</span>,<br />découvrez une culture</h1>
            <p style={{ fontSize: '1rem', opacity: 0.85, maxWidth: 500, margin: '0 auto 2.5rem' }}>Trouvez un hôte qui partage sa table, sa cuisine et son histoire.</p>
            <div style={{ background: '#fff', borderRadius: 16, padding: '1.2rem 1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: 680, margin: '0 auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: s.dark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>📍 Où ?</div>
                <input value={searchCity} onChange={e => setSearchCity(e.target.value)} placeholder="Bordeaux, Paris…" style={{ border: 'none', outline: 'none', fontSize: '0.92rem', width: '100%', fontFamily: 'inherit' }} />
              </div>
              <div style={{ width: 1, height: 36, background: s.border }} />
              <div style={{ flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: s.dark, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.25rem' }}>🍴 Cuisine</div>
                <select value={filterCuisine} onChange={e => setFilterCuisine(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.92rem', background: 'transparent', fontFamily: 'inherit' }}>
                  <option value="all">Toutes</option>
                  {['Française','Marocaine','Italienne','Japonaise','Mexicaine','Indienne'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={() => { applyFilter(filterCuisine, searchCity); nav('explore') }}
                style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>
                🔍 Rechercher
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', padding: '1.5rem', background: '#fff', flexWrap: 'wrap' }}>
            {[['12 400+', 'Hôtes actifs'], ['42', 'Pays couverts'], ['98 000+', 'Repas partagés'], ['4.8 ⭐', 'Note moyenne']].map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center' }}><strong style={{ display: 'block', fontSize: '1.4rem', color: s.terra, fontWeight: 800 }}>{v}</strong><span style={{ fontSize: '0.8rem', color: s.mid }}>{l}</span></div>
            ))}
          </div>

          <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
            <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>Explorez par cuisine</h2>
            <div style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '2rem' }}>
              {[['🍽️', 'Tout', 'all'], ['🥐', 'Française', 'Française'], ['🍜', 'Japonaise', 'Japonaise'], ['🫔', 'Marocaine', 'Marocaine'], ['🍕', 'Italienne', 'Italienne'], ['🌮', 'Mexicaine', 'Mexicaine'], ['🍛', 'Indienne', 'Indienne']].map(([icon, label, val]) => (
                <div key={val} onClick={() => { setFilterCuisine(val); applyFilter(val, searchCity) }}
                  style={{ flexShrink: 0, background: filterCuisine === val ? '#FEF3ED' : '#fff', border: `2px solid ${filterCuisine === val ? s.terra : s.border}`, borderRadius: 12, padding: '0.6rem 1rem', cursor: 'pointer', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: '1.4rem' }}>{icon}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ fontWeight: 800 }}>✨ Expériences à la une</h2>
              <span onClick={() => nav('explore')} style={{ color: s.terra, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>Voir tout →</span>
            </div>
            <Grid data={filtered.slice(0, 4)} />
          </div>

          <div style={{ background: '#fff', borderRadius: 20, padding: '2.5rem', maxWidth: 1060, margin: '0 2rem 2rem', marginLeft: 'auto', marginRight: 'auto' }}>
            <h2 style={{ fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>Comment ça marche ?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem' }}>
              {[['🔍', '#FEF3ED', 'Cherchez', 'Filtrez par ville, cuisine, budget.'], ['💬', '#E8F5E9', 'Messagez', 'Discutez avec l\'hôte avant.'], ['💳', '#EBF8FF', 'Payez', 'Paiement 100% sécurisé.'], ['🍴', '#FFF8E1', 'Dînez', 'Vivez une expérience unique.'], ['⭐', '#F0E8FF', 'Évaluez', 'Laissez un avis après le repas.']].map(([icon, bg, title, desc]) => (
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
              <div><h2 style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Devenez hôte HomEat</h2><p style={{ opacity: 0.9, maxWidth: 400, fontSize: '0.9rem' }}>Partagez votre passion culinaire et gagnez un revenu complémentaire.</p></div>
              <button onClick={() => nav('become')} style={{ background: '#fff', color: '#6B8F6B', border: 'none', borderRadius: 999, padding: '0.8rem 1.8rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Commencer →</button>
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
              {['all', 'Française', 'Marocaine', 'Japonaise', 'Italienne', 'Mexicaine', 'Indienne'].map(c => (
                <button key={c} onClick={() => { setFilterCuisine(c); applyFilter(c, searchCity) }}
                  style={{ background: filterCuisine === c ? '#fff' : 'rgba(255,255,255,0.2)', color: filterCuisine === c ? s.terra : '#fff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, padding: '0.35rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                  {c === 'all' ? 'Tous' : c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
            <p style={{ color: s.mid, fontSize: '0.88rem', marginBottom: '1.2rem' }}>{filtered.length} expérience{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}</p>
            <Grid data={filtered} />
          </div>
        </div>
      )}

      {/* ══ MAP ══ */}
      {page === 'map' && (
        <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>🗺️ Carte des repas</h2>
          <div style={{ borderRadius: 16, overflow: 'hidden', height: 340, background: 'linear-gradient(180deg, #c8e6c9, #a5d6a7)', position: 'relative', marginBottom: '1.5rem' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, #81c784 39px, #81c784 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, #81c784 39px, #81c784 40px)' }} />
            {meals.map(m => (
              <div key={m.id} onClick={() => { setSelectedMeal(m); nav('detail') }}
                style={{ position: 'absolute', left: `${(m.id.charCodeAt(0) * 13) % 80 + 5}%`, top: `${(m.id.charCodeAt(1) * 17) % 70 + 10}%`, transform: 'translate(-50%, -100%)', cursor: 'pointer', zIndex: 10 }}>
                <div style={{ background: s.terra, color: '#fff', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: '0 3px 12px rgba(196,98,45,0.4)' }}>
                  {m.photo_url?.length <= 2 ? m.photo_url : '🍽️'} {m.price_per_seat}€
                </div>
                <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${s.terra}`, margin: '0 auto' }} />
              </div>
            ))}
          </div>
          <Grid data={meals.slice(0, 4)} />
        </div>
      )}

      {/* ══ DETAIL ══ */}
      {page === 'detail' && selectedMeal && (
        <div>
          <div style={{ height: 260, background: `linear-gradient(135deg, ${getColor(selectedMeal.host?.full_name || 'A')}88, ${getColor(selectedMeal.host?.full_name || 'A')})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', position: 'relative' }}>
            <button onClick={goBack} style={{ position: 'absolute', top: '1rem', left: '1rem', background: '#fff', borderRadius: 999, padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>← Retour</button>
            {selectedMeal.photo_url?.length <= 2 ? selectedMeal.photo_url : '🍽️'}
          </div>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 900, marginBottom: '0.5rem' }}>{selectedMeal.title}</h1>
            <div style={{ display: 'flex', gap: '0.8rem', color: s.mid, fontSize: '0.88rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <span>📍 {selectedMeal.city}</span><span>🍴 {selectedMeal.cuisine}</span>
              <span>📅 {selectedMeal.date}</span><span>👥 {selectedMeal.available_seats} places</span>
              <span>⭐ {selectedMeal.rating} ({selectedMeal.reviews_count} avis)</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: s.cream, borderRadius: 16, padding: '1.1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: getColor(selectedMeal.host?.full_name || 'A'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>
                {selectedMeal.host?.full_name?.charAt(0) || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{selectedMeal.host?.full_name} <span style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700 }}>✓ Vérifié</span></div>
                <div style={{ fontSize: '0.8rem', color: s.mid }}>Passionné de cuisine {selectedMeal.cuisine?.toLowerCase()} · Répond en &lt;1h</div>
              </div>
              <button onClick={() => nav('messages')} style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 10, padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>💬 Message</button>
            </div>

            <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>🍽️ Au menu</h3>
            <ul style={{ listStyle: 'none', marginBottom: '1.5rem' }}>
              {selectedMeal.menu?.map((item, i) => (
                <li key={i} style={{ padding: '0.55rem 0', borderBottom: `1px solid ${s.border}`, fontSize: '0.9rem' }}>✦ {item}</li>
              ))}
            </ul>

            <h3 style={{ fontWeight: 800, marginBottom: '0.8rem' }}>⭐ Avis récents</h3>
            {[{ name: 'Sophie R.', rating: '★★★★★', text: 'Repas incroyable, ambiance chaleureuse et familiale !' }, { name: 'Thomas K.', rating: '★★★★☆', text: 'Cuisine généreuse et authentique. Je reviendrai !' }].map((r, i) => (
              <div key={i} style={{ background: s.cream, borderRadius: 12, padding: '1rem', marginBottom: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: getColor(r.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>{r.name.charAt(0)}</div>
                  <div><div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{r.name}</div><div style={{ color: '#F6AD55', fontSize: '0.82rem' }}>{r.rating}</div></div>
                </div>
                <p style={{ fontSize: '0.85rem', color: s.mid }}>{r.text}</p>
              </div>
            ))}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.5rem' }}><span>{selectedMeal.price_per_seat}€ × {guests} couvert(s)</span><span>{selectedMeal.price_per_seat * guests}€</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.7rem' }}><span>Frais de service</span><span>2€</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: `2px solid ${s.border}`, paddingTop: '0.7rem' }}><span>Total</span><span>{total}€</span></div>
              <button onClick={() => { if (!user) { setShowAuth(true); showToast('Connectez-vous pour réserver') } else { setPayDone(false); setPromoApplied(false); setShowPayment(true) } }}
                style={{ width: '100%', marginTop: '1rem', background: s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                💳 Réserver & Payer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MESSAGES ══ */}
      {page === 'messages' && (
        <div style={{ maxWidth: 860, margin: '2rem auto', padding: '0 2rem' }}>
          <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>💬 Messages</h2>
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '1rem', borderBottom: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>F</div>
              <div><div style={{ fontWeight: 700 }}>Fatima B.</div><div style={{ fontSize: '0.75rem', color: '#38A169' }}>● En ligne</div></div>
            </div>
            <div style={{ height: 320, overflowY: 'auto', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ maxWidth: '70%', padding: '0.7rem 1rem', borderRadius: 18, fontSize: '0.88rem', lineHeight: 1.5, alignSelf: msg.from === 'user' ? 'flex-end' : 'flex-start', background: msg.from === 'user' ? s.terra : s.cream, color: msg.from === 'user' ? '#fff' : s.dark }}>
                  {msg.text}
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem', borderTop: `1px solid ${s.border}`, display: 'flex', gap: '0.7rem' }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Écrivez un message…"
                style={{ flex: 1, border: `1.5px solid ${s.border}`, borderRadius: 999, padding: '0.55rem 1rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} />
              <button onClick={sendMessage} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.55rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Envoyer</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DASHBOARD ══ */}
      {page === 'dashboard' && user && (
        <div style={{ maxWidth: 1060, margin: '2rem auto', padding: '0 2rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.2rem', height: 'fit-content', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            <div style={{ textAlign: 'center', paddingBottom: '1rem', borderBottom: `1px solid ${s.border}`, marginBottom: '0.8rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: s.terra, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.4rem', fontWeight: 700, margin: '0 auto 0.5rem' }}>{user.full_name.charAt(0).toUpperCase()}</div>
              <div style={{ fontWeight: 700 }}>{user.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: s.mid }}>Membre depuis 2025</div>
            </div>
            {[['overview', '📊', 'Vue d\'ensemble'], ['bookings', '🍽️', 'Réservations'], ['favorites', '❤️', 'Favoris'], ['profile', '👤', 'Mon profil'], ['host', '🏠', 'Espace hôte']].map(([id, icon, label]) => (
              <div key={id} onClick={() => setDashTab(id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', fontWeight: dashTab === id ? 700 : 500, background: dashTab === id ? s.cream : 'transparent', color: dashTab === id ? s.terra : s.dark, marginBottom: '0.3rem' }}>
                <span>{icon}</span>{label}
              </div>
            ))}
            <div onClick={doLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 0.9rem', borderRadius: 12, cursor: 'pointer', fontSize: '0.88rem', color: '#E53E3E', marginTop: '1rem' }}>🚪 Déconnexion</div>
          </div>

          <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
            {dashTab === 'overview' && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>Bonjour {user.full_name.split(' ')[0]} 👋</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[['3', 'Repas réservés'], ['2', 'Avis donnés'], ['5', 'Favoris'], ['4.9⭐', 'Note reçue']].map(([v, l]) => (
                    <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                      <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                      <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                    </div>
                  ))}
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Suggestions pour vous</h3>
                <Grid data={meals.slice(0, 3)} />
              </div>
            )}
            {dashTab === 'bookings' && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🍽️ Mes réservations</h2>
                {[{ emoji: '🥘', title: "Tajine d'agneau", detail: 'Bordeaux · Ce soir 19h30 · 2 couverts · 38€', status: 'Confirmé', color: '#E8F5E9', textColor: '#38A169' }, { emoji: '🍜', title: 'Ramen maison Tokyo', detail: 'Paris · Vendredi 20h · 1 couvert · 28€', status: 'À venir', color: '#EBF8FF', textColor: '#3182CE' }, { emoji: '🍝', title: 'Soirée pâtes fraîches', detail: 'Lyon · 12 mai · 2 couverts · 46€', status: 'Terminé', color: '#f0f0f0', textColor: s.mid }].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem', border: `1.5px solid ${s.border}`, borderRadius: 12, marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '2rem' }}>{b.emoji}</span>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{b.title}</div><div style={{ fontSize: '0.78rem', color: s.mid }}>{b.detail}</div></div>
                    <span style={{ background: b.color, color: b.textColor, borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>{b.status}</span>
                  </div>
                ))}
              </div>
            )}
            {dashTab === 'favorites' && (
              <div><h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>❤️ Mes favoris</h2><Grid data={meals.slice(2, 5)} /></div>
            )}
            {dashTab === 'profile' && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>👤 Mon profil</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {input('Prénom', '', () => {})}
                  {input('Nom', '', () => {})}
                </div>
                {input('Email', user.email, () => {}, 'email')}
                {input('Téléphone', '', () => {}, 'tel')}
                {input('Ville', '', () => {})}
                <button onClick={() => showToast('✅ Profil enregistré !')} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>💾 Enregistrer</button>
              </div>
            )}
            {dashTab === 'host' && (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>🏠 Espace hôte</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[['0', 'Repas proposés'], ['0€', 'Revenus ce mois'], ['—', 'Note hôte']].map(([v, l]) => (
                    <div key={l} style={{ background: s.cream, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                      <strong style={{ display: 'block', fontSize: '1.5rem', color: s.terra }}>{v}</strong>
                      <span style={{ fontSize: '0.78rem', color: s.mid }}>{l}</span>
                    </div>
                  ))}
                </div>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Proposer un nouveau repas</h3>
                {input('Titre du repas', '', () => {})}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {input('Cuisine', '', () => {})}
                  {input('Prix / couvert (€)', '', () => {}, 'number')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {input('Date', '', () => {}, 'date')}
                  {input('Heure', '', () => {}, 'time')}
                </div>
                {input('Nb de couverts dispo', '', () => {}, 'number')}
                <textarea placeholder="Description & menu…" rows={4} style={{ width: '100%', border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.88rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: '1rem' }} />
                <button onClick={() => showToast('🎉 Repas publié !')} style={{ width: '100%', background: s.sage, color: '#fff', border: 'none', borderRadius: 12, padding: '0.85rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Publier mon repas</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ BECOME ══ */}
      {page === 'become' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #6B8F6B, #3D6B45)', color: '#fff', padding: '4rem 2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '1rem' }}>🏠 Partagez votre table</h1>
            <p style={{ opacity: 0.9, maxWidth: 480, margin: '0 auto 2rem', fontSize: '1rem' }}>Rejoignez 12 400 hôtes dans 42 pays.</p>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '1.5rem', maxWidth: 380, margin: '0 auto' }}>
              <label style={{ fontSize: '0.85rem', opacity: 0.9, display: 'block', marginBottom: '0.5rem' }}>Couverts par semaine ?</label>
              <input type="range" min="1" max="20" defaultValue="6" onChange={e => {}} style={{ width: '100%', accentColor: '#fff', marginBottom: '0.5rem' }} />
              <div style={{ fontSize: '2rem', fontWeight: 900 }}>144€ / semaine</div>
            </div>
          </div>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '2.5rem 2rem', textAlign: 'center' }}>
            <h2 style={{ fontWeight: 800, marginBottom: '2rem' }}>Pourquoi devenir hôte ?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {[['💶', '#FEF3ED', 'Revenus complémentaires', '100€ à 800€/mois selon vos dispo.'], ['🌍', '#E8F5E9', 'Rencontres mondiales', 'Accueillez des voyageurs curieux.'], ['🛡️', '#EBF8FF', 'Sécurité garantie', 'Profils vérifiés, paiement sécurisé.']].map(([icon, bg, title, desc]) => (
                <div key={title} style={{ textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem' }}>{icon}</div>
                  <h3 style={{ fontWeight: 700, marginBottom: '0.4rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.85rem', color: s.mid }}>{desc}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { setAuthMode('signup'); setShowAuth(true) }} style={{ background: s.sage, color: '#fff', border: 'none', borderRadius: 999, padding: '0.85rem 2.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>Créer mon profil hôte</button>
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
              {(['login', 'signup'] as const).map(t => (
                <div key={t} onClick={() => setAuthMode(t)}
                  style={{ flex: 1, padding: '0.55rem', textAlign: 'center', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem', background: authMode === t ? s.terra : 'transparent', color: authMode === t ? '#fff' : s.dark }}>
                  {t === 'login' ? 'Connexion' : 'Inscription'}
                </div>
              ))}
            </div>
            {authMode === 'login' ? (
              <div>
                {input('Email', email, setEmail, 'email')}
                {input('Mot de passe', password, setPassword, 'password')}
                <button onClick={doLogin} style={{ width: '100%', background: s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Se connecter</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  <input placeholder="Prénom" onChange={e => setFullName(e.target.value + ' ' + fullName.split(' ')[1])} style={{ border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit' }} />
                  <input placeholder="Nom" onChange={e => setFullName((fullName.split(' ')[0] || '') + ' ' + e.target.value)} style={{ border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.65rem 0.9rem', fontSize: '0.92rem', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div style={{ marginTop: '0.8rem' }}>{input('Email', email, setEmail, 'email')}</div>
                {input('Mot de passe (8 car. min)', password, setPassword, 'password')}
                <button onClick={doSignup} style={{ width: '100%', background: s.terra, color: '#fff', border: 'none', borderRadius: 10, padding: '0.85rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem' }}>Créer mon compte</button>
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
                <p style={{ color: s.mid, marginBottom: '1.5rem' }}>Votre repas chez <strong>{selectedMeal.host?.full_name}</strong> est confirmé pour <strong>{guests} couvert(s)</strong>.</p>
                <div style={{ background: '#E8F5E9', color: '#38A169', borderRadius: 999, padding: '0.5rem 1.2rem', display: 'inline-block', fontWeight: 700, marginBottom: '1.5rem' }}>✅ Paiement accepté</div>
                <p style={{ color: s.mid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>Un email de confirmation a été envoyé. L'hôte vous contactera sous peu.</p>
                <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => { setShowPayment(false); nav('dashboard'); setDashTab('bookings') }} style={{ background: s.terra, color: '#fff', border: 'none', borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Mes réservations</button>
                  <button onClick={() => { setShowPayment(false); nav('messages') }} style={{ background: 'transparent', border: `2px solid ${s.terra}`, color: s.terra, borderRadius: 999, padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>💬 L'hôte</button>
                </div>
              </div>
            ) : (
              <div>
                <h2 style={{ fontWeight: 800, marginBottom: '1.2rem' }}>💳 Paiement sécurisé</h2>
                <div style={{ display: 'flex', gap: '0.7rem', background: s.cream, borderRadius: 12, padding: '0.9rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '2rem' }}>{selectedMeal.photo_url?.length <= 2 ? selectedMeal.photo_url : '🍽️'}</span>
                  <div><div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{selectedMeal.title}</div><div style={{ fontSize: '0.78rem', color: s.mid }}>Chez {selectedMeal.host?.full_name} · {guests} couvert(s)</div></div>
                </div>
                {input('Numéro de carte', cardNum, v => setCardNum(v.replace(/\D/g, '').substring(0, 16).replace(/(.{4})/g, '$1 ').trim()))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  {input('MM / AA', cardExp, setCardExp)}
                  {input('CVV', cardCvv, setCardCvv, 'password')}
                </div>
                {input('Nom sur la carte', '', () => {})}
                <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                  <input value={promo} onChange={e => setPromo(e.target.value)} placeholder="Code promo (HOMEAT10)" style={{ flex: 1, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '0.6rem 0.9rem', fontSize: '0.88rem', outline: 'none', fontFamily: 'inherit' }} />
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
                <button onClick={() => { if (!cardNum || cardNum.replace(/\s/g, '').length < 16) { showToast('⚠️ Vérifiez votre numéro de carte'); return } setPayDone(true) }}
                  style={{ width: '100%', background: s.terra, color: '#fff', border: 'none', borderRadius: 12, padding: '0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>
                  Confirmer et payer — {discounted}€
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: s.dark, color: '#fff', padding: '0.7rem 1.5rem', borderRadius: 999, fontWeight: 600, fontSize: '0.88rem', zIndex: 500, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <footer style={{ background: s.dark, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '2rem', fontSize: '0.82rem', marginTop: '3rem' }}>
        <strong style={{ color: '#fff' }}>HomEat</strong> — Partagez une table, découvrez le monde 🌍<br />
        <span style={{ fontSize: '0.75rem' }}>© 2025 HomEat · CGU · Confidentialité · Aide</span>
      </footer>
    </div>
  )
}
