'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import Icon from '../components/site/Icons'
import { Avatar, BlockModal, BlockedList, Confirm, Head, Messenger, NotificationSettings, ReportModal, SpaceLayout, StarPicker, Stars, Toggle, eur, fmtDate, fmtTime, useToast } from '../components/space/Kit'
import { HOST_DEMO, PHOTOS, inDays, type DemoMeal, type DemoReview } from '@/lib/apercu'
import { ALLERGENS, CATEGORIES, COMMISSION_PROVISIONAL, COMMISSION_RATE, CUISINES, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, TRANSFER_DELAY_HOURS, displayPrice } from '@/lib/shared'

type Photo = { id: string; src: string; caption: string }

type TabId = 'accueil' | 'notifications' | 'avenir' | 'repas' | 'photos' | 'visibilite' | 'invites' | 'avis' | 'messages' | 'revenus' | 'profil'

/** Réduit une photo dans le navigateur (max 1600 px, JPEG) : plus rapide à envoyer depuis un téléphone. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

export default function HostSpace() {
  const [tab, setTab] = useState<TabId>('accueil')
  const [toast, toastNode] = useToast()
  const [meals, setMeals] = useState<DemoMeal[]>(HOST_DEMO.meals)
  const [guests, setGuests] = useState(HOST_DEMO.guests)
  const [reviews, setReviews] = useState<DemoReview[]>(HOST_DEMO.reviews)
  const [threads, setThreads] = useState(HOST_DEMO.threads)
  const [photos, setPhotos] = useState<Photo[]>([
    { id: 'p1', src: PHOTOS.couscous, caption: 'Couscous sept légumes' },
    { id: 'p2', src: PHOTOS.mezze, caption: 'Mezze' },
  ])
  const [profile, setProfile] = useState({ bio: 'J’ai appris à cuisiner avec ma grand-mère à Fès.', langs: ['Français', 'Arabe'], idVerified: true, phoneVerified: false, payouts: true, fastReply: true })
  const [confirm, setConfirm] = useState<{ title: string; text: string; yes: () => void } | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const [blockAsk, setBlockAsk] = useState<string | null>(null)
  const unblock = (n: string) => { setBlocked(b => b.filter(x => x !== n)); toast(`${n} est débloqué(e)`) }

  // ─── Score de visibilité (référencement interne) ───
  const upcoming = meals.filter(m => m.status === 'online')
  const checks = [
    { id: 'photos', ok: photos.length >= 3, t: 'Au moins 3 photos de vos plats', d: 'Les repas avec des photos sont beaucoup plus réservés.', tab: 'photos' as TabId, pts: 20 },
    { id: 'bio', ok: profile.bio.trim().length >= 80, t: 'Une présentation de 80 caractères ou plus', d: 'Racontez qui vous êtes et d’où vient votre cuisine.', tab: 'profil' as TabId, pts: 15 },
    { id: 'id', ok: profile.idVerified, t: 'Identité vérifiée', d: 'Badge « Identité vérifiée » sur votre profil.', tab: 'profil' as TabId, pts: 15 },
    { id: 'phone', ok: profile.phoneVerified, t: 'Téléphone vérifié', d: 'Rassure les invités et sécurise votre compte.', tab: 'profil' as TabId, pts: 10 },
    { id: 'reply', ok: profile.fastReply, t: 'Répondre aux messages en moins de 12 h', d: 'Les hôtes qui répondent vite remontent dans les résultats.', tab: 'messages' as TabId, pts: 10 },
    { id: 'reviews', ok: reviews.length >= 3, t: '3 avis ou plus', d: 'Demandez gentiment à vos invités de laisser un avis.', tab: 'avis' as TabId, pts: 15 },
    { id: 'next', ok: upcoming.length >= 2, t: 'Au moins 2 repas à venir', d: 'Un calendrier rempli inspire confiance.', tab: 'repas' as TabId, pts: 15 },
  ]
  const score = { done: checks.filter(c => c.ok).length, total: checks.length }

  const unread = threads.reduce((s, t) => s + t.unread, 0)
  const toReview = guests.filter(g => meals.find(m => m.id === g.mealId)?.status === 'past' && !g.reviewed)

  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'avenir', label: 'À venir', icon: 'calendar' },
    { id: 'repas', label: 'Mes repas', icon: 'plate' },
    { id: 'photos', label: 'Photos des plats', icon: 'camera' },
    { id: 'visibilite', label: 'Visibilité', icon: 'rocket' },
    { id: 'invites', label: 'Mes invités', icon: 'users' },
    { id: 'avis', label: 'Avis', icon: 'star', badge: toReview.length },
    { id: 'messages', label: 'Messages', icon: 'chat', badge: unread },
    { id: 'revenus', label: 'Revenus', icon: 'euro' },
    { id: 'profil', label: 'Profil et vérification', icon: 'shield' },
  ]

  return (
    <>
      <SpaceLayout who={HOST_DEMO.name} role="Espace hôte" tabs={tabs} tab={tab} setTab={t => setTab(t as TabId)} switchTo={{ href: '/mon-compte', label: 'Passer en mode invité' }}>
        {tab === 'accueil' && <Home score={score} meals={meals} guests={guests} toReview={toReview.length} unread={unread} photos={photos.length} go={setTab} />}
        {tab === 'notifications' && <NotificationSettings toast={toast} rows={HOST_NOTIFS} />}
        {tab === 'avenir' && <Upcoming meals={meals} guests={guests} go={setTab} />}
        {tab === 'repas' && <Meals meals={meals} setMeals={setMeals} photos={photos} toast={toast} ask={setConfirm} />}
        {tab === 'photos' && <Photos photos={photos} setPhotos={setPhotos} toast={toast} />}
        {tab === 'visibilite' && <Visibility score={score} checks={checks} go={setTab} photo={photos[0]?.src} bio={profile.bio} meal={upcoming[0]} reviews={reviews} />}
        {tab === 'invites' && <Guests meals={meals} guests={guests} toast={toast} report={setReport} go={setTab} block={setBlockAsk} blocked={blocked} />}
        {tab === 'avis' && <Reviews reviews={reviews} setReviews={setReviews} toReview={toReview} meals={meals} onReviewed={id => setGuests(gs => gs.map(g => (g.id === id ? { ...g, reviewed: true } : g)))} toast={toast} />}
        {tab === 'messages' && (<><Head title="Messages" text="Répondez vite : c’est bon pour votre visibilité." /><Messenger threads={threads} setThreads={setThreads} onReport={setReport} blocked={blocked} onBlock={setBlockAsk} onUnblock={unblock} /></>)}
        {tab === 'revenus' && <Revenue />}
        {tab === 'profil' && <Profile profile={profile} setProfile={setProfile} toast={toast} blocked={blocked} unblock={unblock} />}
      </SpaceLayout>
      {confirm && <Confirm title={confirm.title} confirm="Oui, confirmer" danger onNo={() => setConfirm(null)} onYes={() => { confirm.yes(); setConfirm(null) }}>{confirm.text}</Confirm>}
      {report && <ReportModal name={report} onClose={() => setReport(null)} onSent={() => { setReport(null); toast('Signalement envoyé. Notre équipe regarde sous 24 h.') }} />}
      {blockAsk && <BlockModal name={blockAsk} who="guest" onClose={() => setBlockAsk(null)} onYes={() => { setBlocked(b => (b.includes(blockAsk) ? b : [...b, blockAsk])); toast(`${blockAsk} est bloqué(e)`); setBlockAsk(null) }} />}
      {toastNode}
    </>
  )
}

// ═══════════════════ Accueil ═══════════════════

function Home({ score, meals, guests, toReview, unread, photos, go }: { score: { done: number; total: number }; meals: DemoMeal[]; guests: typeof HOST_DEMO.guests; toReview: number; unread: number; photos: number; go: (t: TabId) => void }) {
  const next = meals.filter(m => m.status === 'online').sort((a, b) => a.date.localeCompare(b.date))[0]
  const nextGuests = next ? guests.filter(g => g.mealId === next.id) : []
  const todo = [
    unread > 0 && { t: `Répondre à ${unread} message${unread > 1 ? 's' : ''}`, tab: 'messages' as TabId, icon: 'chat' },
    toReview > 0 && { t: `Donner votre avis sur ${toReview} invité${toReview > 1 ? 's' : ''}`, tab: 'avis' as TabId, icon: 'star' },
    photos < 3 && { t: 'Ajouter des photos de vos plats', tab: 'photos' as TabId, icon: 'camera' },
  ].filter(Boolean) as { t: string; tab: TabId; icon: string }[]

  return (
    <>
      <Head title={`Bonjour ${HOST_DEMO.name.split(' ')[0]}`} text="Voici ce qui se passe chez vous." action={<button className="btn btn-primary" onClick={() => go('repas')}><Icon name="plus" size={18} /> Proposer un repas</button>} />
      <div className="stats" style={{ marginBottom: '1.6rem' }}>
        {[[meals.filter(m => m.status === 'online').length, 'Repas à venir'], [guests.filter(g => meals.find(m => m.id === g.mealId)?.status === 'online').reduce((s, g) => s + g.seats, 0), 'Invités attendus'], [eur(150), 'Gagné ce mois'], ['4,5', 'Votre note']].map(([v, l]) => (
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

      {next && (
        <>
          <h3 className="subtitle">Votre prochain repas</h3>
          <div className="row">
            <img src={next.photo} alt="" />
            <div className="row-txt">
              <strong>{next.title}</strong>
              <span>{fmtDate(next.date, true)} à {fmtTime(next.time)} · {next.booked} / {next.seats} places réservées</span>
              <div className="progress" style={{ maxWidth: 260 }}><i style={{ width: `${(next.booked / next.seats) * 100}%` }} /></div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => go('invites')}>Voir les {nextGuests.length} invités</button>
          </div>
        </>
      )}

      <div className="score-box" style={{ marginTop: '1.6rem', background: 'rgba(167,199,231,0.05)', border: '1px solid var(--line)' }}>
        <span className="tile-icon"><Icon name="rocket" size={28} /></span>
        <div style={{ flex: 1, minWidth: '14rem' }}>
          <h3 style={{ margin: '0 0 0.4rem' }}>Votre visibilité</h3>
          <p className="muted" style={{ margin: '0 0 0.8rem', lineHeight: 1.6 }}>Vous suivez {score.done} conseil{score.done > 1 ? 's' : ''} sur {score.total}. Plus vous en suivez, plus vos repas apparaissent en premier.</p>
          <div className="progress" style={{ maxWidth: 320, marginBottom: '1rem' }}><i style={{ width: `${(score.done / score.total) * 100}%` }} /></div>
          <button className="btn btn-primary btn-sm" onClick={() => go('visibilite')}>L’améliorer</button>
        </div>
      </div>
      <FeeBox />
    </>
  )
}

// ═══════════════════ Repas ═══════════════════

function Meals({ meals, setMeals, photos, toast, ask }: { meals: DemoMeal[]; setMeals: (f: (m: DemoMeal[]) => DemoMeal[]) => void; photos: Photo[]; toast: (m: string) => void; ask: (c: { title: string; text: string; yes: () => void }) => void }) {
  const [creating, setCreating] = useState(false)
  const [f, setF] = useState({ title: '', cuisine: 'Française', date: '', time: '19:30', price: '', seats: '6', desc: '', menu: '', tags: [] as string[], allergens: [] as string[], none: false, photo: photos[0]?.src ?? '' })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: unknown) => setF(p => ({ ...p, [k]: v }))
  const price = parseFloat(f.price.replace(',', '.'))
  const student = f.tags.includes('Repas étudiant')

  const publish = () => {
    setErr('')
    if (f.title.trim().length < 4) return setErr('Donnez un titre à votre repas (4 lettres minimum).')
    if (!f.date || f.date < inDays(0)) return setErr('Choisissez une date à partir d’aujourd’hui.')
    if (!Number.isFinite(price) || price < 1 || price > 500) return setErr('Indiquez un prix entre 1 et 500 €.')
    if (student && displayPrice(price) > STUDENT_MAX_PRICE) return setErr(`Repas étudiant : l’invité doit payer ${STUDENT_MAX_PRICE} € maximum.`)
    const seats = Number(f.seats)
    if (!Number.isInteger(seats) || seats < 1 || seats > 50) return setErr('Nombre de places : entre 1 et 50.')
    if (f.allergens.length === 0 && !f.none) return setErr('Indiquez les allergènes présents, ou cochez « aucun ».')
    setMeals(ms => [{ id: `m${Date.now()}`, title: f.title.trim(), cuisine: f.cuisine, date: f.date, time: f.time, price, seats, booked: 0, status: 'online', photo: f.photo || PHOTOS.table, tags: f.tags }, ...ms])
    setCreating(false)
    toast('Votre repas est en ligne')
  }

  const duplicate = (m: DemoMeal) => {
    setMeals(ms => [{ ...m, id: `m${Date.now()}`, date: inDays(14), booked: 0, status: 'online' }, ...ms])
    toast('Repas dupliqué pour dans 2 semaines : modifiez la date si besoin.')
  }

  if (creating) {
    return (
      <form onSubmit={e => { e.preventDefault(); publish() }} noValidate>
        <Head title="Proposer un repas" text="Remplissez les cases, l’aperçu du prix se met à jour tout seul." action={<button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}><Icon name="back" size={18} /> Retour</button>} />
        <label className="field"><span className="field-label">Titre du repas</span><input className="input" value={f.title} onChange={e => set('title', e.target.value)} maxLength={120} placeholder="Couscous du dimanche" /></label>
        <div className="two-col">
          <label className="field"><span className="field-label">Cuisine</span><select className="input" value={f.cuisine} onChange={e => set('cuisine', e.target.value)}>{CUISINES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="field"><span className="field-label">Nombre de places</span><input className="input" type="number" min={1} max={50} value={f.seats} onChange={e => set('seats', e.target.value)} /></label>
        </div>
        <div className="two-col">
          <label className="field"><span className="field-label">Date</span><input className="input" type="date" min={inDays(0)} value={f.date} onChange={e => set('date', e.target.value)} /></label>
          <label className="field"><span className="field-label">Heure</span><input className="input" type="time" value={f.time} onChange={e => set('time', e.target.value)} /></label>
        </div>
        <label className="field"><span className="field-label">Votre prix par personne (€)</span><input className="input" inputMode="decimal" value={f.price} onChange={e => set('price', e.target.value)} placeholder="18" />
          {Number.isFinite(price) && price > 0 && <span className="field-hint ok-hint fade-swap">L’invité paie {eur(displayPrice(price))}, dont {eur(displayPrice(price) - price)} de commission Shareat ({Math.round(COMMISSION_RATE * 100)} %, taux provisoire). Vos gains estimés : {eur(price)} par personne.</span>}
        </label>
        <div className="field"><span className="field-label">Catégories</span>
          <div className="chips chips-wrap">{CATEGORIES.map(t => <button type="button" key={t} aria-pressed={f.tags.includes(t)} className={`chip chip-soft${f.tags.includes(t) ? ' on' : ''}`} onClick={() => set('tags', f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t])}>{t}</button>)}</div>
        </div>
        <div className="field"><span className="field-label">Allergènes présents (obligatoire)</span>
          <div className="chips chips-wrap">{ALLERGENS.map(a => <button type="button" key={a} disabled={f.none} aria-pressed={f.allergens.includes(a)} className={`chip chip-soft${f.allergens.includes(a) ? ' on' : ''}`} onClick={() => set('allergens', f.allergens.includes(a) ? f.allergens.filter(x => x !== a) : [...f.allergens, a])}>{a}</button>)}</div>
          <label className="check check-tight"><input type="checkbox" checked={f.none} onChange={e => { set('none', e.target.checked); if (e.target.checked) set('allergens', []) }} /><span>Aucun de ces 14 allergènes</span></label>
        </div>
        <div className="field"><span className="field-label">Photo principale (depuis vos photos de plats)</span>
          <div className="gallery">{photos.map(p => (
            <button type="button" key={p.id} className="ph" onClick={() => set('photo', p.src)} style={{ padding: 0, cursor: 'pointer', outline: f.photo === p.src ? '3px solid var(--sky)' : 'none', outlineOffset: 2 }} aria-pressed={f.photo === p.src}>
              <img src={p.src} alt={p.caption} />{f.photo === p.src && <span className="ph-cover">Choisie</span>}
            </button>
          ))}</div>
        </div>
        <label className="field"><span className="field-label">Description</span><textarea className="input" rows={3} value={f.desc} onChange={e => set('desc', e.target.value)} placeholder="L’ambiance, l’histoire du plat…" maxLength={2000} /></label>
        <label className="field"><span className="field-label">Menu (un plat par ligne)</span><textarea className="input" rows={3} value={f.menu} onChange={e => set('menu', e.target.value)} placeholder={'Entrée : salade de saison\nPlat : couscous\nDessert : cornes de gazelle'} maxLength={2000} /></label>
        <div className="note"><Icon name="map" size={18} /><span>Votre adresse exacte reste privée : seuls les invités qui ont payé la voient.</span></div>
        {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
        <button className="btn btn-primary btn-block btn-lg" type="submit">Publier mon repas</button>
      </form>
    )
  }

  return (
    <>
      <Head title="Mes repas" text="Tous vos repas, à venir et passés." action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> Proposer un repas</button>} />
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
              <button className="btn btn-ghost btn-sm" onClick={() => duplicate(m)}>Dupliquer</button>
              {m.status === 'online' && <button className="btn btn-ghost btn-sm danger-link" onClick={() => ask({ title: 'Annuler ce repas ?', text: `« ${m.title} » sera retiré du site.${m.booked > 0 ? ` Les ${m.booked} invités seront remboursés en entier et prévenus par email.` : ''}`, yes: () => { setMeals(ms => ms.map(x => (x.id === m.id ? { ...x, status: 'cancelled' } : x))); toast('Repas annulé, invités remboursés') } })}>Annuler</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ═══════════════════ Photos ═══════════════════

function Photos({ photos, setPhotos, toast }: { photos: Photo[]; setPhotos: (f: (p: Photo[]) => Photo[]) => void; toast: (m: string) => void }) {
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    const ok = [...files].filter(f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 15 * 1024 * 1024)
    if (ok.length < files.length) toast('Certaines images ont été ignorées : JPEG, PNG ou WebP, 15 Mo maximum.')
    const room = 12 - photos.length
    if (room <= 0) { toast('12 photos maximum'); return }
    setBusy(true)
    try {
      const added = await Promise.all(ok.slice(0, room).map(async f => ({ id: `p${Date.now()}${Math.random()}`, src: await shrink(f), caption: f.name.replace(/\.[^.]+$/, '').slice(0, 60) })))
      setPhotos(p => [...p, ...added])
      if (added.length) toast(`${added.length} photo${added.length > 1 ? 's' : ''} ajoutée${added.length > 1 ? 's' : ''}`)
    } catch { toast('Impossible de lire cette image') } finally { setBusy(false) }
  }

  const move = (i: number, d: number) => setPhotos(p => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a })

  return (
    <>
      <Head title="Photos de vos plats" text="La première photo est la photo de couverture. Utilisez les flèches pour changer l’ordre." />
      <div className="gallery">
        {photos.map((p, i) => (
          <figure key={p.id} className="ph" style={{ margin: 0 }}>
            <img src={p.src} alt={p.caption} />
            {i === 0 && <span className="ph-cover">Couverture</span>}
            <div className="ph-tools">
              {i > 0 && <button onClick={() => move(i, -1)} aria-label="Avancer"><Icon name="back" size={16} /></button>}
              {i < photos.length - 1 && <button onClick={() => move(i, 1)} aria-label="Reculer"><Icon name="arrow" size={16} /></button>}
              {i > 0 && <button onClick={() => { setPhotos(ps => [ps[i], ...ps.filter((_, k) => k !== i)]); toast('Nouvelle photo de couverture') }} aria-label="Mettre en couverture"><Icon name="star" size={16} /></button>}
              <button onClick={() => setPhotos(ps => ps.filter(x => x.id !== p.id))} aria-label="Supprimer"><Icon name="trash" size={16} /></button>
            </div>
          </figure>
        ))}
        {photos.length < 12 && (
          <label className={`drop${over ? ' over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}>
            <Icon name={busy ? 'clock' : 'camera'} size={32} />
            <strong>{busy ? 'Préparation…' : 'Ajouter des photos'}</strong>
            <span className="small muted">Cliquez, prenez une photo ou glissez-les ici</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      <p className="muted small" style={{ marginTop: '0.8rem' }}>{photos.length} / 12 photos · Les photos sont réduites automatiquement pour charger vite.</p>
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

function Visibility({ score, checks, go, photo, bio, meal, reviews }: { score: { done: number; total: number }; checks: { id: string; ok: boolean; t: string; d: string; tab: TabId; pts: number }[]; go: (t: TabId) => void; photo?: string; bio: string; meal?: DemoMeal; reviews: DemoReview[] }) {
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  return (
    <>
      <Head title="Votre visibilité" text="Votre place dans les résultats de recherche dépend de ces points. Cliquez sur un point pour le régler." />
      <div className="score-box" style={{ background: 'rgba(167,199,231,0.05)', border: '1px solid var(--line)' }}>
        <span className="tile-icon"><Icon name="rocket" size={28} /></span>
        <div style={{ flex: 1, minWidth: '14rem' }}>
          <h3 style={{ margin: '0 0 0.4rem' }}>{score.done} conseil{score.done > 1 ? 's' : ''} suivi{score.done > 1 ? 's' : ''} sur {score.total}</h3>
          <p className="muted" style={{ margin: '0 0 0.8rem', lineHeight: 1.6 }}>{score.done === score.total ? 'Bravo, votre profil est parmi les mieux présentés.' : 'Regardez la liste ci-dessous et cliquez sur « Corriger ».'}</p>
          <div className="progress" style={{ maxWidth: 320 }}><i style={{ width: `${(score.done / score.total) * 100}%` }} /></div>
          {score.done === score.total && <span className="tag" style={{ display: 'inline-block', marginTop: '0.8rem' }}>Badge « Hôte recommandé »</span>}
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
            <div className="meal-photo"><img src={photo || meal.photo} alt="" />{avg > 0 && <span className="meal-rating">★ {avg.toFixed(1)}</span>}</div>
            <div className="meal-body">
              <h3 className="meal-title">{meal.title}</h3>
              <p className="meal-host">Chez {HOST_DEMO.name} {score.done >= 3 && <span className="tag" style={{ marginLeft: 4 }}>Identité vérifiée</span>}</p>
              <div className="meal-meta"><span>{HOST_DEMO.city}</span><span>·</span><span>{fmtDate(meal.date)}</span></div>
              <div className="meal-foot"><span className="meal-cuisine">{meal.cuisine}</span><span className="meal-price">{eur(displayPrice(meal.price))} <small>/ couvert</small></span></div>
            </div>
          </article>
        ) : <p className="muted">Publiez un repas pour voir l’aperçu.</p>}
        <div>
          <div className="serp">
            <small>shareat.fr › bordeaux › {meal?.cuisine.toLowerCase() ?? 'repas'}</small>
            <h4>{meal ? `${meal.title} chez l’habitant à ${HOST_DEMO.city}` : 'Votre repas'} | Shareat</h4>
            <p>{bio.slice(0, 150)}{bio.length > 150 ? '…' : ''}</p>
          </div>
          <p className="muted small" style={{ marginTop: '0.7rem', lineHeight: 1.6 }}>Aperçu sur Google : un titre clair (plat + ville) et une présentation soignée aident votre page à être trouvée.</p>
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

function Guests({ meals, guests, toast, report, go, block, blocked }: { meals: DemoMeal[]; guests: typeof HOST_DEMO.guests; toast: (m: string) => void; report: (n: string) => void; go: (t: TabId) => void; block: (n: string) => void; blocked: string[] }) {
  const list = meals.filter(m => m.status !== 'cancelled')
  const [cur, setCur] = useState(list[0]?.id)
  const [msg, setMsg] = useState('')
  const g = guests.filter(x => x.mealId === cur)
  const meal = meals.find(m => m.id === cur)
  return (
    <>
      <Head title="Mes invités" text="Qui vient à vos repas. Les remarques (allergies, enfants…) sont importantes." />
      <div className="pill-tabs glass">{list.map(m => <button key={m.id} className={cur === m.id ? 'on' : ''} onClick={() => setCur(m.id)}>{m.title} · {fmtDate(m.date)}</button>)}</div>
      {g.length === 0 ? <div className="empty-soft"><Icon name="users" size={36} /><p>Personne n’a encore réservé ce repas.</p></div> : (
        <div className="row-list">
          {g.map(x => (
            <div key={x.id} className="row">
              <Avatar name={x.name} size={46} />
              <div className="row-txt"><strong>{x.name}</strong><span>{x.seats} place{x.seats > 1 ? 's' : ''}{x.note ? ` · ${x.note}` : ''}</span></div>
              {x.note && <span className="tag tag-warn">À lire</span>}
              <div className="row-btns-inline">
                <button className="btn btn-ghost btn-sm" onClick={() => go('messages')}>Écrire</button>
                <button className="btn btn-ghost btn-sm" onClick={() => report(x.name)} aria-label={`Signaler ${x.name}`}><Icon name="flag" size={15} /></button>
                {blocked.includes(x.name) ? <span className="status status-cancelled">Bloqué</span> : <button className="btn btn-ghost btn-sm danger-link" onClick={() => block(x.name)}>Bloquer</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {meal?.status === 'online' && g.length > 0 && (
        <form style={{ marginTop: '1.4rem' }} onSubmit={e => { e.preventDefault(); if (msg.trim()) { toast(`Message envoyé aux ${g.length} invités`); setMsg('') } }}>
          <span className="field-label">Écrire à tous les invités de ce repas</span>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input className="input input-pill" style={{ flex: 1, minWidth: '12rem' }} value={msg} onChange={e => setMsg(e.target.value)} placeholder="Ex. : Sonnez à l’interphone « Exemple », 2e étage." maxLength={1000} />
            <button className="btn btn-primary" type="submit" disabled={!msg.trim()}>Envoyer à tous</button>
          </div>
        </form>
      )}
    </>
  )
}

// ═══════════════════ Avis ═══════════════════

const GUEST_CRIT = ['Ponctualité', 'Respect du lieu', 'Communication']

function Reviews({ reviews, setReviews, toReview, meals, onReviewed, toast }: { reviews: DemoReview[]; setReviews: (f: (r: DemoReview[]) => DemoReview[]) => void; toReview: typeof HOST_DEMO.guests; meals: DemoMeal[]; onReviewed: (id: string) => void; toast: (m: string) => void }) {
  const [view, setView] = useState<'recus' | 'invites'>(toReview.length ? 'invites' : 'recus')
  const [open, setOpen] = useState<string | null>(null)
  const [crit, setCrit] = useState<Record<string, number>>({})
  const [again, setAgain] = useState(true)
  const [text, setText] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const avg = useMemo(() => (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0), [reviews])

  const send = (id: string) => {
    if (GUEST_CRIT.some(c => !crit[c])) { toast('Donnez une note pour chaque point'); return }
    onReviewed(id)
    setOpen(null); setCrit({}); setText(''); setPrivateNote(''); setAgain(true)
    toast('Merci ! Votre avis sera visible quand l’invité aura aussi donné le sien (ou dans 14 jours).')
  }

  return (
    <>
      <Head title="Avis" text={reviews.length ? <>Votre note : <Stars n={avg} /> {avg.toFixed(1).replace('.', ',')} sur 5 ({reviews.length} avis)</> : 'Pas encore d’avis.'} />
      <div className="pill-tabs glass">
        <button className={view === 'invites' ? 'on' : ''} onClick={() => setView('invites')}>Sur mes invités {toReview.length > 0 && `(${toReview.length})`}</button>
        <button className={view === 'recus' ? 'on' : ''} onClick={() => setView('recus')}>Reçus</button>
      </div>

      {view === 'invites' && (
        toReview.length === 0 ? <div className="empty-soft"><Icon name="check" size={36} /><p>Tous vos invités ont reçu un avis. Merci !</p></div> : (
          <div className="row-list">
            <div className="note"><Icon name="shield" size={18} /><span>Vos avis aident les autres hôtes. Restez honnête et poli. Les avis sont publiés en même temps des deux côtés, pour être sincères.</span></div>
            {toReview.map(g => (
              <div key={g.id} className="review-card">
                <header><Avatar name={g.name} size={38} /><strong>{g.name}</strong><span className="muted small">{meals.find(m => m.id === g.mealId)?.title}</span>
                  {open !== g.id && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(g.id)}>Donner mon avis</button>}
                </header>
                {open === g.id && (
                  <form className="fade-swap" onSubmit={e => { e.preventDefault(); send(g.id) }}>
                    <div className="criteria">{GUEST_CRIT.map(c => <div key={c} className="crit"><span>{c}</span><StarPicker label={c} value={crit[c] || 0} onChange={n => setCrit(p => ({ ...p, [c]: n }))} /></div>)}</div>
                    <div className="set-row" style={{ paddingTop: 0 }}><div><strong>Je recevrais cette personne à nouveau</strong></div><Toggle on={again} onChange={setAgain} label="Je recevrais à nouveau" /></div>
                    <textarea className="input" rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Un petit mot public (facultatif)" maxLength={800} style={{ marginTop: '0.8rem' }} />
                    <textarea className="input" rows={2} value={privateNote} onChange={e => setPrivateNote(e.target.value)} placeholder="Note privée pour l’équipe Shareat (facultatif, jamais publiée)" maxLength={800} style={{ marginTop: '0.6rem' }} />
                    <div className="row-btns" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Plus tard</button><button className="btn btn-primary" type="submit">Publier</button></div>
                  </form>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {view === 'recus' && (
        <div className="row-list">
          {reviews.map(r => (
            <div key={r.id} className="review-card">
              <header><Avatar name={r.author} size={38} /><strong>{r.author}</strong><Stars n={r.rating} /><span className="muted small">{r.meal} · {fmtDate(r.date)}</span></header>
              <p>{r.text}</p>
              {r.reply && <p className="reply">Votre réponse : {r.reply}</p>}
              {!r.reply && replyFor !== r.id && <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => { setReplyFor(r.id); setReply('') }}>Répondre publiquement</button>}
              {replyFor === r.id && (
                <form className="fade-swap" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); if (reply.trim()) { setReviews(rs => rs.map(x => (x.id === r.id ? { ...x, reply: reply.trim().slice(0, 600) } : x))); setReplyFor(null); toast('Réponse publiée') } }}>
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

/** Données d'exemple selon la période choisie (14 jours, 8 semaines ou 6 mois). */
function revenueSeries(period: Period): [string, number][] {
  const short = (iso: string, opts: Intl.DateTimeFormatOptions) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts) }
  if (period === 'jour') {
    const vals = [0, 0, 54, 0, 0, 0, 150, 0, 0, 72, 0, 0, 0, 36]
    return vals.map((v, i) => [short(inDays(i - 13), { weekday: 'short', day: 'numeric' }), v])
  }
  if (period === 'semaine') {
    const vals = [36, 90, 0, 126, 54, 96, 150, 108]
    return vals.map((v, i) => [`${short(inDays((i - 7) * 7), { day: 'numeric', month: 'short' })}`, v])
  }
  return HOST_DEMO.months
}

