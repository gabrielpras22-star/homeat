'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import Icon from '../components/site/Icons'
import PasswordField from '../components/site/PasswordField'
import { Avatar, BlockModal, BlockedList, Confirm, Head, Messenger, ReportModal, SpaceLayout, StarPicker, Stars, Toggle, eur, fmtDate, fmtTime, useToast } from '../components/space/Kit'
import { GUEST_DEMO, UPCOMING_DEMO, inDays, type DemoReview } from '@/lib/apercu'
import { ALLERGENS, CATEGORIES, COMMISSION_RATE, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, displayPrice, parisDateTime } from '@/lib/shared'
import { passwordOk } from '@/lib/security'

type Booking = typeof GUEST_DEMO.bookings[number] & { reviewed?: boolean; refunded?: number }
const TAB_IDS = ['accueil', 'notifications', 'avenir', 'reservations', 'avis', 'favoris', 'messages', 'profil', 'notifications', 'securite', 'demandes'] as const
type TabId = typeof TAB_IDS[number]

const hoursUntil = (b: Booking) => (parisDateTime(b.date, b.time).getTime() - Date.now()) / 3_600_000

/** Fichier calendrier (.ics) pour ajouter le repas à son agenda. */
function downloadIcs(b: Booking) {
  const start = parisDateTime(b.date, b.time)
  const end = new Date(start.getTime() + 3 * 3_600_000)
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shareat//FR', 'BEGIN:VEVENT', `UID:${b.ref}@shareat`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${b.title} chez ${b.host}`, `LOCATION:${b.address || b.city}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `shareat-${b.ref}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function GuestSpace() {
  const params = useSearchParams()
  const initial = params.get('onglet') as TabId | null
  const [tab, setTab] = useState<TabId>(initial && TAB_IDS.includes(initial) ? initial : 'accueil')
  const [toast, toastNode] = useToast()
  const [bookings, setBookings] = useState<Booking[]>(GUEST_DEMO.bookings)
  const [favs, setFavs] = useState(GUEST_DEMO.favorites)
  const [myReviews, setMyReviews] = useState<DemoReview[]>(GUEST_DEMO.myReviews)
  const [threads, setThreads] = useState(GUEST_DEMO.threads)
  const [confirm, setConfirm] = useState<{ title: string; text: string; yes: () => void; label: string } | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string[]>([])
  const [blockAsk, setBlockAsk] = useState<string | null>(null)
  const unblock = (n: string) => { setBlocked(b => b.filter(x => x !== n)); toast(`${n} est débloqué(e)`) }

  const toReview = bookings.filter(b => b.status === 'past' && !b.reviewed)
  const unread = threads.reduce((s, t) => s + t.unread, 0)

  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'avenir', label: 'À venir', icon: 'sparkle' },
    { id: 'reservations', label: 'Mes réservations', icon: 'calendar' },
    { id: 'avis', label: 'Mes avis', icon: 'star', badge: toReview.length },
    { id: 'favoris', label: 'Favoris', icon: 'heart' },
    { id: 'messages', label: 'Messages', icon: 'chat', badge: unread },
    { id: 'profil', label: 'Mon profil', icon: 'user' },
    { id: 'securite', label: 'Sécurité', icon: 'lock' },
    { id: 'demandes', label: 'Mes demandes d’aide', icon: 'help' },
  ]

  const cancel = (b: Booking) => {
    const free = hoursUntil(b) >= FREE_CANCELLATION_HOURS
    setConfirm({
      title: 'Annuler cette réservation ?',
      label: 'Oui, annuler',
      text: free
        ? `Vous serez remboursé de ${eur(b.total)} en entier, sous 5 à 10 jours, sur la carte utilisée.`
        : `Le repas est dans moins de ${FREE_CANCELLATION_HOURS} h : la place n’est plus remboursable (l’hôte a déjà fait ses courses). Vous pouvez quand même libérer la place.`,
      yes: () => { setBookings(bs => bs.map(x => (x.id === b.id ? { ...x, status: 'cancelled', refunded: free ? b.total : 0 } : x))); toast(free ? `Réservation annulée : ${eur(b.total)} remboursés` : 'Réservation annulée') },
    })
  }

  return (
    <>
      <SpaceLayout who={GUEST_DEMO.name} role="Espace invité" tabs={tabs} tab={tab} setTab={t => setTab(t as TabId)} switchTo={{ href: '/espace-hote', label: 'Passer en mode hôte' }}>
        {tab === 'accueil' && <Home bookings={bookings} toReview={toReview.length} unread={unread} go={setTab} />}
        {tab === 'avenir' && <Upcoming toast={toast} />}
        {tab === 'reservations' && <Bookings bookings={bookings} cancel={cancel} go={setTab} report={setReport} block={setBlockAsk} blocked={blocked} />}
        {tab === 'avis' && <Reviews toReview={toReview} myReviews={myReviews} onSent={(b, r) => { setBookings(bs => bs.map(x => (x.id === b.id ? { ...x, reviewed: true } : x))); setMyReviews(rs => [r, ...rs]); toast('Merci pour votre avis !') }} />}
        {tab === 'favoris' && <Favorites favs={favs} remove={id => { setFavs(f => f.filter(x => x.id !== id)); toast('Retiré des favoris') }} />}
        {tab === 'messages' && (<><Head title="Messages" text="Discutez avec vos hôtes avant et après le repas." /><Messenger threads={threads} setThreads={setThreads} onReport={setReport} blocked={blocked} onBlock={setBlockAsk} onUnblock={unblock} /></>)}
        {tab === 'profil' && <Profile toast={toast} />}
        {tab === 'notifications' && <Notifications toast={toast} />}
        {tab === 'securite' && <Security toast={toast} ask={setConfirm} blocked={blocked} unblock={unblock} />}
        {tab === 'demandes' && <Tickets />}
      </SpaceLayout>
      {confirm && <Confirm title={confirm.title} confirm={confirm.label} danger onNo={() => setConfirm(null)} onYes={() => { confirm.yes(); setConfirm(null) }}>{confirm.text}</Confirm>}
      {report && <ReportModal name={report} onClose={() => setReport(null)} onSent={() => { setReport(null); toast('Signalement envoyé. Notre équipe regarde sous 24 h.') }} />}
      {blockAsk && <BlockModal name={blockAsk} who="host" onClose={() => setBlockAsk(null)} onYes={() => { setBlocked(b => (b.includes(blockAsk) ? b : [...b, blockAsk])); toast(`${blockAsk} est bloqué(e)`); setBlockAsk(null) }} />}
      {toastNode}
    </>
  )
}

