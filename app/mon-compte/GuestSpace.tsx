'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Icon from '../components/site/Icons'
import PasswordField from '../components/site/PasswordField'
import { Avatar, Confirm, Head, Messenger, ReportModal, SpaceGate, SpaceLayout, StarPicker, Stars, eur, fmtDate, fmtTime, useToast } from '../components/space/Kit'
import { COMMISSION_RATE, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, displayPrice, parisDateTime } from '@/lib/shared'
import { passwordOk } from '@/lib/security'
import { PUBLISHER } from '@/lib/legal'
import { supabase } from '@/lib/supabase'
import {
  api, loadGuest, loadUpcoming, logout, saveProfile, toggleFavorite, uploadPhoto, useMe,
  type GuestBooking, type Me, type MyReview, type PublicMeal,
} from '@/lib/space'

const TAB_IDS = ['accueil', 'avenir', 'reservations', 'avis', 'favoris', 'messages', 'profil', 'securite'] as const
type TabId = typeof TAB_IDS[number]
type Ask = { title: string; text: string; yes: () => void; label: string }

const hoursUntil = (b: GuestBooking) => (parisDateTime(b.date, b.time).getTime() - Date.now()) / 3_600_000

/** Fichier calendrier (.ics) pour ajouter le repas à son agenda. */
function downloadIcs(b: GuestBooking) {
  const start = parisDateTime(b.date, b.time)
  const end = new Date(start.getTime() + 3 * 3_600_000)
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const clean = (s: string) => s.replace(/[\r\n,;]/g, ' ')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shareat//FR', 'BEGIN:VEVENT', `UID:${b.id}@shareat`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${clean(`${b.title} chez ${b.host}`)}`, `LOCATION:${clean(b.address || b.city)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `shareat-${b.ref}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function GuestSpace() {
  const { state, me, reloadMe } = useMe('/mon-compte')
  if (state !== 'in' || !me) return <SpaceGate state={state} />
  return <GuestSpaceIn me={me} reloadMe={reloadMe} />
}