const PERIOD_LABEL: Record<Period, string> = { jour: 'sur 14 jours', semaine: 'sur 8 semaines', mois: 'sur 6 mois' }

function Revenue() {
  const [period, setPeriod] = useState<Period>('mois')
  const [hover, setHover] = useState<number | null>(null)
  const data = revenueSeries(period)
  const max = Math.max(...data.map(m => m[1]), 1)
  const total = data.reduce((s, m) => s + m[1], 0)
  const best = data.reduce((b, m) => (m[1] > b[1] ? m : b), data[0])
  return (
    <>
      <Head title="Revenus" text={`Vos gains sont virés ${TRANSFER_DELAY_HOURS} h après chaque repas, sur votre compte bancaire.`} action={<button className="btn btn-ghost" disabled title="Disponible une fois le site relié à Stripe">Récapitulatif annuel (PDF)</button>} />
      <div className="stats" style={{ marginBottom: '1.4rem' }}>
        <div className="stat"><strong>{eur(total)}</strong><span>Gagnés {PERIOD_LABEL[period]}</span></div>
        <div className="stat"><strong>{eur(0)}</strong><span>En attente</span></div>
        <div className="stat"><strong>{HOST_DEMO.payouts.length}</strong><span>Virements</span></div>
      </div>
      <div className="chart-head">
        <h3 className="subtitle" style={{ margin: 0 }}>Vos gains</h3>
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
      <p className="chart-sum">{best[1] > 0 ? <>Meilleure période : <strong style={{ color: 'var(--text)' }}>{best[0]}</strong> avec {eur(best[1])}. </> : null}{data.length > 8 && 'Touchez une barre pour voir le montant.'}</p>
      <div style={{ marginTop: '1.4rem' }}><FeeBox /></div>
      <h3 className="subtitle">Derniers virements</h3>
      <div className="row-list">
        {HOST_DEMO.payouts.map(p => (
          <div key={p.id} className="row"><span className="tile-icon" style={{ width: 44, height: 44, borderRadius: 14 }}><Icon name="euro" /></span><div className="row-txt"><strong>{eur(p.amount)}</strong><span>{p.meal} · viré le {fmtDate(p.date)}</span></div><span className="status status-confirmed">Versé</span></div>
        ))}
      </div>
      <div className="note warn"><Icon name="doc" size={18} /><span>Ces revenus sont à déclarer aux impôts. Le récapitulatif annuel vous aide à le faire.</span></div>
    </>
  )
}