// ═══════════════════ Accueil ═══════════════════

function Home({ bookings, toReview, unread, go }: { bookings: Booking[]; toReview: number; unread: number; go: (t: TabId) => void }) {
  const next = bookings.filter(b => b.status === 'confirmed').sort((a, b) => a.date.localeCompare(b.date))[0]
  const days = next ? Math.max(0, Math.ceil(hoursUntil(next) / 24)) : 0
  return (
    <>
      <Head title={`Bonjour ${GUEST_DEMO.name.split(' ')[0]}`} text="Content de vous revoir." action={<Link className="btn btn-primary" href="/?vue=explorer"><Icon name="search" size={18} /> Trouver un repas</Link>} />
      {next ? (
        <div className="row" style={{ padding: '1.2rem', marginBottom: '1.4rem' }}>
          <img src={next.photo} alt="" style={{ width: 96, height: 96 }} />
          <div className="row-txt">
            <span className="eyebrow" style={{ margin: 0 }}>Prochain repas</span>
            <strong style={{ fontSize: '1.2rem' }}>{next.title}</strong>
            <span>Chez {next.host} · {fmtDate(next.date, true)} à {fmtTime(next.time)}</span>
          </div>
          <div style={{ textAlign: 'center' }}><span className="counter">{days}</span><p className="muted small" style={{ margin: 0 }}>jour{days > 1 ? 's' : ''}</p></div>
          <button className="btn btn-ghost btn-sm" onClick={() => go('reservations')}>Voir l’adresse</button>
        </div>
      ) : <div className="empty-soft"><p>Aucun repas prévu. Et si vous en trouviez un ?</p></div>}
      <div className="cards">
        {[
          { t: 'Avis à donner', v: toReview, tab: 'avis' as TabId, icon: 'star', d: 'Aidez les autres en racontant votre soirée.' },
          { t: 'Messages non lus', v: unread, tab: 'messages' as TabId, icon: 'chat', d: 'Vos hôtes vous ont répondu.' },
          { t: 'Sécurité du compte', v: null, tab: 'securite' as TabId, icon: 'shield', d: 'Activez la double vérification.' },
        ].map(c => (
          <button key={c.t} className="info-card" style={{ background: 'rgba(220,233,247,0.04)', border: '1px solid var(--line)', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }} onClick={() => go(c.tab)}>
            <span className="tile-icon"><Icon name={c.icon} /></span>
            <h3>{c.t} {c.v ? <span className="badge">{c.v}</span> : null}</h3>
            <p>{c.d}</p>
          </button>
        ))}
      </div>
    </>
  )
}

