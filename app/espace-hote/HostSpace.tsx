'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/site/Icons'
import { Avatar, Confirm, Head, Messenger, ReportModal, SpaceGate, SpaceLayout, StarPicker, Stars, eur, fmtDate, fmtTime, useToast } from '../components/space/Kit'
import { ALLERGENS, CATEGORIES, COMMISSION_PROVISIONAL, COMMISSION_RATE, CUISINES, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, TRANSFER_DELAY_HOURS, displayPrice, todayParis } from '@/lib/shared'
import { approx, geocodeAddress, type GeoResult } from '@/lib/geocode'
import { supabase } from '@/lib/supabase'
import {
  api, deleteGalleryPhoto, loadGallery, loadHost, logout, saveProfile, sendMessage, uploadPhoto, useMe,
  type GalleryPhoto, type HostGuest, type HostMeal, type Me, type ReceivedReview,
} from '@/lib/space'

type TabId = 'accueil' | 'avenir' | 'repas' | 'photos' | 'visibilite' | 'invites' | 'avis' | 'messages' | 'revenus' | 'profil'
type Payouts = { active: boolean; configured: boolean }
type Ask = { title: string; text: string; yes: () => void }

const money = (n: number) => Math.round(n * 100) / 100
/** Prix hôte maximal pour que l'invité paie 10 € au plus (repas étudiant). */
const STUDENT_MAX_HOST_PRICE = Math.floor((STUDENT_MAX_PRICE / (1 + COMMISSION_RATE)) * 100) / 100

export default function HostSpace() {
  const { state, me, reloadMe } = useMe('/espace-hote')
  if (state !== 'in' || !me) return <SpaceGate state={state} />
  return <HostSpaceIn me={me} reloadMe={reloadMe} />
}

function HostSpaceIn({ me, reloadMe }: { me: Me; reloadMe: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabId>('accueil')
  const [toast, toastNode] = useToast()
  const [loaded, setLoaded] = useState(false)
  const [meals, setMeals] = useState<HostMeal[]>([])
  const [guests, setGuests] = useState<HostGuest[]>([])
  const [reviews, setReviews] = useState<ReceivedReview[]>([])
  const [payouts, setPayouts] = useState<Payouts>({ active: false, configured: false })
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])
  const [version, setVersion] = useState(0)
  const [confirm, setConfirm] = useState<Ask | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [chatWith, setChatWith] = useState<{ id: string; name: string } | null>(null)
  const reload = () => setVersion(v => v + 1)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadHost(me.id), loadGallery(me.id)]).then(([h, g]) => {
      if (cancelled) return
      setMeals(h.meals); setGuests(h.guests); setReviews(h.reviews)
      // Ne jamais écraser un statut « actif » obtenu entre-temps auprès de Stripe.
      setPayouts(p => (p.active ? p : { active: h.payoutsActive, configured: h.payoutsConfigured }))
      setPhotos(g); setLoaded(true)
    })
    return () => { cancelled = true }
  }, [me.id, version])

  // Retour depuis l'inscription Stripe aux versements.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('versements')
    if (!v) return
    window.history.replaceState({}, '', '/espace-hote')
    if (v === 'relancer') {
      api<{ url: string }>('/api/connect/onboard').then(r => { window.location.href = r.url }).catch(e => toast((e as Error).message))
      return
    }
    api<Payouts>('/api/connect/status')
      .then(r => { setPayouts(r); toast(r.active ? 'Versements activés : vous pouvez publier vos repas.' : 'Inscription Stripe incomplète : il reste des informations à fournir.') })
      .catch(e => toast((e as Error).message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startPayouts = async () => {
    try {
      const { url } = await api<{ url: string }>(payouts.configured && payouts.active ? '/api/connect/dashboard' : '/api/connect/onboard')
      window.location.href = url
    } catch (e) { toast((e as Error).message) }
  }

  const upcoming = meals.filter(m => m.status === 'online')
  const checks = [
    { id: 'photos', ok: photos.length >= 3, t: 'Au moins 3 photos de vos plats', d: 'Les repas avec des photos sont beaucoup plus réservés.', tab: 'photos' as TabId },
    { id: 'bio', ok: me.bio.trim().length >= 80, t: 'Une présentation de 80 caractères ou plus', d: 'Racontez qui vous êtes et d’où vient votre cuisine.', tab: 'profil' as TabId },
    { id: 'id', ok: payouts.active, t: 'Identité vérifiée et versements actifs', d: 'Stripe vérifie votre identité quand vous activez vos versements.', tab: 'profil' as TabId },
    { id: 'reviews', ok: reviews.length >= 3, t: '3 avis ou plus', d: 'Demandez gentiment à vos invités de laisser un avis.', tab: 'avis' as TabId },
    { id: 'next', ok: upcoming.length >= 2, t: 'Au moins 2 repas à venir', d: 'Un calendrier rempli inspire confiance.', tab: 'repas' as TabId },
  ]
  const score = { done: checks.filter(c => c.ok).length, total: checks.length }
  const mealById = useMemo(() => new Map(meals.map(m => [m.id, m])), [meals])
  const toReview = guests.filter(g => mealById.get(g.mealId)?.status === 'past' && !g.reviewed)

  const writeTo = (g: { id: string; name: string }) => { setChatWith(g); setTab('messages') }

  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'avenir', label: 'À venir', icon: 'calendar' },
    { id: 'repas', label: 'Mes repas', icon: 'plate' },
    { id: 'photos', label: 'Photos des plats', icon: 'camera' },
    { id: 'visibilite', label: 'Visibilité', icon: 'rocket' },
    { id: 'invites', label: 'Mes invités', icon: 'users' },
    { id: 'avis', label: 'Avis', icon: 'star', badge: toReview.length },
    { id: 'messages', label: 'Messages', icon: 'chat' },
    { id: 'revenus', label: 'Revenus', icon: 'euro' },
    { id: 'profil', label: 'Profil et versements', icon: 'shield' },
  ]

  return (
    <>
      <SpaceLayout who={me.name} avatar={me.avatar} role="Espace hôte" tabs={tabs} tab={tab} setTab={t => setTab(t as TabId)} switchTo={{ href: '/mon-compte', label: 'Passer en mode invité' }}
        onLogout={async () => { await logout(); router.push('/') }}>
        {!loaded ? <p className="muted">Chargement…</p> : <>
          {tab === 'accueil' && <Home me={me} score={score} meals={meals} guests={guests} toReview={toReview.length} photos={photos.length} payouts={payouts} go={setTab} />}
          {tab === 'avenir' && <Upcoming meals={meals} guests={guests} go={setTab} />}
          {tab === 'repas' && <Meals me={me} meals={meals} photos={photos} payouts={payouts} startPayouts={startPayouts} toast={toast} ask={setConfirm} onChange={reload} onPhoto={p => setPhotos(ps => [...ps, p])} />}
          {tab === 'photos' && <Photos me={me} photos={photos} setPhotos={setPhotos} toast={toast} ask={setConfirm} />}
          {tab === 'visibilite' && <Visibility me={me} score={score} checks={checks} go={setTab} photo={photos[0]?.src} meal={upcoming[0]} reviews={reviews} />}
          {tab === 'invites' && <Guests me={me} meals={meals} guests={guests} toast={toast} report={setReport} write={writeTo} />}
          {tab === 'avis' && <Reviews me={me} reviews={reviews} setReviews={setReviews} toReview={toReview} meals={mealById} onReviewed={id => setGuests(gs => gs.map(g => (g.bookingId === id ? { ...g, reviewed: true } : g)))} toast={toast} />}
          {tab === 'messages' && (<><Head title="Messages" text="Répondez vite : c’est bon pour votre visibilité." /><Messenger uid={me.id} openWith={chatWith} onReport={setReport} /></>)}
          {tab === 'revenus' && <Revenue guests={guests} meals={mealById} payouts={payouts} startPayouts={startPayouts} />}
          {tab === 'profil' && <Profile me={me} payouts={payouts} startPayouts={startPayouts} toast={toast} onSaved={reloadMe} />}
        </>}
      </SpaceLayout>
      {confirm && <Confirm title={confirm.title} confirm="Oui, confirmer" danger onNo={() => setConfirm(null)} onYes={() => { confirm.yes(); setConfirm(null) }}>{confirm.text}</Confirm>}
      {report && <ReportModal name={report} onClose={() => setReport(null)} onSent={() => setReport(null)} />}
      {toastNode}
    </>
  )
}