const HOST_NOTIFS = [
  { id: 'booking', t: 'Nouvelle réservation', d: 'Dès qu’un invité réserve une place à l’un de vos repas.', on: true },
  { id: 'cancel', t: 'Annulation d’un invité', d: 'Pour savoir tout de suite qu’une place se libère.', on: true },
  { id: 'messages', t: 'Nouveaux messages', d: 'Répondre vite améliore votre visibilité.', on: true },
  { id: 'reminder', t: 'Rappel la veille du repas', d: 'Avec la liste des invités et leurs remarques (allergies…).', on: true },
  { id: 'payout', t: 'Virement envoyé', d: 'Quand vos gains partent vers votre compte bancaire.', on: true },
  { id: 'reviews', t: 'Nouvel avis reçu', d: 'Pour pouvoir y répondre.', on: true },
  { id: 'tips', t: 'Conseils pour remplir vos repas', d: 'Une fois par mois, au maximum.', on: false },
  { id: 'sms', t: 'SMS pour les urgences', d: 'Si un invité annule moins de 24 h avant le repas.', on: false },
]

// ═══════════════════ Profil et vérification ═══════════════════

type HostProfile = { bio: string; langs: string[]; idVerified: boolean; phoneVerified: boolean; payouts: boolean; fastReply: boolean }