// ═══════════════════ Réservations ═══════════════════

function Bookings({ bookings, cancel, go, report, block, blocked }: { bookings: Booking[]; cancel: (b: Booking) => void; go: (t: TabId) => void; report: (n: string) => void; block: (n: string) => void; blocked: string[] }) {
  const [view, setView] = useState<'avenir' | 'passees'>('avenir')
  const [receipt, setReceipt] = useState<Booking | null>(null)
  const list = bookings.filter(b => (view === 'avenir' ? b.status === 'confirmed' : b.status !== 'confirmed'))
  return (
    <>
      <Head title="Mes réservations" text={`Annulation gratuite jusqu’à ${FREE_CANCELLATION_HOURS} h avant le repas.`} />
      <div className="pill-tabs glass">
        <button className={view === 'avenir' ? 'on' : ''} onClick={() => setView('avenir')}>À venir</button>
        <button className={view === 'passees' ? 'on' : ''} onClick={() => setView('passees')}>Passées et annulées</button>
      </div>
      {list.length === 0 ? <div className="empty-soft"><Icon name="calendar" size={36} /><p>Rien ici pour l’instant.</p><Link className="btn btn-primary" href="/?vue=explorer">Trouver un repas</Link></div> : (
        <div className="row-list">
          {list.map(b => {
            const free = hoursUntil(b) >= FREE_CANCELLATION_HOURS
            return (
              <div key={b.id} className="row" style={{ alignItems: 'flex-start' }}>
                <img src={b.photo} alt="" />
                <div className="row-txt">
                  <strong>{b.title}</strong>
                  <span>Chez {b.host} · {fmtDate(b.date)} à {fmtTime(b.time)} · {b.seats} place{b.seats > 1 ? 's' : ''} · {eur(b.total)}</span>
                  {b.status === 'confirmed' && <span style={{ color: 'var(--text)' }}><Icon name="map" size={14} /> {b.address}</span>}
                  {b.status === 'confirmed' && <span style={{ color: free ? 'var(--ok)' : 'var(--warn)' }}>{free ? 'Annulation gratuite encore possible' : `Moins de ${FREE_CANCELLATION_HOURS} h : non remboursable`}</span>}
                  {b.status === 'cancelled' && <span>Annulée{b.refunded ? ` · ${eur(b.refunded)} remboursés` : ''}</span>}
                  <span className="row-actions" style={{ marginTop: '0.3rem' }}>
                    {b.status === 'confirmed' && <><button className="link" onClick={() => downloadIcs(b)}>Ajouter à mon agenda</button><button className="link" onClick={() => go('messages')}>Écrire à l’hôte</button><button className="link danger-link" onClick={() => cancel(b)}>Annuler</button></>}
                    {b.status === 'past' && !b.reviewed && <button className="link" onClick={() => go('avis')}>Donner mon avis</button>}
                    <button className="link" onClick={() => setReceipt(b)}>Reçu</button>
                    <button className="link" onClick={() => report(b.host)}>Signaler un problème</button>
                    {blocked.includes(b.host) ? <span className="muted small">Hôte bloqué</span> : <button className="link danger-link" onClick={() => block(b.host)}>Bloquer cet hôte</button>}
                  </span>
                </div>
                <span className={`status ${b.status === 'confirmed' ? 'status-confirmed' : b.status === 'cancelled' ? 'status-cancelled' : 'status-completed'}`}>{b.status === 'confirmed' ? 'Confirmée' : b.status === 'cancelled' ? 'Annulée' : 'Passée'}</span>
              </div>
            )
          })}
        </div>
      )}
      {receipt && (
        <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) setReceipt(null) }}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Reçu">
            <button className="modal-close" onClick={() => setReceipt(null)} aria-label="Fermer">×</button>
            <p className="eyebrow">Reçu · {receipt.ref}</p>
            <h2 className="title">{receipt.title}</h2>
            <div className="book-line"><span>{receipt.seats} place{receipt.seats > 1 ? 's' : ''}</span><span>{eur(receipt.total)}</span></div>
            <div className="book-line"><span>dont part de l’hôte</span><span>{eur(receipt.total / (1 + COMMISSION_RATE))}</span></div>
            <div className="book-line"><span>dont commission Shareat</span><span>{eur(receipt.total - receipt.total / (1 + COMMISSION_RATE))}</span></div>
            <div className="book-line book-total"><span>Payé par carte</span><span>{eur(receipt.total)}</span></div>
            <button className="btn btn-ghost btn-block" style={{ marginTop: '1rem' }} onClick={() => window.print()}>Imprimer</button>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════ Avis ═══════════════════

const HOST_CRIT = ['Cuisine', 'Accueil', 'Propreté', 'Rapport qualité-prix']

function Reviews({ toReview, myReviews, onSent }: { toReview: Booking[]; myReviews: DemoReview[]; onSent: (b: Booking, r: DemoReview) => void }) {
  const [view, setView] = useState<'donner' | 'donnes' | 'recus'>(toReview.length ? 'donner' : 'donnes')
  const [open, setOpen] = useState<string | null>(toReview[0]?.id ?? null)
  const [crit, setCrit] = useState<Record<string, number>>({})
  const [text, setText] = useState('')
  const [err, setErr] = useState('')

  const send = (b: Booking) => {
    setErr('')
    if (HOST_CRIT.some(c => !crit[c])) return setErr('Mettez des étoiles pour chaque point.')
    if (text.trim().length < 20) return setErr('Écrivez au moins une phrase (20 caractères) pour aider les autres.')
    const rating = Math.round(HOST_CRIT.reduce((s, c) => s + crit[c], 0) / HOST_CRIT.length)
    onSent(b, { id: `r-${b.id}`, author: 'Vous', rating, date: inDays(0), meal: b.title, text: text.trim().slice(0, 1000), crit })
    setCrit({}); setText(''); setOpen(null); setView('donnes')
  }

  return (
    <>
      <Head title="Mes avis" text="Seules les personnes qui ont vraiment participé au repas peuvent laisser un avis." />
      <div className="pill-tabs glass">
        <button className={view === 'donner' ? 'on' : ''} onClick={() => setView('donner')}>À donner {toReview.length > 0 && `(${toReview.length})`}</button>
        <button className={view === 'donnes' ? 'on' : ''} onClick={() => setView('donnes')}>Mes avis sur les hôtes</button>
        <button className={view === 'recus' ? 'on' : ''} onClick={() => setView('recus')}>Avis des hôtes sur moi</button>
      </div>

      {view === 'donner' && (toReview.length === 0 ? <div className="empty-soft"><Icon name="check" size={36} /><p>Vous avez donné tous vos avis. Merci !</p></div> : toReview.map(b => (
        <div key={b.id} className="review-card" style={{ marginBottom: '0.8rem' }}>
          <header><img src={b.photo} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} /><div><strong>{b.title}</strong><p className="muted small" style={{ margin: 0 }}>Chez {b.host} · {fmtDate(b.date)}</p></div>
            {open !== b.id && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setOpen(b.id)}>Donner mon avis</button>}</header>
          {open === b.id && (
            <form className="fade-swap" onSubmit={e => { e.preventDefault(); send(b) }}>
              <div className="criteria">{HOST_CRIT.map(c => <div key={c} className="crit"><span>{c}</span><StarPicker label={c} value={crit[c] || 0} onChange={n => setCrit(p => ({ ...p, [c]: n }))} /></div>)}</div>
              <textarea className="input" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Racontez votre soirée : le repas, l’ambiance, l’accueil…" maxLength={1000} />
              <span className="field-hint">{text.length} / 1000 · Restez poli : les avis injurieux sont retirés.</span>
              {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
              <div className="row-btns" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Plus tard</button><button className="btn btn-primary" type="submit">Publier mon avis</button></div>
            </form>
          )}
        </div>
      )))}

      {view === 'donnes' && <div className="row-list">{myReviews.map(r => (
        <div key={r.id} className="review-card">
          <header><strong>{r.meal}</strong><Stars n={r.rating} /><span className="muted small">{fmtDate(r.date)}</span></header>
          {r.crit && <div className="tag-row" style={{ marginTop: 0 }}>{Object.entries(r.crit).map(([k, v]) => <span key={k} className="tag">{k} {v}/5</span>)}</div>}
          <p>{r.text}</p>
        </div>
      ))}</div>}

      {view === 'recus' && <div className="row-list">{GUEST_DEMO.reviewsAboutMe.map(r => (
        <div key={r.id} className="review-card">
          <header><Avatar name={r.author} size={36} /><strong>{r.author}</strong><Stars n={r.rating} /><span className="muted small">{r.meal}</span></header>
          <p>{r.text}</p>
        </div>
      ))}<p className="muted small">Les hôtes notent la ponctualité, le respect du lieu et la communication. Un bon profil vous aide à être accepté partout.</p></div>}
    </>
  )
}