function GuestSpaceIn({ me, reloadMe }: { me: Me; reloadMe: () => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get('onglet') as TabId | null
  const [tab, setTab] = useState<TabId>(initial && TAB_IDS.includes(initial) ? initial : 'accueil')
  const [toast, toastNode] = useToast()
  const [loaded, setLoaded] = useState(false)
  const [bookings, setBookings] = useState<GuestBooking[]>([])
  const [favs, setFavs] = useState<PublicMeal[]>([])
  const [myReviews, setMyReviews] = useState<MyReview[]>([])
  const [aboutMe, setAboutMe] = useState<MyReview[]>([])
  const [version, setVersion] = useState(0)
  const [confirm, setConfirm] = useState<Ask | null>(null)
  const [report, setReport] = useState<string | null>(null)
  const [chatWith, setChatWith] = useState<{ id: string; name: string } | null>(null)
  const reload = () => setVersion(v => v + 1)

  useEffect(() => {
    let cancelled = false
    loadGuest(me.id).then(d => {
      if (cancelled) return
      setBookings(d.bookings); setFavs(d.favorites); setMyReviews(d.myReviews); setAboutMe(d.aboutMe); setLoaded(true)
    })
    return () => { cancelled = true }
  }, [me.id, version])

  const toReview = bookings.filter(b => b.status === 'past' && !b.reviewed)

  const tabs = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'avenir', label: 'À venir', icon: 'sparkle' },
    { id: 'reservations', label: 'Mes réservations', icon: 'calendar' },
    { id: 'avis', label: 'Mes avis', icon: 'star', badge: toReview.length },
    { id: 'favoris', label: 'Favoris', icon: 'heart' },
    { id: 'messages', label: 'Messages', icon: 'chat' },
    { id: 'profil', label: 'Mon profil', icon: 'user' },
    { id: 'securite', label: 'Sécurité et données', icon: 'lock' },
  ]

  const cancel = (b: GuestBooking) => {
    const free = hoursUntil(b) >= FREE_CANCELLATION_HOURS
    setConfirm({
      title: 'Annuler cette réservation ?',
      label: 'Oui, annuler',
      text: free
        ? `Vous serez remboursé de ${eur(b.total)} en entier, sous 5 à 10 jours, sur la carte utilisée.`
        : `Le repas est dans moins de ${FREE_CANCELLATION_HOURS} h : la place n’est plus remboursable (l’hôte a déjà fait ses courses). Vous pouvez quand même libérer la place.`,
      yes: async () => {
        try {
          const r = await api<{ refunded: number }>('/api/bookings/cancel', { booking_id: b.id })
          toast(r.refunded > 0 ? `Réservation annulée : ${eur(r.refunded)} remboursés sous 5 à 10 jours` : 'Réservation annulée')
          reload()
        } catch (e) { toast((e as Error).message) }
      },
    })
  }

  return (
    <>
      <SpaceLayout who={me.name} avatar={me.avatar} role="Espace invité" tabs={tabs} tab={tab} setTab={t => setTab(t as TabId)} switchTo={{ href: '/espace-hote', label: 'Passer en mode hôte' }}
        onLogout={async () => { await logout(); router.push('/') }}>
        {!loaded ? <p className="muted">Chargement…</p> : <>
          {tab === 'accueil' && <Home me={me} bookings={bookings} toReview={toReview.length} go={setTab} />}
          {tab === 'avenir' && <Upcoming me={me} favIds={new Set(favs.map(f => f.id))} toast={toast} onFav={reload} />}
          {tab === 'reservations' && <Bookings bookings={bookings} cancel={cancel} go={setTab} report={setReport} write={b => { setChatWith({ id: b.hostId, name: b.host }); setTab('messages') }} />}
          {tab === 'avis' && <Reviews me={me} toReview={toReview} myReviews={myReviews} aboutMe={aboutMe} onSent={() => { toast('Merci pour votre avis !'); reload() }} />}
          {tab === 'favoris' && <Favorites favs={favs} remove={async id => { const e = await toggleFavorite(me.id, id, false); if (e) toast(e); else { setFavs(f => f.filter(x => x.id !== id)); toast('Retiré des favoris') } }} />}
          {tab === 'messages' && (<><Head title="Messages" text="Discutez avec vos hôtes avant et après le repas." /><Messenger uid={me.id} openWith={chatWith} onReport={setReport} /></>)}
          {tab === 'profil' && <Profile me={me} toast={toast} onSaved={reloadMe} />}
          {tab === 'securite' && <Security me={me} bookings={bookings} myReviews={myReviews} toast={toast} />}
        </>}
      </SpaceLayout>
      {confirm && <Confirm title={confirm.title} confirm={confirm.label} danger onNo={() => setConfirm(null)} onYes={() => { confirm.yes(); setConfirm(null) }}>{confirm.text}</Confirm>}
      {report && <ReportModal name={report} onClose={() => setReport(null)} onSent={() => setReport(null)} />}
      {toastNode}
    </>
  )
}

// ═══════════════════ Accueil ═══════════════════