function Profile({ profile, setProfile, toast, blocked, unblock }: { profile: HostProfile; setProfile: (f: (p: HostProfile) => HostProfile) => void; toast: (m: string) => void; blocked: string[]; unblock: (n: string) => void }) {
  const [bio, setBio] = useState(profile.bio)
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const LANGS = ['Français', 'Anglais', 'Arabe', 'Espagnol', 'Italien', 'Portugais', 'Allemand']
  return (
    <>
      <Head title="Profil et vérification" text="Un profil complet et vérifié rassure les invités." />
      <label className="field"><span className="field-label">Présentation ({bio.trim().length} caractères, 80 conseillés)</span>
        <textarea className="input" rows={4} value={bio} onChange={e => setBio(e.target.value)} maxLength={1200} placeholder="Qui êtes-vous ? D’où vient votre cuisine ?" /></label>
      <div className="field"><span className="field-label">Langues parlées</span>
        <div className="chips chips-wrap">{LANGS.map(l => <button key={l} type="button" aria-pressed={profile.langs.includes(l)} className={`chip${profile.langs.includes(l) ? ' on' : ''}`} onClick={() => setProfile(p => ({ ...p, langs: p.langs.includes(l) ? p.langs.filter(x => x !== l) : [...p.langs, l] }))}>{l}</button>)}</div>
      </div>
      <button className="btn btn-primary" onClick={() => { setProfile(p => ({ ...p, bio: bio.trim() })); toast('Profil enregistré') }}>Enregistrer</button>

      <h3 className="subtitle">Vérifications</h3>
      <div className="set-row"><div><strong><Icon name="shield" size={16} /> Identité</strong><p>Vérifiée par Stripe avec une pièce d’identité. Badge visible sur votre profil.</p></div>{profile.idVerified ? <span className="status status-confirmed">Vérifiée</span> : <button className="btn btn-ghost btn-sm">Vérifier</button>}</div>
      <div className="set-row"><div><strong><Icon name="euro" size={16} /> Versements</strong><p>Compte bancaire relié via Stripe.</p></div>{profile.payouts ? <span className="status status-confirmed">Actifs</span> : <button className="btn btn-ghost btn-sm">Activer</button>}</div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div><strong><Icon name="phone" size={16} /> Téléphone</strong><p>Jamais montré aux invités. Sert à sécuriser votre compte.</p></div>
        {profile.phoneVerified ? <span className="status status-confirmed">Vérifié</span> : phoneStep === 'idle' ? (
          <form style={{ display: 'flex', gap: '0.5rem' }} onSubmit={e => { e.preventDefault(); if (/^(\+33|0)[1-9](\d{2}){4}$/.test(phone.replace(/\s/g, ''))) setPhoneStep('code'); else toast('Numéro français invalide') }}>
            <input className="input input-pill" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" autoComplete="tel" style={{ width: '11rem' }} />
            <button className="btn btn-ghost btn-sm" type="submit">Recevoir un code</button>
          </form>
        ) : (
          <form className="fade-swap" style={{ display: 'flex', gap: '0.5rem' }} onSubmit={e => { e.preventDefault(); if (/^\d{6}$/.test(code)) { setProfile(p => ({ ...p, phoneVerified: true })); toast('Téléphone vérifié : un conseil de visibilité en plus') } else toast('Tapez les 6 chiffres reçus par SMS') }}>
            <input className="input input-pill" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code à 6 chiffres" inputMode="numeric" autoComplete="one-time-code" style={{ width: '10rem' }} />
            <button className="btn btn-primary btn-sm" type="submit">Valider</button>
          </form>
        )}
      </div>
      <div className="set-row"><div><strong><Icon name="clock" size={16} /> Réponses rapides</strong><p>Recevoir une notification à chaque nouveau message pour répondre en moins de 12 h.</p></div><Toggle on={profile.fastReply} onChange={v => setProfile(p => ({ ...p, fastReply: v }))} label="Réponses rapides" /></div>
      <h3 className="subtitle">Personnes bloquées</h3>
      <p className="muted small" style={{ marginTop: '-0.4rem' }}>Bloquez un invité depuis « Mes invités » ou une conversation, sans avoir à vous justifier.</p>
      <BlockedList blocked={blocked} onUnblock={unblock} />
      <p className="muted small" style={{ marginTop: '1.2rem' }}>Mot de passe, double vérification, appareils connectés : voir <Link className="inline-link" href="/mon-compte?onglet=securite">Sécurité du compte</Link>.</p>
    </>
  )
}

// ═══════════════════ À venir (repas de l'hôte + modalités) ═══════════════════

function Upcoming({ meals, guests, go }: { meals: DemoMeal[]; guests: typeof HOST_DEMO.guests; go: (t: TabId) => void }) {
  const list = meals.filter(m => m.status === 'online').sort((a, b) => a.date.localeCompare(b.date))
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
                  <span>{m.booked} / {m.seats} places réservées · {g.length} invité{g.length > 1 ? 's' : ''}</span>
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
          ['leaf', 'Allergènes', 'Ce que vous avez déclaré doit correspondre à ce que vous servez. Lisez les remarques de vos invités.'],
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
        <p>Sur chaque place réservée, Shareat prend une commission de <strong style={{ color: 'var(--text)' }}>{pct} %</strong>. Elle paie le paiement sécurisé (Stripe), le service client tous les jours, les remboursements et la sécurité du site.</p>
        {COMMISSION_PROVISIONAL && <p><strong style={{ color: 'var(--warn)' }}>Taux provisoire :</strong> le pourcentage définitif sera fixé avant l’ouverture et affiché ici. Vous serez prévenu par email avant tout changement.</p>}
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