// ═══════════════════ Favoris ═══════════════════

function Favorites({ favs, remove }: { favs: typeof GUEST_DEMO.favorites; remove: (id: string) => void }) {
  return (
    <>
      <Head title="Favoris" text="Les repas et les hôtes que vous avez gardés de côté (cœur)." />
      {favs.length === 0 ? <div className="empty-soft"><Icon name="heart" size={36} /><p>Pas encore de favori. Touchez le cœur sur un repas pour le garder ici.</p></div> : (
        <div className="meal-grid">{favs.map(f => (
          <article key={f.id} className="meal-card">
            <div className="meal-photo"><img src={f.photo} alt="" /><button className="fav-btn on" aria-label="Retirer des favoris" onClick={() => remove(f.id)}><Icon name="heart" size={16} /></button></div>
            <div className="meal-body"><h3 className="meal-title">{f.title}</h3><p className="meal-host">Chez {f.host}</p><div className="meal-foot"><span className="meal-cuisine">{f.city}</span><span className="meal-price">{eur(f.price)} <small>/ couvert</small></span></div></div>
          </article>
        ))}</div>
      )}
    </>
  )
}

// ═══════════════════ Profil ═══════════════════

function Profile({ toast }: { toast: (m: string) => void }) {
  const [bio, setBio] = useState('')
  const [diet, setDiet] = useState<string[]>(['Sans porc'])
  const [allergies, setAllergies] = useState<string[]>([])
  const [city, setCity] = useState('Bordeaux')
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])
  return (
    <form onSubmit={e => { e.preventDefault(); toast('Profil enregistré') }}>
      <Head title="Mon profil" text="Ce que les hôtes voient de vous quand vous réservez." />
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.2rem' }}>
        <Avatar name={GUEST_DEMO.name} size={72} />
        <label className="btn btn-ghost btn-sm">Changer la photo<input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={() => toast('Photo mise à jour')} /></label>
      </div>
      <label className="field"><span className="field-label">Ville</span><input className="input" value={city} onChange={e => setCity(e.target.value)} maxLength={80} /></label>
      <label className="field"><span className="field-label">Quelques mots sur vous</span><textarea className="input" rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={600} placeholder="Ce que vous aimez manger, d’où vous venez…" /></label>
      <div className="field"><span className="field-label">Mes préférences (pour trouver plus vite)</span>
        <div className="chips chips-wrap">{CATEGORIES.map(c => <button type="button" key={c} aria-pressed={diet.includes(c)} className={`chip chip-soft${diet.includes(c) ? ' on' : ''}`} onClick={() => toggle(diet, setDiet, c)}>{c}</button>)}</div></div>
      <div className="field"><span className="field-label">Mes allergies (envoyées à l’hôte quand je réserve)</span>
        <div className="chips chips-wrap">{ALLERGENS.map(a => <button type="button" key={a} aria-pressed={allergies.includes(a)} className={`chip chip-soft${allergies.includes(a) ? ' on' : ''}`} onClick={() => toggle(allergies, setAllergies, a)}>{a}</button>)}</div></div>
      <button className="btn btn-primary" type="submit">Enregistrer</button>
    </form>
  )
}