// ═══════════════════ Accueil ═══════════════════

function Home({ me, score, meals, guests, toReview, photos, payouts, go }: { me: Me; score: { done: number; total: number }; meals: HostMeal[]; guests: HostGuest[]; toReview: number; photos: number; payouts: Payouts; go: (t: TabId) => void }) {
  const next = meals.filter(m => m.status === 'online').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
  const nextGuests = next ? guests.filter(g => g.mealId === next.id) : []
  const month = todayParis().slice(0, 7)
  const earnedMonth = guests.filter(g => g.transferredAt?.slice(0, 7) === month).reduce((s, g) => s + g.hostAmount, 0)
  const expected = guests.filter(g => meals.find(m => m.id === g.mealId)?.status === 'online').reduce((s, g) => s + g.seats, 0)
  const todo = [
    !payouts.active && { t: 'Activer vos versements pour pouvoir publier', tab: 'profil' as TabId, icon: 'euro' },
    toReview > 0 && { t: `Donner votre avis sur ${toReview} invité${toReview > 1 ? 's' : ''}`, tab: 'avis' as TabId, icon: 'star' },
    photos < 3 && { t: 'Ajouter des photos de vos plats', tab: 'photos' as TabId, icon: 'camera' },
  ].filter(Boolean) as { t: string; tab: TabId; icon: string }[]

  return (
    <>
      <Head title={`Bonjour ${me.name.split(' ')[0]}`} text="Voici ce qui se passe chez vous." action={<button className="btn btn-primary" onClick={() => go('repas')}><Icon name="plus" size={18} /> Proposer un repas</button>} />
      <div className="stats" style={{ marginBottom: '1.6rem' }}>
        {[[meals.filter(m => m.status === 'online').length, 'Repas à venir'], [expected, 'Invités attendus'], [eur(earnedMonth), 'Versé ce mois'], [me.rating ? me.rating.toFixed(1).replace('.', ',') : '—', 'Votre note']].map(([v, l]) => (
          <div key={String(l)} className="stat"><strong>{v}</strong><span>{l}</span></div>
        ))}
      </div>

      {todo.length > 0 && (
        <>
          <h3 className="subtitle">À faire</h3>
          <div className="row-list" style={{ marginBottom: '1.6rem' }}>
            {todo.map(t => (
              <button key={t.t} className="row" style={{ cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left' }} onClick={() => go(t.tab)}>
                <span className="tile-icon" style={{ width: 44, height: 44, borderRadius: 14 }}><Icon name={t.icon} /></span>
                <span className="row-txt"><strong>{t.t}</strong></span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        </>
      )}

      {next ? (
        <>
          <h3 className="subtitle">Votre prochain repas</h3>
          <div className="row">
            <img src={next.photo} alt="" />
            <div className="row-txt">
              <strong>{next.title}</strong>
              <span>{fmtDate(next.date, true)} à {fmtTime(next.time)} · {next.booked} / {next.seats} places réservées</span>
              <div className="progress" style={{ maxWidth: 260 }}><i style={{ width: `${(next.booked / next.seats) * 100}%` }} /></div>
            </div>
            {nextGuests.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => go('invites')}>{nextGuests.length > 1 ? `Voir les ${nextGuests.length} réservations` : 'Voir la réservation'}</button>}
          </div>
        </>
      ) : <div className="empty-soft"><Icon name="plate" size={36} /><p>Aucun repas à venir. Proposez votre premier repas !</p></div>}

      <div className="score-box" style={{ marginTop: '1.6rem', background: 'rgba(167,199,231,0.05)', border: '1px solid var(--line)' }}>
        <span className="tile-icon"><Icon name="rocket" size={28} /></span>
        <div style={{ flex: 1, minWidth: '14rem' }}>
          <h3 style={{ margin: '0 0 0.4rem' }}>Votre visibilité</h3>
          <p className="muted" style={{ margin: '0 0 0.8rem', lineHeight: 1.6 }}>Vous suivez {score.done} conseil{score.done > 1 ? 's' : ''} sur {score.total}. Un profil complet donne envie de réserver.</p>
          <div className="progress" style={{ maxWidth: 320, marginBottom: '1rem' }}><i style={{ width: `${(score.done / score.total) * 100}%` }} /></div>
          <button className="btn btn-primary btn-sm" onClick={() => go('visibilite')}>L’améliorer</button>
        </div>
      </div>
      <FeeBox />
    </>
  )
}

// ═══════════════════ Repas ═══════════════════

type MealForm = { title: string; cuisine: string; date: string; time: string; price: string; seats: string; desc: string; menu: string; tags: string[]; allergens: string[]; none: boolean; photo: string }
const EMPTY_FORM: MealForm = { title: '', cuisine: 'Française', date: '', time: '19:30', price: '', seats: '6', desc: '', menu: '', tags: [], allergens: [], none: false, photo: '' }

function Meals({ me, meals, photos, payouts, startPayouts, toast, ask, onChange, onPhoto }: { me: Me; meals: HostMeal[]; photos: GalleryPhoto[]; payouts: Payouts; startPayouts: () => void; toast: (m: string) => void; ask: (c: Ask) => void; onChange: () => void; onPhoto: (p: GalleryPhoto) => void }) {
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState<MealForm>(EMPTY_FORM)
  const [address, setAddress] = useState('')
  const [matches, setMatches] = useState<GeoResult[]>([])
  const [pick, setPick] = useState<GeoResult | null>(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const set = <K extends keyof MealForm>(k: K, v: MealForm[K]) => setF(p => ({ ...p, [k]: v }))
  const price = parseFloat(f.price.replace(',', '.'))
  const student = f.tags.includes('Repas étudiant')

  const open = (base: MealForm) => { setF(base); setErr(''); setCreating(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const findAddress = async () => {
    setBusy('address'); setPick(null); setErr('')
    try {
      const r = await geocodeAddress(address)
      if (r.length === 0) setErr('Adresse introuvable : précisez le numéro, la rue et la ville.')
      if (r.length === 1) { setPick(r[0]); setMatches([]) } else setMatches(r)
    } catch { setErr('Le service d’adresses ne répond pas. Réessayez dans un instant.') }
    setBusy('')
  }

  const addPhoto = async (file: File | undefined) => {
    if (!file) return
    setBusy('photo')
    try {
      const ph = await uploadPhoto(me.id, file)
      onPhoto(ph)
      set('photo', ph.src)
    } catch (e) { toast((e as Error).message) }
    setBusy('')
  }

  const publish = async () => {
    setErr('')
    if (!payouts.active) return setErr('Activez d’abord vos versements (onglet « Profil et versements ») : c’est ainsi que vous serez payé.')
    if (f.title.trim().length < 4) return setErr('Donnez un titre à votre repas (4 lettres minimum).')
    if (!f.date || f.date < todayParis()) return setErr('Choisissez une date à partir d’aujourd’hui.')
    if (!Number.isFinite(price) || price < 1 || price > 500) return setErr('Indiquez un prix entre 1 et 500 €.')
    if (student && displayPrice(price) > STUDENT_MAX_PRICE) return setErr(`Repas étudiant : votre prix doit être de ${eur(STUDENT_MAX_HOST_PRICE)} maximum (${STUDENT_MAX_PRICE} € pour l’invité).`)
    const seats = Number(f.seats)
    if (!Number.isInteger(seats) || seats < 1 || seats > 50) return setErr('Nombre de places : entre 1 et 50.')
    if (f.allergens.length === 0 && !f.none) return setErr('Indiquez les allergènes présents, ou cochez « aucun ».')
    if (!pick) return setErr('Vérifiez votre adresse avec le bouton « Vérifier ».')
    setBusy('publish')
    const { data, error } = await supabase.from('meals').insert({
      host_id: me.id, title: f.title.trim(), cuisine: f.cuisine, price_per_seat: money(price), max_seats: seats, available_seats: seats,
      date: f.date, time: f.time || '19:30', city: pick.city || pick.label, description: f.desc.trim(),
      menu: f.menu.split('\n').map(l => l.trim()).filter(Boolean), tags: f.tags, allergens: f.none ? [] : f.allergens,
      is_active: true, photo_url: f.photo || null, lat: approx(pick.lat), lng: approx(pick.lng),
    }).select('id').single()
    if (error || !data) { setBusy(''); return setErr(error?.message || 'Publication impossible.') }
    const { error: addrErr } = await supabase.from('meal_private').insert({ meal_id: data.id, address: pick.label, lat: pick.lat, lng: pick.lng })
    setBusy('')
    toast(addrErr ? 'Repas publié, mais l’adresse n’a pas été enregistrée : réessayez depuis l’accueil.' : 'Votre repas est en ligne')
    setCreating(false); setF(EMPTY_FORM); setPick(null); setAddress('')
    onChange()
  }

  const cancel = (m: HostMeal) => ask({
    title: 'Annuler ce repas ?',
    text: `« ${m.title} » sera retiré du site.${m.booked > 0 ? ` Les invités (${m.booked} place${m.booked > 1 ? 's' : ''}) seront remboursés en entier et prévenus par email.` : ''}`,
    yes: async () => {
      try {
        const r = await api<{ refunded_guests: number }>('/api/meals/cancel', { meal_id: m.id })
        toast(r.refunded_guests > 0 ? `Repas annulé : ${r.refunded_guests} invité(s) remboursé(s)` : 'Repas annulé')
        onChange()
      } catch (e) { toast((e as Error).message) }
    },
  })

  if (creating) {
    return (
      <form onSubmit={e => { e.preventDefault(); publish() }} noValidate>
        <Head title="Proposer un repas" text="Remplissez les cases, l’aperçu du prix se met à jour tout seul." action={<button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}><Icon name="back" size={18} /> Retour</button>} />
        {!payouts.active && <div className="note warn"><Icon name="euro" size={18} /><span>Pour publier, activez d’abord vos versements : Stripe vérifie votre identité et votre compte bancaire. <button type="button" className="link" onClick={startPayouts}>Activer mes versements</button></span></div>}
        <label className="field"><span className="field-label">Titre du repas</span><input className="input" value={f.title} onChange={e => set('title', e.target.value)} maxLength={120} placeholder="Couscous du dimanche" /></label>
        <div className="two-col">
          <label className="field"><span className="field-label">Cuisine</span><select className="input" value={f.cuisine} onChange={e => set('cuisine', e.target.value)}>{CUISINES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span className="field-label">Nombre de places</span><input className="input" type="number" min={1} max={50} value={f.seats} onChange={e => set('seats', e.target.value)} /></label>
        </div>
        <div className="two-col">
          <label className="field"><span className="field-label">Date</span><input className="input" type="date" min={todayParis()} value={f.date} onChange={e => set('date', e.target.value)} /></label>
          <label className="field"><span className="field-label">Heure</span><input className="input" type="time" value={f.time} onChange={e => set('time', e.target.value)} /></label>
        </div>
        <label className="field"><span className="field-label">Votre prix par personne (€)</span><input className="input" inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value)} placeholder="18" />
          {Number.isFinite(price) && price > 0 && <span className="field-hint ok-hint fade-swap">L’invité paie {eur(displayPrice(price))}, dont {eur(displayPrice(price) - price)} de commission Shareat. Vous recevez {eur(price)} par personne.</span>}
          {student && <span className="field-hint">Repas étudiant : {eur(STUDENT_MAX_HOST_PRICE)} maximum pour vous, soit {STUDENT_MAX_PRICE} € pour l’invité.</span>}
        </label>
        <div className="field"><span className="field-label">Adresse du repas (privée)</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: '12rem' }} value={address} onChange={e => { setAddress(e.target.value); setPick(null) }} placeholder="12 rue des Lilas, 33000 Bordeaux" autoComplete="street-address" />
            <button type="button" className="btn btn-ghost" onClick={findAddress} disabled={busy === 'address' || address.trim().length < 5}>{busy === 'address' ? 'Recherche…' : 'Vérifier'}</button>
          </div>
          {matches.length > 1 && <div className="chips chips-wrap" style={{ marginTop: '0.5rem' }}>{matches.map(m => <button type="button" key={m.label} className={`chip chip-soft${pick?.label === m.label ? ' on' : ''}`} onClick={() => { setPick(m); setMatches([]) }}>{m.label}</button>)}</div>}
          {pick && <span className="field-hint ok-hint"><Icon name="check" size={14} /> {pick.label}</span>}
          <span className="field-hint">Seuls les invités qui ont payé la voient. Sur la carte, une zone d’environ 1 km est affichée.</span>
        </div>
        <div className="field"><span className="field-label">Catégories</span>
          <div className="chips chips-wrap">{CATEGORIES.map(t => <button type="button" key={t} aria-pressed={f.tags.includes(t)} className={`chip chip-soft${f.tags.includes(t) ? ' on' : ''}`} onClick={() => set('tags', f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t])}>{t}</button>)}</div>
        </div>
        <div className="field"><span className="field-label">Allergènes présents (obligatoire)</span>
          <div className="chips chips-wrap">{ALLERGENS.map(a => <button type="button" key={a} disabled={f.none} aria-pressed={f.allergens.includes(a)} className={`chip chip-soft${f.allergens.includes(a) ? ' on' : ''}`} onClick={() => set('allergens', f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a])}>{a}</button>)}</div>
          <label className="check check-tight"><input type="checkbox" checked={f.none} onChange={e => { set('none', e.target.checked); if (e.target.checked) set('allergens', []) }} /><span>Aucun de ces 14 allergènes</span></label>
        </div>
        <div className="field"><span className="field-label">Photo principale</span>
          <div className="gallery">
            {photos.map(p => (
              <button type="button" key={p.src} className="ph" onClick={() => set('photo', f.photo === p.src ? '' : p.src)} style={{ padding: 0, cursor: 'pointer', outline: f.photo === p.src ? '3px solid var(--sky)' : 'none', outlineOffset: 2 }} aria-pressed={f.photo === p.src}>
                <img src={p.src} alt="" />{f.photo === p.src && <span className="ph-cover">Choisie</span>}
              </button>
            ))}
            <label className="drop">
              <Icon name={busy === 'photo' ? 'clock' : 'camera'} size={28} />
              <strong>{busy === 'photo' ? 'Envoi…' : 'Nouvelle photo'}</strong>
              <span className="small muted">Prenez-la avec votre téléphone</span>
              <input type="file" accept="image/*" hidden onChange={e => { addPhoto(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          <span className="field-hint">Sans photo, une illustration selon la cuisine est affichée.</span>
        </div>
        <label className="field"><span className="field-label">Description</span><textarea className="input" rows={3} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="L’ambiance, l’histoire du plat…" maxLength={2000} /></label>
        <label className="field"><span className="field-label">Menu (un plat par ligne)</span><textarea className="input" rows={3} value={f.menu} onChange={e => set('menu', e.target.value)} placeholder={'Entrée : salade de saison\nPlat : couscous\nDessert : cornes de gazelle'} maxLength={2000} /></label>
        {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy === 'publish' || busy === 'photo'}>{busy === 'publish' ? 'Publication…' : 'Publier mon repas'}</button>
      </form>
    )
  }

  return (
    <>
      <Head title="Mes repas" text="Tous vos repas, à venir et passés." action={<button className="btn btn-primary" onClick={() => open(EMPTY_FORM)}><Icon name="plus" size={18} /> Proposer un repas</button>} />
      {meals.length === 0 ? <div className="empty-soft"><Icon name="plate" size={36} /><p>Vous n’avez encore proposé aucun repas.</p></div> : (
        <div className="row-list">
          {meals.map(m => (
            <div key={m.id} className="row">
              <img src={m.photo} alt="" />
              <div className="row-txt">
                <strong>{m.title}</strong>
                <span>{fmtDate(m.date)} à {fmtTime(m.time)} · {eur(displayPrice(m.price))} par personne · {m.booked} / {m.seats} places</span>
                <div className="progress" style={{ maxWidth: 240 }}><i style={{ width: `${(m.booked / m.seats) * 100}%` }} /></div>
              </div>
              <span className={`status ${m.status === 'online' ? 'status-confirmed' : m.status === 'cancelled' ? 'status-cancelled' : 'status-completed'}`}>{m.status === 'online' ? 'En ligne' : m.status === 'cancelled' ? 'Annulé' : 'Passé'}</span>
              <div className="row-btns-inline">
                <button className="btn btn-ghost btn-sm" onClick={() => open({ title: m.title, cuisine: m.cuisine, date: '', time: m.time, price: String(m.price).replace('.', ','), seats: String(m.seats), desc: m.description, menu: m.menu.join('\n'), tags: m.tags, allergens: m.allergens, none: m.allergens.length === 0, photo: m.photoUrl ?? '' })}>Dupliquer</button>
                {m.status === 'online' && <button className="btn btn-ghost btn-sm danger-link" onClick={() => cancel(m)}>Annuler</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ═══════════════════ Photos ═══════════════════

function Photos({ me, photos, setPhotos, toast, ask }: { me: Me; photos: GalleryPhoto[]; setPhotos: (f: (p: GalleryPhoto[]) => GalleryPhoto[]) => void; toast: (m: string) => void; ask: (c: Ask) => void }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const MAX = 24

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MAX - photos.length
    if (room <= 0) { toast(`${MAX} photos maximum`); return }
    setBusy(true)
    let n = 0
    for (const file of [...files].slice(0, room)) {
      try {
        const ph = await uploadPhoto(me.id, file)
        setPhotos(p => [...p, ph])
        n++
      } catch (e) { toast((e as Error).message) }
    }
    setBusy(false)
    if (n) toast(`${n} photo${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`)
  }

  const remove = (p: GalleryPhoto) => ask({
    title: 'Supprimer cette photo ?',
    text: 'Elle disparaîtra de votre galerie et des repas qui l’utilisent.',
    yes: async () => {
      const e = await deleteGalleryPhoto(p.path)
      if (e) toast('Suppression impossible : ' + e)
      else { setPhotos(ps => ps.filter(x => x.src !== p.src)); toast('Photo supprimée') }
    },
  })

  return (
    <>
      <Head title="Photos de vos plats" text="Votre galerie : choisissez ensuite la photo de chaque repas au moment de le publier." />
      <div className="gallery">
        {photos.map(p => (
          <figure key={p.src} className="ph" style={{ margin: 0 }}>
            <img src={p.src} alt="" />
            <div className="ph-tools">
              <button onClick={() => remove(p)} aria-label="Supprimer"><Icon name="trash" size={16} /></button>
            </div>
          </figure>
        ))}
        {photos.length < MAX && (
          <label className={`drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}>
            <Icon name={busy ? 'clock' : 'camera'} size={32} />
            <strong>{busy ? 'Envoi…' : 'Ajouter des photos'}</strong>
            <span className="small muted">Touchez pour prendre une photo ou choisir dans vos images</span>
            <input type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      <p className="muted small" style={{ marginTop: '0.8rem' }}>{photos.length} / {MAX} photos · Les photos sont réduites automatiquement pour charger vite.</p>
      <h3 className="subtitle">Conseils pour de belles photos</h3>
      <div className="cards">
        {[['sparkle', 'Lumière du jour', 'Près d’une fenêtre, sans flash. Les couleurs sont plus belles.'], ['camera', 'Vue de dessus', 'Pour les assiettes et les plats à partager, prenez la photo d’en haut.'], ['plate', 'Vos vrais plats', 'Montrez ce que vous servez vraiment : pas de photos trouvées sur internet.']].map(([i, t, d]) => (
          <div key={t} className="info-card" style={{ background: 'rgba(220,233,247,0.04)', border: '1px solid var(--line)' }}><span className="tile-icon"><Icon name={i} /></span><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>
    </>
  )
}

// ═══════════════════ Visibilité ═══════════════════

function Visibility({ me, score, checks, go, photo, meal, reviews }: { me: Me; score: { done: number; total: number }; checks: { id: string; ok: boolean; t: string; d: string; tab: TabId }[]; go: (t: TabId) => void; photo?: string; meal?: HostMeal; reviews: ReceivedReview[] }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const city = meal?.city || me.city || 'votre ville'
  return (
    <>
      <Head title="Votre visibilité" text="Ces points rendent votre profil plus rassurant. Cliquez sur un point pour le régler." />
      <div className="score-box" style={{ background: 'rgba(167,199,231,0.05)', border: '1px solid var(--line)' }}>
        <span className="tile-icon"><Icon name="rocket" size={28} /></span>
        <div style={{ flex: 1, minWidth: '14rem' }}>
          <h3 style={{ margin: '0 0 0.4rem' }}>{score.done} conseil{score.done > 1 ? 's' : ''} suivi{score.done > 1 ? 's' : ''} sur {score.total}</h3>
          <p className="muted" style={{ margin: '0 0 0.8rem', lineHeight: 1.6 }}>{score.done === score.total ? 'Bravo, votre profil est complet.' : 'Regardez la liste ci-dessous et cliquez sur « Corriger ».'}</p>
          <div className="progress" style={{ maxWidth: 320 }}><i style={{ width: `${(score.done / score.total) * 100}%` }} /></div>
        </div>
      </div>

      <ul className="checklist">
        {checks.map(c => (
          <li key={c.id} className={c.ok ? 'done' : ''}>
            <span className="tick">{c.ok && <Icon name="check" size={16} />}</span>
            <div><strong>{c.t}</strong><small>{c.d}</small></div>
            {!c.ok && <button className="btn btn-ghost btn-sm" onClick={() => go(c.tab)}>Corriger</button>}
          </li>
        ))}
      </ul>

      <h3 className="subtitle">Comment les invités vous voient</h3>
      <div className="split" style={{ alignItems: 'start' }}>
        {meal ? (
          <article className="meal-card" style={{ maxWidth: 340 }}>
            <div className="meal-photo"><img src={meal.photoUrl ? meal.photo : photo || meal.photo} alt="" />{avg > 0 && <span className="meal-rating">★ {avg.toFixed(1)}</span>}</div>
            <div className="meal-body">
              <h3 className="meal-title">{meal.title}</h3>
              <p className="meal-host">Chez {me.name}</p>
              <div className="meal-meta"><span>{meal.city}</span><span>·</span><span>{fmtDate(meal.date)}</span></div>
              <div className="meal-foot"><span className="meal-cuisine">{meal.cuisine}</span><span className="meal-price">{eur(displayPrice(meal.price))} <small>/ couvert</small></span></div>
            </div>
          </article>
        ) : <p className="muted">Publiez un repas pour voir l’aperçu.</p>}
        <div>
          <div className="serp">
            <small>shareat › {city.toLowerCase()} › {meal?.cuisine.toLowerCase() ?? 'repas'}</small>
            <h4>{meal ? `${meal.title} chez l’habitant à ${city}` : 'Votre repas'} | Shareat</h4>
            <p>{me.bio ? `${me.bio.slice(0, 150)}${me.bio.length > 150 ? '…' : ''}` : 'Ajoutez une présentation dans votre profil.'}</p>
          </div>
          <p className="muted small" style={{ marginTop: '0.7rem', lineHeight: 1.6 }}>Exemple d’affichage dans un moteur de recherche : un titre clair (plat + ville) et une présentation soignée aident votre page à être trouvée.</p>
          <h4 style={{ margin: '1.2rem 0 0.5rem' }}>Astuces rapides</h4>
          <ul style={{ color: 'var(--soft)', lineHeight: 1.9, paddingLeft: '1.2rem', margin: 0 }}>
            <li>Mettez le nom du plat dans le titre (ex. « Couscous »).</li>
            <li>Ajoutez les bonnes catégories (Halal, Végétarien…) : elles servent de filtres.</li>
            <li>Proposez un repas étudiant de temps en temps pour remplir vite.</li>
          </ul>
        </div>
      </div>
    </>
  )
}

// ═══════════════════ Invités ═══════════════════

function Guests({ me, meals, guests, toast, report, write }: { me: Me; meals: HostMeal[]; guests: HostGuest[]; toast: (m: string) => void; report: (n: string) => void; write: (g: { id: string; name: string }) => void }) {
  const list = meals.filter(m => m.status !== 'cancelled')
  const [cur, setCur] = useState(list.find(m => m.status === 'online')?.id ?? list[0]?.id)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const g = guests.filter(x => x.mealId === cur)
  const meal = meals.find(m => m.id === cur)

  const broadcast = async () => {
    const text = msg.trim()
    const ids = [...new Set(g.map(x => x.guestId))]
    if (!text || !ids.length) return
    setSending(true)
    let ok = 0
    for (const id of ids) {
      try { await sendMessage(me.id, id, text, cur ?? null); ok++ } catch { /* on continue avec les autres */ }
    }
    setSending(false)
    if (ok) setMsg('')
    toast(ok === ids.length ? `Message envoyé à ${ok} invité${ok > 1 ? 's' : ''}` : `Message envoyé à ${ok} invité(s) sur ${ids.length}`)
  }

  if (list.length === 0) return (<><Head title="Mes invités" /><div className="empty-soft"><Icon name="users" size={36} /><p>Vos invités apparaîtront ici dès votre premier repas réservé.</p></div></>)

  return (
    <>
      <Head title="Mes invités" text="Qui vient à vos repas. Écrivez-leur pour les allergies ou les indications d’accès." />
      <div className="pill-tabs glass">{list.map(m => <button key={m.id} className={cur === m.id ? 'on' : ''} onClick={() => setCur(m.id)}>{m.title} · {fmtDate(m.date)}</button>)}</div>
      {g.length === 0 ? <div className="empty-soft"><Icon name="users" size={36} /><p>Personne n’a encore réservé ce repas.</p></div> : (
        <div className="row-list">
          {g.map(x => (
            <div key={x.bookingId} className="row">
              <Avatar name={x.name} src={x.avatar} size={46} />
              <div className="row-txt"><strong>{x.name}</strong><span>{x.seats} place{x.seats > 1 ? 's' : ''} · {eur(x.hostAmount)} pour vous</span></div>
              <div className="row-btns-inline">
                <button className="btn btn-ghost btn-sm" onClick={() => write({ id: x.guestId, name: x.name })}>Écrire</button>
                <button className="btn btn-ghost btn-sm" onClick={() => report(x.name)} aria-label={`Signaler ${x.name}`}><Icon name="flag" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {meal?.status === 'online' && g.length > 0 && (
        <form style={{ marginTop: '1.4rem' }} onSubmit={e => { e.preventDefault(); broadcast() }}>
          <span className="field-label">Écrire à tous les invités de ce repas</span>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input className="input input-pill" style={{ flex: 1, minWidth: '12rem' }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Ex. : Sonnez à l’interphone, 2e étage." maxLength={1000} />
            <button className="btn btn-primary" type="submit" disabled={!msg.trim() || sending}>{sending ? 'Envoi…' : 'Envoyer à tous'}</button>
          </div>
        </form>
      )}
    </>
  )
}

// ═══════════════════ Avis ═══════════════════

const GUEST_CRIT = ['Ponctualité', 'Respect du lieu', 'Communication']

function Reviews({ me, reviews, setReviews, toReview, meals, onReviewed, toast }: { me: Me; reviews: ReceivedReview[]; setReviews: (f: (r: ReceivedReview[]) => ReceivedReview[]) => void; toReview: HostGuest[]; meals: Map<string, HostMeal>; onReviewed: (bookingId: string) => void; toast: (m: string) => void }) {
  const [view, setView] = useState<'recus' | 'invites'>(toReview.length ? 'invites' : 'recus')
  const [open, setOpen] = useState<string | null>(null)
  const [crit, setCrit] = useState<Record<string, number>>({})
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const avg = useMemo(() => (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0), [reviews])

  const send = async (g: HostGuest) => {
    if (GUEST_CRIT.some(c => !crit[c])) { toast('Donnez une note pour chaque point'); return }
    setBusy(true)
    const rating = Math.round(GUEST_CRIT.reduce((s, c) => s + crit[c], 0) / GUEST_CRIT.length)
    const { error } = await supabase.from('reviews').insert({ booking_id: g.bookingId, reviewer_id: me.id, reviewed_id: g.guestId, meal_id: g.mealId, rating, comment: text.trim().slice(0, 800) || null, type: 'host_to_guest' })
    setBusy(false)
    if (error) { toast(error.code === '23505' ? 'Vous avez déjà donné votre avis sur cet invité' : 'Avis impossible : ' + error.message); return }
    onReviewed(g.bookingId)
    setOpen(null); setCrit({}); setText('')
    toast('Merci pour votre avis')
  }

  const sendReply = async (r: ReceivedReview) => {
    const v = reply.trim().slice(0, 600)
    if (!v) return
    const { error } = await supabase.from('reviews').update({ reply: v }).eq('id', r.id)
    if (error) { toast('Réponse impossible : ' + error.message); return }
    setReviews(rs => rs.map(x => (x.id === r.id ? { ...x, reply: v } : x)))
    setReplyFor(null); toast('Réponse publiée')
  }

  return (
    <>
      <Head title="Avis" text={reviews.length ? <>Votre note : <Stars n={avg} /> {avg.toFixed(1).replace('.', ',')} sur 5 ({reviews.length} avis)</> : 'Pas encore d’avis reçu.'} />
      <div className="pill-tabs glass">
        <button className={view === 'invites' ? 'on' : ''} onClick={() => setView('invites')}>Sur mes invités {toReview.length > 0 && `(${toReview.length})`}</button>
        <button className={view === 'recus' ? 'on' : ''} onClick={() => setView('recus')}>Reçus</button>
      </div>

      {view === 'invites' && (
        toReview.length === 0 ? <div className="empty-soft"><Icon name="check" size={36} /><p>Aucun avis à donner pour l’instant. Vous pourrez noter vos invités après chaque repas.</p></div> : (
          <div className="row-list">
            <div className="note"><Icon name="shield" size={18} /><span>Vos avis aident les autres hôtes. Restez honnête et poli : l’avis est visible par l’invité et les autres hôtes.</span></div>
            {toReview.map(g => (
              <div key={g.bookingId} className="review-card">
                <header><Avatar name={g.name} src={g.avatar} size={38} /><strong>{g.name}</strong><span className="muted small">{meals.get(g.mealId)?.title}</span>
                  {open !== g.bookingId && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setOpen(g.bookingId); setCrit({}); setText('') }}>Donner mon avis</button>}
                </header>
                {open === g.bookingId && (
                  <form className="fade-swap" onSubmit={e => { e.preventDefault(); send(g) }}>
                    <div className="criteria">{GUEST_CRIT.map(c => <div key={c} className="crit"><span>{c}</span><StarPicker label={c} value={crit[c] || 0} onChange={n => setCrit(p => ({ ...p, [c]: n }))} /></div>)}</div>
                    <textarea className="input" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Un petit mot (facultatif)" maxLength={800} style={{ marginTop: '0.8rem' }} />
                    <div className="row-btns" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Plus tard</button><button className="btn btn-primary" type="submit" disabled={busy}>Publier</button></div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {view === 'recus' && (
        <div className="row-list">
          {reviews.length === 0 && <div className="empty-soft"><Icon name="star" size={36} /><p>Les avis de vos invités apparaîtront ici après vos repas.</p></div>}
          {reviews.map(r => (
            <div key={r.id} className="review-card">
              <header><Avatar name={r.author} size={38} /><strong>{r.author}</strong><Stars n={r.rating} /><span className="muted small">{r.meal} · {fmtDate(r.date)}</span></header>
              {r.text && <p>{r.text}</p>}
              {r.reply && <p className="reply">Votre réponse : {r.reply}</p>}
              {!r.reply && replyFor !== r.id && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setReplyFor(r.id); setReply('') }}>Répondre publiquement</button>}
              {replyFor === r.id && (
                <form className="fade-swap" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); sendReply(r) }}>
                  <input className="input input-pill" style={{ flex: 1, minWidth: '12rem' }} value={reply} onChange={e => setReply(e.target.value)} placeholder="Merci pour votre visite…" maxLength={600} />
                  <button className="btn btn-primary" type="submit">Publier</button>
                </form>
              )}
            </div>
          ))}
          <p className="muted small">Un avis vous semble faux ou injurieux ? <Link className="inline-link" href="/aide#contact">Demandez sa vérification</Link>.</p>
        </div>
      )}
    </>
  )
}

// ═══════════════════ Revenus ═══════════════════

type Period = 'jour' | 'semaine' | 'mois'
const PERIOD_LABEL: Record<Period, string> = { jour: 'sur 14 jours', semaine: 'sur 8 semaines', mois: 'sur 6 mois' }

/** Sommes réellement versées, regroupées par jour, semaine ou mois. */
function revenueSeries(paid: { at: Date; amount: number }[], period: Period): [string, number][] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (period === 'mois') {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1)
      const sum = paid.filter(p => p.at.getFullYear() === d.getFullYear() && p.at.getMonth() === d.getMonth()).reduce((s, p) => s + p.amount, 0)
      return [d.toLocaleDateString('fr-FR', { month: 'short' }), sum] as [string, number]
    })
  }
  const step = period === 'jour' ? 1 : 7
  const count = period === 'jour' ? 14 : 8
  return Array.from({ length: count }, (_, i) => {
    const end = new Date(today); end.setDate(today.getDate() - (count - 1 - i) * step + 1)
    const start = new Date(end); start.setDate(end.getDate() - step)
    const sum = paid.filter(p => p.at >= start && p.at < end).reduce((s, p) => s + p.amount, 0)
    return [start.toLocaleDateString('fr-FR', period === 'jour' ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' }), sum] as [string, number]
  })
}

function Revenue({ guests, meals, payouts, startPayouts }: { guests: HostGuest[]; meals: Map<string, HostMeal>; payouts: Payouts; startPayouts: () => void }) {
  const [period, setPeriod] = useState<Period>('mois')
  const [hover, setHover] = useState<number | null>(null)
  const paid = guests.filter(g => g.transferredAt).map(g => ({ at: new Date(g.transferredAt!), amount: g.hostAmount, meal: meals.get(g.mealId)?.title ?? 'Repas', id: g.bookingId }))
  const pending = guests.filter(g => !g.transferredAt && meals.get(g.mealId)?.status !== 'cancelled').reduce((s, g) => s + g.hostAmount, 0)
  const data = revenueSeries(paid, period)
  const max = Math.max(...data.map(m => m[1]), 1)
  const total = data.reduce((s, m) => s + m[1], 0)
  const best = data.reduce((b, m) => (m[1] > b[1] ? m : b), data[0])
  return (
    <>
      <Head title="Revenus" text={`Vos gains sont virés ${TRANSFER_DELAY_HOURS} h après chaque repas, sur votre compte bancaire.`} action={payouts.active ? <button className="btn btn-ghost" onClick={startPayouts}>Mon compte Stripe</button> : undefined} />
      <div className="stats" style={{ marginBottom: '1.4rem' }}>
        <div className="stat"><strong>{eur(total)}</strong><span>Versés {PERIOD_LABEL[period]}</span></div>
        <div className="stat"><strong>{eur(pending)}</strong><span>À venir</span></div>
        <div className="stat"><strong>{paid.length}</strong><span>Virements</span></div>
      </div>
      <div className="chart-head">
        <h3 className="subtitle" style={{ margin: 0 }}>Vos gains versés</h3>
        <div className="pill-tabs glass" role="radiogroup" aria-label="Période du graphique">
          {(['jour', 'semaine', 'mois'] as Period[]).map(p => (
            <button key={p} role="radio" aria-checked={period === p} className={period === p ? 'on' : ''} onClick={() => { setPeriod(p); setHover(null) }}>Par {p}</button>
          ))}
        </div>
      </div>
      <div key={period} className={`bars${data.length > 8 ? ' dense' : ''}`} aria-label={`Gains par ${period}`} onMouseLeave={() => setHover(null)}>
        {data.map(([m, v], i) => (
          <div key={m + i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
            <span style={{ color: hover === i ? 'var(--powder)' : undefined, fontWeight: hover === i ? 700 : undefined }}>{v && (hover === i || data.length <= 8) ? eur(v) : ''}</span>
            <i style={{ height: `${Math.max(v ? 4 : 1, (v / max) * 100)}%`, animationDelay: `${i * 0.04}s`, opacity: v ? 1 : 0.35 }} />
            <span>{m}</span>
          </div>
        ))}
      </div>
      <p className="chart-sum">{best[1] > 0 ? <>Meilleure période : <strong style={{ color: 'var(--text)' }}>{best[0]}</strong> avec {eur(best[1])}. </> : 'Aucun virement sur cette période. '}{data.length > 8 && 'Touchez une barre pour voir le montant.'}</p>
      <div style={{ marginTop: '1.4rem' }}><FeeBox /></div>
      <h3 className="subtitle">Derniers virements</h3>
      {paid.length === 0 ? <p className="muted">Aucun virement pour l’instant.</p> : (
        <div className="row-list">
          {paid.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 20).map(p => (
            <div key={p.id} className="row"><span className="tile-icon" style={{ width: 44, height: 44, borderRadius: 14 }}><Icon name="euro" /></span><div className="row-txt"><strong>{eur(p.amount)}</strong><span>{p.meal} · viré le {p.at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span></div><span className="status status-confirmed">Versé</span></div>
          ))}
        </div>
      )}
      <div className="note warn"><Icon name="doc" size={18} /><span>Ces revenus sont à déclarer aux impôts. Le détail de vos virements est disponible dans votre compte Stripe.</span></div>
    </>
  )
}

// ═══════════════════ Profil et versements ═══════════════════

const LANGS = ['Français', 'Anglais', 'Arabe', 'Espagnol', 'Italien', 'Portugais', 'Allemand']

function Profile({ me, payouts, startPayouts, toast, onSaved }: { me: Me; payouts: Payouts; startPayouts: () => void; toast: (m: string) => void; onSaved: () => void }) {
  const [bio, setBio] = useState(me.bio)
  const [langs, setLangs] = useState<string[]>(me.languages)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const e = await saveProfile(me.id, { bio: bio.trim().slice(0, 1200), languages: langs })
    setBusy(false)
    if (e) toast('Enregistrement impossible : ' + e)
    else { toast('Profil enregistré'); onSaved() }
  }
  return (
    <>
      <Head title="Profil et versements" text="Un profil complet et vérifié rassure les invités." />
      <label className="field"><span className="field-label">Présentation ({bio.trim().length} caractères, 80 conseillés)</span>
        <textarea className="input" rows={4} value={bio} onChange={e => setBio(e.target.value)} maxLength={1200} placeholder="Qui êtes-vous ? D’où vient votre cuisine ?" /></label>
      <div className="field"><span className="field-label">Langues parlées</span>
        <div className="chips chips-wrap">{LANGS.map(l => <button key={l} type="button" aria-pressed={langs.includes(l)} className={`chip${langs.includes(l) ? ' on' : ''}`} onClick={() => setLangs(p => (p.includes(l) ? p.filter(x => x !== l) : [...p, l]))}>{l}</button>)}</div>
      </div>
      <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      <p className="muted small" style={{ marginTop: '0.6rem' }}>Nom, ville et photo : modifiez-les dans <Link className="inline-link" href="/mon-compte?onglet=profil">Mon profil</Link>.</p>

      <h3 className="subtitle">Versements et identité</h3>
      <div className="set-row"><div><strong><Icon name="euro" size={16} /> Versements</strong><p>Stripe vérifie votre identité et votre compte bancaire, puis vous vire vos gains {TRANSFER_DELAY_HOURS} h après chaque repas. Obligatoire pour publier.</p></div>
        {payouts.active ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}><span className="status status-confirmed">Actifs</span><button className="btn btn-ghost btn-sm" onClick={startPayouts}>Gérer</button></div>
          : <button className="btn btn-primary btn-sm" onClick={startPayouts}>{payouts.configured ? 'Terminer l’inscription' : 'Activer'}</button>}
      </div>
      <div className="set-row"><div><strong><Icon name="shield" size={16} /> Identité</strong><p>Vérifiée par Stripe avec une pièce d’identité, lors de l’activation des versements.</p></div>{payouts.active ? <span className="status status-confirmed">Vérifiée</span> : <span className="status status-completed">À faire</span>}</div>
      <p className="muted small" style={{ marginTop: '1.2rem' }}>Mot de passe et données personnelles : voir <Link className="inline-link" href="/mon-compte?onglet=securite">Sécurité du compte</Link>.</p>
    </>
  )
}

// ═══════════════════ À venir ═══════════════════

function Upcoming({ meals, guests, go }: { meals: HostMeal[]; guests: HostGuest[]; go: (t: TabId) => void }) {
  const list = meals.filter(m => m.status === 'online').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  return (
    <>
      <Head title="À venir" text="Vos prochains repas, et les règles à connaître." action={<button className="btn btn-primary" onClick={() => go('repas')}><Icon name="plus" size={18} /> Proposer un repas</button>} />
      {list.length === 0 ? <div className="empty-soft"><Icon name="calendar" size={36} /><p>Aucun repas à venir.</p></div> : (
        <div className="row-list" style={{ marginBottom: '1.6rem' }}>
          {list.map(m => {
            const g = guests.filter(x => x.mealId === m.id)
            return (
              <div key={m.id} className="row">
                <img src={m.photo} alt="" />
                <div className="row-txt">
                  <strong>{m.title}</strong>
                  <span>{fmtDate(m.date, true)} à {fmtTime(m.time)}</span>
                  <span>{m.booked} / {m.seats} places réservées · {g.length} réservation{g.length > 1 ? 's' : ''}</span>
                  <div className="progress" style={{ maxWidth: 240 }}><i style={{ width: `${(m.booked / m.seats) * 100}%` }} /></div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => go('invites')}>Voir les invités</button>
              </div>
            )
          })}
        </div>
      )}
      <h3 className="subtitle">Les modalités pour vous, hôte</h3>
      <ul className="checklist">
        {[
          ['map', 'Votre adresse', 'Elle est envoyée seulement aux invités qui ont payé. Avant, une zone d’environ 1 km est visible.'],
          ['calendar', 'Si un invité annule', `Jusqu’à ${FREE_CANCELLATION_HOURS} h avant, il est remboursé et sa place est remise en ligne. Après, la place vous reste payée.`],
          ['x', 'Si vous annulez', 'Tous vos invités sont remboursés en entier et prévenus par email. Annulez le plus tôt possible.'],
          ['bell', 'Rappel la veille', 'Vous et vos invités recevez un email de rappel la veille du repas.'],
          ['leaf', 'Allergènes', 'Ce que vous avez déclaré doit correspondre à ce que vous servez.'],
          ['euro', 'Vos gains', `Virés ${TRANSFER_DELAY_HOURS} h après le début du repas, commission Shareat déduite (voir ci-dessous).`],
        ].map(([ic, t, d]) => (
          <li key={t}><span className="tick" style={{ background: 'rgba(167,199,231,0.14)', borderColor: 'var(--line-strong)', color: 'var(--sky)' }}><Icon name={ic} size={14} /></span><div><strong>{t}</strong><small>{d}</small></div></li>
        ))}
      </ul>
      <div style={{ marginTop: '1.4rem' }}><FeeBox /></div>
    </>
  )
}

// ═══════════════════ Commission Shareat (explication) ═══════════════════

function FeeBox() {
  const pct = Math.round(COMMISSION_RATE * 100)
  const example = 20
  const paid = displayPrice(example)
  return (
    <div className="fee-box">
      <span className="tile-icon"><Icon name="euro" size={24} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Comment Shareat est rémunéré</strong>
        <p>Sur chaque place réservée, Shareat ajoute une commission de <strong style={{ color: 'var(--text)' }}>{pct} %</strong>, payée par l’invité. Elle paie le paiement sécurisé (Stripe), le service client, les remboursements et la sécurité du site.</p>
        {COMMISSION_PROVISIONAL && <p><strong style={{ color: 'var(--warn)' }}>Taux provisoire :</strong> le pourcentage définitif sera fixé avant l’ouverture. Vous serez prévenu par email avant tout changement.</p>}
        <div className="fee-split" aria-label="Exemple pour une place">
          <div><strong>{eur(paid)}</strong><span>payés par l’invité</span></div>
          <div><strong>{eur(paid - example)}</strong><span>commission Shareat</span></div>
          <div><strong>{eur(example)}</strong><span>pour vous</span></div>
        </div>
        <p className="small">Exemple pour une place à {eur(example)}, avec le taux actuel.</p>
      </div>
    </div>
  )
}