function Home({ me, bookings, toReview, go }: { me: Me; bookings: GuestBooking[]; toReview: number; go: (t: TabId) => void }) {
  const next = bookings.filter(b => b.status === 'confirmed').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
  const days = next ? Math.max(0, Math.ceil(hoursUntil(next) / 24)) : 0
  return (
    <>
      <Head title={`Bonjour ${me.name.split(' ')[0]}`} text="Content de vous revoir." action={<Link className="btn btn-primary" href="/?vue=explorer"><Icon name="search" size={18} /> Trouver un repas</Link>} />
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
      ) : <div className="empty-soft"><p>Aucun repas prévu. Et si vous en trouviez un ?</p></div>}
      <div className="cards">
        {[
          { t: 'Avis à donner', v: toReview, tab: 'avis' as TabId, icon: 'star', d: 'Aidez les autres en racontant votre soirée.' },
          { t: 'Messages', v: null, tab: 'messages' as TabId, icon: 'chat', d: 'Vos échanges avec les hôtes.' },
          { t: 'Prochains repas', v: null, tab: 'avenir' as TabId, icon: 'sparkle', d: 'Les tables ouvertes en ce moment.' },
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

function Bookings({ bookings, cancel, go, report, write }: { bookings: GuestBooking[]; cancel: (b: GuestBooking) => void; go: (t: TabId) => void; report: (n: string) => void; write: (b: GuestBooking) => void }) {
  const [view, setView] = useState<'avenir' | 'passees'>('avenir')
  const [receipt, setReceipt] = useState<GuestBooking | null>(null)
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
                  {b.status === 'confirmed' && <span style={{ color: 'var(--text)' }}><Icon name="map" size={14} /> {b.address ?? b.city}</span>}
                  {b.status === 'confirmed' && <span style={{ color: free ? 'var(--ok)' : 'var(--warn)' }}>{free ? 'Annulation gratuite encore possible' : `Moins de ${FREE_CANCELLATION_HOURS} h : non remboursable`}</span>}
                  {b.status === 'cancelled' && <span>Annulée{b.refunded ? ` · ${eur(b.refunded)} remboursés` : ''}</span>}
                  <span className="row-actions" style={{ marginTop: '0.3rem' }}>
                    {b.status === 'confirmed' && <><button className="link" onClick={() => downloadIcs(b)}>Ajouter à mon agenda</button><button className="link" onClick={() => write(b)}>Écrire à l’hôte</button><button className="link danger-link" onClick={() => cancel(b)}>Annuler</button></>}
                    {b.status === 'past' && !b.reviewed && <button className="link" onClick={() => go('avis')}>Donner mon avis</button>}
                    {b.status !== 'confirmed' && <button className="link" onClick={() => write(b)}>Écrire à l’hôte</button>}
                    <button className="link" onClick={() => setReceipt(b)}>Reçu</button>
                    <button className="link" onClick={() => report(b.host)}>Signaler un problème</button>
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
            <p className="muted small" style={{ marginTop: 0 }}>Chez {receipt.host} · {fmtDate(receipt.date, true)} à {fmtTime(receipt.time)}</p>
            <div className="book-line"><span>{receipt.seats} place{receipt.seats > 1 ? 's' : ''}</span><span>{eur(receipt.total)}</span></div>
            <div className="book-line"><span>dont part de l’hôte</span><span>{eur(receipt.total / (1 + COMMISSION_RATE))}</span></div>
            <div className="book-line"><span>dont commission Shareat</span><span>{eur(receipt.total - receipt.total / (1 + COMMISSION_RATE))}</span></div>
            <div className="book-line book-total"><span>Payé par carte</span><span>{eur(receipt.total)}</span></div>
            {receipt.refunded > 0 && <div className="book-line"><span>Remboursé</span><span>{eur(receipt.refunded)}</span></div>}
            <button className="btn btn-ghost btn-block" style={{ marginTop: '1rem' }} onClick={() => window.print()}>Imprimer</button>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════ Avis ═══════════════════

const HOST_CRIT = ['Cuisine', 'Accueil', 'Propreté', 'Rapport qualité-prix']

function Reviews({ me, toReview, myReviews, aboutMe, onSent }: { me: Me; toReview: GuestBooking[]; myReviews: MyReview[]; aboutMe: MyReview[]; onSent: () => void }) {
  const [view, setView] = useState<'donner' | 'donnes' | 'recus'>(toReview.length ? 'donner' : 'donnes')
  const [open, setOpen] = useState<string | null>(toReview[0]?.id ?? null)
  const [crit, setCrit] = useState<Record<string, number>>({})
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async (b: GuestBooking) => {
    setErr('')
    if (HOST_CRIT.some(c => !crit[c])) return setErr('Mettez des étoiles pour chaque point.')
    if (text.trim().length < 20) return setErr('Écrivez au moins une phrase (20 caractères) pour aider les autres.')
    setBusy(true)
    const rating = Math.round(HOST_CRIT.reduce((s, c) => s + crit[c], 0) / HOST_CRIT.length)
    const { error } = await supabase.from('reviews').insert({ booking_id: b.id, reviewer_id: me.id, reviewed_id: b.hostId, meal_id: b.mealId, rating, comment: text.trim().slice(0, 1000), type: 'guest_to_host' })
    setBusy(false)
    if (error) return setErr(error.code === '23505' ? 'Vous avez déjà laissé un avis pour ce repas.' : 'Avis impossible : ' + error.message)
    setCrit({}); setText(''); setOpen(null); setView('donnes')
    onSent()
  }

  return (
    <>
      <Head title="Mes avis" text="Seules les personnes qui ont vraiment participé au repas peuvent laisser un avis." />
      <div className="pill-tabs glass">
        <button className={view === 'donner' ? 'on' : ''} onClick={() => setView('donner')}>À donner {toReview.length > 0 && `(${toReview.length})`}</button>
        <button className={view === 'donnes' ? 'on' : ''} onClick={() => setView('donnes')}>Mes avis sur les hôtes</button>
        <button className={view === 'recus' ? 'on' : ''} onClick={() => setView('recus')}>Avis des hôtes sur moi</button>
      </div>

      {view === 'donner' && (toReview.length === 0 ? <div className="empty-soft"><Icon name="check" size={36} /><p>Aucun avis à donner. Vous pourrez noter chaque repas une fois passé.</p></div> : toReview.map(b => (
        <div key={b.id} className="review-card" style={{ marginBottom: '0.8rem' }}>
          <header><img src={b.photo} alt="" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover' }} /><div><strong>{b.title}</strong><p className="muted small" style={{ margin: 0 }}>Chez {b.host} · {fmtDate(b.date)}</p></div>
            {open !== b.id && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setOpen(b.id); setCrit({}); setText(''); setErr('') }}>Donner mon avis</button>}</header>
          {open === b.id && (
            <form className="fade-swap" onSubmit={e => { e.preventDefault(); send(b) }}>
              <div className="criteria">{HOST_CRIT.map(c => <div key={c} className="crit"><span>{c}</span><StarPicker label={c} value={crit[c] || 0} onChange={n => setCrit(p => ({ ...p, [c]: n }))} /></div>)}</div>
              <textarea className="input" rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Racontez votre soirée : le repas, l’ambiance, l’accueil…" maxLength={1000} />
              <span className="field-hint">{text.length} / 1000 · Restez poli : les avis injurieux sont retirés.</span>
              {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
              <div className="row-btns" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-ghost" onClick={() => setOpen(null)}>Plus tard</button><button className="btn btn-primary" type="submit" disabled={busy}>Publier mon avis</button></div>
            </form>
          )}
        </div>
      )))}

      {view === 'donnes' && (myReviews.length === 0 ? <p className="muted">Vous n’avez pas encore donné d’avis.</p> : <div className="row-list">{myReviews.map(r => (
        <div key={r.id} className="review-card">
          <header><strong>{r.meal}</strong><Stars n={r.rating} /><span className="muted small">{fmtDate(r.date)}</span></header>
          {r.text && <p>{r.text}</p>}
        </div>
      ))}</div>)}

      {view === 'recus' && <div className="row-list">{aboutMe.length === 0 && <p className="muted">Aucun avis d’hôte pour l’instant.</p>}{aboutMe.map(r => (
        <div key={r.id} className="review-card">
          <header><Avatar name={r.author ?? 'Hôte'} size={36} /><strong>{r.author}</strong><Stars n={r.rating} /><span className="muted small">{r.meal}</span></header>
          {r.text && <p>{r.text}</p>}
        </div>
      ))}<p className="muted small">Les hôtes notent la ponctualité, le respect du lieu et la communication.</p></div>}
    </>
  )
}

// ═══════════════════ Favoris ═══════════════════

function Favorites({ favs, remove }: { favs: PublicMeal[]; remove: (id: string) => void }) {
  return (
    <>
      <Head title="Favoris" text="Les repas que vous avez gardés de côté (cœur)." />
      {favs.length === 0 ? <div className="empty-soft"><Icon name="heart" size={36} /><p>Pas encore de favori. Touchez le cœur sur un repas pour le garder ici.</p></div> : (
        <div className="meal-grid">{favs.map(f => (
          <article key={f.id} className="meal-card">
            <div className="meal-photo"><Link href={`/?repas=${f.id}`}><img src={f.photo} alt={f.title} /></Link><button className="fav-btn on" aria-label="Retirer des favoris" onClick={() => remove(f.id)}><Icon name="heart" size={16} /></button></div>
            <div className="meal-body"><h3 className="meal-title"><Link href={`/?repas=${f.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{f.title}</Link></h3><p className="meal-host">Chez {f.host}</p><div className="meal-meta"><span>{f.city}</span><span>·</span><span>{fmtDate(f.date)}</span></div><div className="meal-foot"><span className="meal-cuisine">par personne</span><span className="meal-price">{eur(displayPrice(f.price))}</span></div></div>
          </article>
        ))}</div>
      )}
    </>
  )
}

// ═══════════════════ Profil ═══════════════════

function Profile({ me, toast, onSaved }: { me: Me; toast: (m: string) => void; onSaved: () => void }) {
  const [name, setName] = useState(me.name === 'Mon compte' ? '' : me.name)
  const [city, setCity] = useState(me.city)
  const [bio, setBio] = useState(me.bio)
  const [avatar, setAvatar] = useState(me.avatar)
  const [busy, setBusy] = useState('')

  const changePhoto = async (file: File | undefined) => {
    if (!file) return
    setBusy('photo')
    try {
      const ph = await uploadPhoto(me.id, file, 'profil')
      const e = await saveProfile(me.id, { avatar_url: ph.src })
      if (e) throw new Error(e)
      setAvatar(ph.src); toast('Photo mise à jour'); onSaved()
    } catch (e) { toast((e as Error).message) }
    setBusy('')
  }

  const save = async () => {
    if (!name.trim()) { toast('Indiquez au moins votre prénom'); return }
    setBusy('save')
    const e = await saveProfile(me.id, { full_name: name.trim().slice(0, 80), city: city.trim().slice(0, 80), bio: bio.trim().slice(0, 600) })
    setBusy('')
    if (e) toast('Enregistrement impossible : ' + e)
    else { toast('Profil enregistré'); onSaved() }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); save() }}>
      <Head title="Mon profil" text="Ce que les hôtes voient de vous quand vous réservez." />
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.2rem' }}>
        <Avatar name={name || me.name} src={avatar} size={72} />
        <label className="btn btn-ghost btn-sm">{busy === 'photo' ? 'Envoi…' : 'Changer la photo'}<input type="file" accept="image/*" hidden onChange={e => { changePhoto(e.target.files?.[0]); e.target.value = '' }} /></label>
      </div>
      <label className="field"><span className="field-label">Prénom et nom</span><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
      <label className="field"><span className="field-label">Ville</span><input className="input" value={city} onChange={e => setCity(e.target.value)} maxLength={80} autoComplete="address-level2" /></label>
      <label className="field"><span className="field-label">Quelques mots sur vous</span><textarea className="input" rows={3} value={bio} onChange={e => setBio(e.target.value)} maxLength={600} placeholder="Ce que vous aimez manger, d’où vous venez…" /></label>
      <p className="muted small">Une allergie ? Écrivez à l’hôte avant de réserver : il pourra vous dire si le repas vous convient.</p>
      <button className="btn btn-primary" type="submit" disabled={busy === 'save'}>{busy === 'save' ? 'Enregistrement…' : 'Enregistrer'}</button>
    </form>
  )
}

// ═══════════════════ Sécurité et données ═══════════════════

function Security({ me, bookings, myReviews, toast }: { me: Me; bookings: GuestBooking[]; myReviews: MyReview[]; toast: (m: string) => void }) {
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const changePw = async () => {
    setErr('')
    if (!cur) return setErr('Tapez votre mot de passe actuel.')
    if (!passwordOk(pw)) return setErr('Le nouveau mot de passe ne respecte pas toutes les règles.')
    if (pw === cur) return setErr('Choisissez un mot de passe différent de l’actuel.')
    if (pw !== pw2) return setErr('Les deux nouveaux mots de passe sont différents.')
    setBusy(true)
    const { error: bad } = await supabase.auth.signInWithPassword({ email: me.email, password: cur })
    if (bad) { setBusy(false); return setErr('Mot de passe actuel incorrect.') }
    const { error } = await supabase.auth.updateUser({ password: pw })
    if (!error) await supabase.auth.signOut({ scope: 'others' })
    setBusy(false)
    if (error) return setErr('Changement impossible : ' + error.message)
    setCur(''); setPw(''); setPw2('')
    toast('Mot de passe changé. Les autres appareils ont été déconnectés.')
  }

  const signOutOthers = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    toast(error ? 'Impossible : ' + error.message : 'Tous les autres appareils ont été déconnectés')
  }

  const exportData = () => {
    const data = {
      compte: { nom: me.name, email: me.email, ville: me.city, presentation: me.bio },
      reservations: bookings.map(b => ({ repas: b.title, hote: b.host, date: b.date, heure: b.time, places: b.seats, total: b.total, rembourse: b.refunded, statut: b.status })),
      avis: myReviews.map(r => ({ repas: r.meal, note: r.rating, date: r.date, texte: r.text })),
      exporte_le: new Date().toISOString(),
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'mes-donnees-shareat.json'
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Vos données ont été téléchargées')
  }

  const deleteMail = `mailto:${PUBLISHER.email}?subject=${encodeURIComponent('Suppression de mon compte Shareat')}&body=${encodeURIComponent(`Bonjour,\n\nJe demande la suppression de mon compte Shareat (${me.email}).\n\nMerci.`)}`

  return (
    <>
      <Head title="Sécurité et données" text="Protégez votre compte et gardez la main sur vos données." />

      <h3 className="subtitle" style={{ marginTop: 0 }}>Changer de mot de passe</h3>
      <form onSubmit={e => { e.preventDefault(); changePw() }} noValidate style={{ maxWidth: 460 }}>
        <PasswordField label="Mot de passe actuel" value={cur} onChange={setCur} autoComplete="current-password" showRules={false} />
        <PasswordField label="Nouveau mot de passe" value={pw} onChange={setPw} autoComplete="new-password" />
        <PasswordField label="Retapez le nouveau" value={pw2} onChange={setPw2} autoComplete="new-password" showRules={false} />
        {err && <p className="err" role="alert"><Icon name="x" size={16} /> {err}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Changement…' : 'Changer le mot de passe'}</button>
      </form>

      <h3 className="subtitle">Appareils connectés</h3>
      <div className="set-row"><div><strong>Déconnecter les autres appareils</strong><p>Un téléphone perdu, un ordinateur partagé ? Toutes les sessions sauf celle-ci sont fermées.</p></div><button className="btn btn-ghost btn-sm" onClick={signOutOthers}>Déconnecter</button></div>

      <h3 className="subtitle">Mes données</h3>
      <div className="set-row"><div><strong>Télécharger mes données</strong><p>Un fichier avec votre compte, vos réservations et vos avis (RGPD).</p></div><button className="btn btn-ghost btn-sm" onClick={exportData}>Télécharger</button></div>
      <div className="set-row"><div><strong style={{ color: 'var(--danger)' }}>Supprimer mon compte</strong><p>Envoyez-nous la demande depuis l’adresse de votre compte : nous annulons vos réservations à venir selon les règles, puis supprimons le compte sous un mois. Les factures sont gardées le temps exigé par la loi.</p></div><a className="btn btn-ghost btn-sm danger-link" href={deleteMail}>Demander la suppression</a></div>
      <p className="muted small">Une question ? <Link className="inline-link" href="/aide">Centre d’aide</Link></p>
    </>
  )
}

// ═══════════════════ À venir ═══════════════════

function Upcoming({ me, favIds, toast, onFav }: { me: Me; favIds: Set<string>; toast: (m: string) => void; onFav: () => void }) {
  const [meals, setMeals] = useState<PublicMeal[] | null>(null)
  const [fav, setFav] = useState<Set<string>>(favIds)
  useEffect(() => {
    let cancelled = false
    loadUpcoming(me.id).then(m => { if (!cancelled) setMeals(m) })
    return () => { cancelled = true }
  }, [me.id])

  const toggle = async (id: string) => {
    const on = !fav.has(id)
    const e = await toggleFavorite(me.id, id, on)
    if (e) { toast(e); return }
    setFav(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })
    toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris')
    onFav()
  }

  return (
    <>
      <Head title="À venir" text="Les prochains repas ouverts, et les règles pour réserver." action={<Link className="btn btn-ghost" href="/?vue=carte"><Icon name="map" size={18} /> Voir la carte</Link>} />
      {meals === null ? <p className="muted">Chargement…</p> : meals.length === 0 ? <div className="empty-soft" style={{ marginBottom: '1.8rem' }}><Icon name="sparkle" size={36} /><p>Aucun repas ouvert pour l’instant. Revenez bientôt !</p></div> : (
        <div className="meal-grid" style={{ marginBottom: '1.8rem' }}>
          {meals.map(m => (
            <article key={m.id} className="meal-card">
              <div className="meal-photo">
                <Link href={`/?repas=${m.id}`}><img src={m.photo} alt={m.title} /></Link>
                <button className={`fav-btn${fav.has(m.id) ? ' on' : ''}`} aria-label={fav.has(m.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} onClick={() => toggle(m.id)}><Icon name="heart" size={16} /></button>
              </div>
              <div className="meal-body">
                <h3 className="meal-title">{m.title}</h3>
                <p className="meal-host">Chez {m.host}</p>
                <div className="meal-meta"><span>{m.city}</span><span>·</span><span>{fmtDate(m.date)} à {fmtTime(m.time)}</span><span>·</span><span>{m.left} place{m.left > 1 ? 's' : ''}</span></div>
                <div className="tag-row">{m.tags.map(t => <span key={t} className="tag">{t}</span>)}{m.allergens.map(a => <span key={a} className="tag tag-warn">{a}</span>)}</div>
                <div className="meal-foot"><span className="meal-cuisine">par personne</span><span className="meal-price">{eur(displayPrice(m.price))}</span></div>
                <Link className="btn btn-primary btn-block btn-sm" style={{ marginTop: '0.9rem' }} href={`/?repas=${m.id}`}>Voir et réserver</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      <h3 className="subtitle">Les modalités pour vous, invité</h3>
      <ul className="checklist">
        {[
          ['card', 'Paiement en ligne', 'Vous payez votre place sur le site, par carte, de façon sécurisée (Stripe). Jamais en liquide chez l’hôte.'],
          ['map', 'L’adresse', 'Elle vous est envoyée juste après le paiement. Avant, seule une zone d’environ 1 km est visible.'],
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