// ═══════════════════ Notifications ═══════════════════

function Notifications({ toast }: { toast: (m: string) => void }) {
  const [n, setN] = useState({ booking: true, reminder: true, messages: true, reviews: true, news: false, sms: false })
  const rows: [keyof typeof n, string, string][] = [
    ['booking', 'Confirmations et annulations', 'Toujours conseillé : vous recevez l’adresse et les remboursements.'],
    ['reminder', 'Rappel la veille du repas', 'Un email la veille avec l’heure et l’adresse.'],
    ['messages', 'Nouveaux messages', 'Quand un hôte vous répond.'],
    ['reviews', 'Rappel pour donner mon avis', 'Le lendemain du repas.'],
    ['news', 'Nouveaux repas près de chez moi', 'Une fois par semaine, au maximum.'],
    ['sms', 'SMS en cas d’urgence', 'Si l’hôte annule moins de 24 h avant.'],
  ]
  return (
    <>
      <Head title="Notifications" text="Choisissez ce que vous voulez recevoir." />
      {rows.map(([k, t, d]) => (
        <div key={k} className="set-row"><div><strong>{t}</strong><p>{d}</p></div><Toggle on={n[k]} onChange={v => { setN(p => ({ ...p, [k]: v })); toast('Préférence enregistrée') }} label={t} /></div>
      ))}
    </>
  )
}

// ═══════════════════ Sécurité ═══════════════════

function Security({ toast, ask, blocked, unblock }: { toast: (m: string) => void; ask: (c: { title: string; text: string; yes: () => void; label: string }) => void; blocked: string[]; unblock: (n: string) => void }) {
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [twofa, setTwofa] = useState(false)
  const [setup, setSetup] = useState(false)
  const [code, setCode] = useState('')
  const [devices, setDevices] = useState([
    { id: 'd1', name: 'Ce navigateur', place: 'Bordeaux, France', when: 'Maintenant', current: true },
    { id: 'd2', name: 'iPhone · Safari', place: 'Bordeaux, France', when: 'Il y a 2 jours', current: false },
  ])
  const [del, setDel] = useState('')
  const [err, setErr] = useState('')

  const changePw = () => {
    setErr('')
    if (!cur) return setErr('Tapez votre mot de passe actuel.')
    if (!passwordOk(pw)) return setErr('Le nouveau mot de passe ne respecte pas toutes les règles.')
    if (pw === cur) return setErr('Choisissez un mot de passe différent de l’actuel.')
    if (pw !== pw2) return setErr('Les deux nouveaux mots de passe sont différents.')
    setCur(''); setPw(''); setPw2('')
    toast('Mot de passe changé. Les autres appareils ont été déconnectés.')
    setDevices(d => d.filter(x => x.current))
  }

  const exportData = () => {
    const data = { compte: { nom: GUEST_DEMO.name }, reservations: GUEST_DEMO.bookings, avis: GUEST_DEMO.myReviews, exporte_le: new Date().toISOString() }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'mes-donnees-shareat.json'
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Vos données ont été téléchargées')
  }

  return (
    <>
      <Head title="Sécurité" text="Protégez votre compte en quelques clics." />

      <h3 className="subtitle" style={{ marginTop: 0 }}>Double vérification</h3>
      <div className="set-row"><div><strong>Code à chaque connexion</strong><p>Même si quelqu’un connaît votre mot de passe, il ne pourra pas entrer sans le code de votre téléphone.</p></div>
        <Toggle on={twofa} onChange={v => { if (v) setSetup(true); else { setTwofa(false); toast('Double vérification désactivée') } }} label="Double vérification" /></div>
      {setup && !twofa && (
        <form className="note fade-swap" style={{ flexDirection: 'column' }} onSubmit={e => { e.preventDefault(); if (/^\d{6}$/.test(code)) { setTwofa(true); setSetup(false); setCode(''); toast('Double vérification activée') } else toast('Tapez les 6 chiffres de l’application') }}>
          <span>1. Ouvrez une application d’authentification (Google Authenticator, Microsoft Authenticator…).<br />2. Scannez le QR code qui s’affichera ici une fois le site relié.<br />3. Tapez le code à 6 chiffres affiché.</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}><input className="input input-pill" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" style={{ width: '9rem' }} /><button className="btn btn-primary btn-sm" type="submit">Activer</button></div>
        </form>
      )}

      <h3 className="subtitle">Changer de mot de passe</h3>
      <form onSubmit={e => { e.preventDefault(); changePw() }} noValidate style={{ maxWidth: 460 }}>
        <PasswordField label="Mot de passe actuel" value={cur} onChange={setCur} autoComplete="current-password" showRules={false} />
        <PasswordField label="Nouveau mot de passe" value={pw} onChange={setPw} autoComplete="new-password" />
        <PasswordField label="Retapez le nouveau" value={pw2} onChange={setPw2} autoComplete="new-password" showRules={false} />
        {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
        <button className="btn btn-primary" type="submit">Changer le mot de passe</button>
      </form>

      <h3 className="subtitle">Appareils connectés</h3>
      {devices.map(d => (
        <div key={d.id} className="set-row"><div><strong>{d.name}{d.current && <span className="tag" style={{ marginLeft: 8 }}>Celui-ci</span>}</strong><p>{d.place} · {d.when}</p></div>
          {!d.current && <button className="btn btn-ghost btn-sm" onClick={() => { setDevices(x => x.filter(y => y.id !== d.id)); toast('Appareil déconnecté') }}>Déconnecter</button>}</div>
      ))}
      {devices.length > 1 && <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.8rem' }} onClick={() => { setDevices(x => x.filter(y => y.current)); toast('Tous les autres appareils ont été déconnectés') }}>Déconnecter tous les autres appareils</button>}

      <h3 className="subtitle">Personnes bloquées</h3>
      <p className="muted small" style={{ marginTop: '-0.4rem' }}>Bloquez un hôte depuis une conversation ou une réservation, sans avoir à vous justifier.</p>
      <BlockedList blocked={blocked} onUnblock={unblock} />

      <h3 className="subtitle">Mes données</h3>
      <div className="set-row"><div><strong>Télécharger mes données</strong><p>Un fichier avec tout ce que Shareat sait de vous (RGPD).</p></div><button className="btn btn-ghost btn-sm" onClick={exportData}>Télécharger</button></div>
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div><strong style={{ color: 'var(--danger)' }}>Supprimer mon compte</strong><p>Définitif. Vos réservations à venir seront annulées et remboursées selon les règles. Tapez SUPPRIMER pour confirmer.</p></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input input-pill" value={del} onChange={e => setDel(e.target.value)} placeholder="SUPPRIMER" style={{ width: '9rem' }} aria-label="Confirmation de suppression" />
          <button className="btn btn-danger btn-sm" disabled={del !== 'SUPPRIMER'} onClick={() => ask({ title: 'Supprimer définitivement ?', label: 'Supprimer mon compte', text: 'Votre compte, vos messages et vos avis seront effacés. Les factures sont gardées le temps exigé par la loi. Cette action ne peut pas être annulée.', yes: () => { setDel(''); toast('Aperçu : en vrai, le compte serait maintenant supprimé.') } })}>Supprimer</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════ Demandes d'aide ═══════════════════

function Tickets() {
  return (
    <>
      <Head title="Mes demandes d’aide" text="Suivez les messages envoyés à notre équipe." action={<Link className="btn btn-primary" href="/aide#contact"><Icon name="plus" size={18} /> Nouvelle demande</Link>} />
      <div className="row-list">
        {GUEST_DEMO.tickets.map(t => (
          <div key={t.id} className="row"><span className="ticket">{t.id}</span><div className="row-txt"><strong>{t.subject}</strong><span>Envoyée le {fmtDate(t.date)}</span></div><span className="status status-completed">{t.status}</span></div>
        ))}
      </div>
      <div className="note"><Icon name="clock" size={18} /><span>Nous répondons sous 24 h, tous les jours. Pas satisfait ? Vous pouvez demander une réclamation puis saisir gratuitement un médiateur (voir le <Link className="inline-link" href="/aide">centre d’aide</Link>).</span></div>
    </>
  )
}

// ═══════════════════ À venir (repas à réserver + modalités invité) ═══════════════════

function Upcoming({ toast }: { toast: (m: string) => void }) {
  const [fav, setFav] = useState<string[]>([])
  return (
    <>
      <Head title="À venir" text="Les prochains repas près de chez vous, et les règles pour réserver." action={<Link className="btn btn-ghost" href="/?vue=carte"><Icon name="map" size={18} /> Voir la carte</Link>} />
      <div className="meal-grid" style={{ marginBottom: '1.8rem' }}>
        {UPCOMING_DEMO.map(m => (
          <article key={m.id} className="meal-card">
            <div className="meal-photo">
              <img src={m.photo} alt="" />
              <button className={`fav-btn${fav.includes(m.id) ? ' on' : ''}`} aria-label={fav.includes(m.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => setFav(f => (f.includes(m.id) ? f.filter(x => x !== m.id) : [...f, m.id]))}><Icon name="heart" size={16} /></button>
            </div>
            <div className="meal-body">
              <h3 className="meal-title">{m.title}</h3>
              <p className="meal-host">Chez {m.host}</p>
              <div className="meal-meta"><span>{m.city}</span><span>·</span><span>{fmtDate(m.date)} à {fmtTime(m.time)}</span><span>·</span><span>{m.left} place{m.left > 1 ? 's' : ''}</span></div>
              <div className="tag-row">{m.tags.map(t => <span key={t} className="tag">{t}</span>)}{m.allergens.map(a => <span key={a} className="tag tag-warn">{a}</span>)}</div>
              <div className="meal-foot"><span className="meal-cuisine">par personne</span><span className="meal-price">{eur(displayPrice(m.price))}</span></div>
              <button className="btn btn-primary btn-block btn-sm" style={{ marginTop: '0.9rem' }} onClick={() => toast('Aperçu : le paiement sera possible une fois le site relié à Stripe.')}>Réserver</button>
            </div>
          </article>
        ))}
      </div>
      <h3 className="subtitle">Les modalités pour vous, invité</h3>
      <ul className="checklist">
        {[
          ['card', 'Paiement en ligne', 'Vous payez votre place sur le site, par carte, de façon sécurisée (Stripe). Jamais en liquide chez l’hôte.'],
          ['map', 'L’adresse', 'Elle vous est envoyée juste après le paiement. Avant, seul le quartier est visible.'],
          ['calendar', 'Annulation', `Gratuite et remboursée en entier jusqu’à ${FREE_CANCELLATION_HOURS} h avant le repas. Après, la place n’est plus remboursable. Si l’hôte annule, vous êtes toujours remboursé.`],
          ['leaf', 'Allergies', 'Les allergènes sont indiqués en jaune. Écrivez à l’hôte avant de réserver si vous avez un doute.'],
          ['euro', 'Le prix', `Le prix affiché est le prix final, commission Shareat comprise. Repas étudiant : ${STUDENT_MAX_PRICE} € maximum.`],
          ['user', '18 ans et plus', 'Les réservations sont réservées aux adultes. Les enfants peuvent venir avec vous si le repas indique « Enfants bienvenus ».'],
        ].map(([ic, t, d]) => (
          <li key={t}><span className="tick" style={{ background: 'rgba(167,199,231,0.14)', borderColor: 'var(--line-strong)', color: 'var(--sky)' }}><Icon name={ic} size={14} /></span><div><strong>{t}</strong><small>{d}</small></div></li>
        ))}
      </ul>
    </>
  )
}
