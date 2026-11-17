'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../site/Icons'
import { PUBLISHER } from '@/lib/legal'
import { supabase } from '@/lib/supabase'
import { loadConversation, loadThreads, markRead, sendMessage, type ChatMessage, type Thread } from '@/lib/space'

// ─────────────── Petits utilitaires ───────────────

export const eur = (n: number) => {
  const v = Math.round(n * 100) / 100
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + ' €'
}

export const fmtDate = (iso: string, long = false) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' })
}
export const fmtTime = (t: string) => t.replace(':', ' h ')

const tones = ['#A7C7E7', '#8FB3DA', '#C3D7EE', '#7FA3CC', '#B5C9E6', '#9BB8DD']
export const Avatar = ({ name, size = 40, src }: { name: string; size?: number; src?: string | null }) => src
  ? <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  : <span className="avatar" style={{ width: size, height: size, background: tones[name.charCodeAt(0) % tones.length], fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase()}</span>

export const Stars = ({ n }: { n: number }) => <span className="stars" aria-label={`${n} sur 5`}>{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>

export function StarPicker({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="mini-stars" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sur 5`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  )
}

export function Ring({ value, label }: { value: number; label: string }) {
  const r = 63
  const c = 2 * Math.PI * r
  return (
    <div className="score-ring">
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <circle className="ring-bg" cx="75" cy="75" r={r} />
        <circle className="ring-fg" cx="75" cy="75" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div className="ring-txt"><strong>{value}</strong><span>{label}</span></div>
    </div>
  )
}

export const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
)

/** Message bref en bas de l'écran. */
export function useToast() {
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const show = (m: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMsg(m)
    timer.current = setTimeout(() => setMsg(''), 3800)
  }
  const node = msg ? <div className="toast" role="status">{msg}</div> : null
  return [show, node] as const
}

/** Fenêtre de confirmation (toujours demander avant une action qu'on ne peut pas défaire). */
export function Confirm({ title, children, confirm, danger, onYes, onNo }: { title: string; children: ReactNode; confirm: string; danger?: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) onNo() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal-close" onClick={onNo} aria-label="Fermer">×</button>
        <h2 className="title">{title}</h2>
        <div className="muted" style={{ lineHeight: 1.7 }}>{children}</div>
        <div className="row-btns">
          <button className="btn btn-ghost" onClick={onNo}>Non, garder</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onYes}>{confirm}</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────── Mise en page des espaces ───────────────

export type Tab = { id: string; label: string; icon: string; badge?: number }

export function SpaceLayout({ who, avatar, role, tabs, tab, setTab, children, switchTo, onLogout }: {
  who: string; avatar?: string | null; role: string; tabs: Tab[]; tab: string; setTab: (t: string) => void; children: ReactNode; switchTo: { href: string; label: string }; onLogout: () => void
}) {
  return (
    <section className="section" style={{ paddingTop: '2rem' }}>
      <div className="space">
        <aside className="space-side glass" aria-label="Menu de mon espace">
          <div className="space-id">
            <Avatar name={who} src={avatar} size={46} />
            <div><strong>{who}</strong><small>{role}</small></div>
          </div>
          {tabs.map(t => (
            <button key={t.id} className={`dash-tab${tab === t.id ? ' on' : ''}`} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={19} /><span className="lbl">{t.label}</span>{t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
          <Link className="dash-tab" href={switchTo.href} style={{ textDecoration: 'none', marginTop: '0.6rem' }}><Icon name="arrow" size={19} /><span className="lbl">{switchTo.label}</span></Link>
          <button className="dash-tab danger" onClick={onLogout}><Icon name="logout" size={19} /><span className="lbl">Déconnexion</span></button>
        </aside>
        <div className="space-body glass">
          <div key={tab} className="fade-swap">{children}</div>
        </div>
      </div>
    </section>
  )
}

export const Head = ({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) => (
  <div className="space-head">
    <div><h2 className="title">{title}</h2>{text && <p>{text}</p>}</div>
    {action}
  </div>
)

// ─────────────── Messagerie (vrais messages) ───────────────

const fmtStamp = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Messenger({ uid, openWith, onReport }: { uid: string; openWith?: { id: string; name: string } | null; onReport: (name: string) => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [cur, setCur] = useState<string | null>(openWith?.id ?? null)
  const [msgs, setMsgs] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadThreads(uid).then(ts => {
      if (cancelled) return
      const list = openWith && !ts.some(t => t.id === openWith.id) ? [{ id: openWith.id, name: openWith.name, avatar: null, last: '', lastAt: '', unread: 0 }, ...ts] : ts
      setThreads(list)
      setCur(c => c ?? list[0]?.id ?? null)
    })
    return () => { cancelled = true }
  }, [uid, openWith])

  useEffect(() => {
    if (!cur) return
    let cancelled = false
    loadConversation(uid, cur).then(m => {
      if (cancelled) return
      setMsgs(m)
      if (m.some(x => x.receiver_id === uid && !x.is_read)) markRead(uid, cur)
      setThreads(ts => ts?.map(t => (t.id === cur ? { ...t, unread: 0 } : t)) ?? ts)
    })
    const channel = supabase.channel(`chat-${uid}-${cur}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new as ChatMessage
        const inConv = (m.sender_id === uid && m.receiver_id === cur) || (m.sender_id === cur && m.receiver_id === uid)
        if (!inConv) return
        setMsgs(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]))
        if (m.receiver_id === uid) markRead(uid, cur)
      })
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [uid, cur])

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs.length])

  const th = threads?.find(t => t.id === cur)
  const send = async () => {
    const v = text.trim()
    if (!v || !th || sending) return
    setSending(true); setErr('')
    try {
      const m = await sendMessage(uid, th.id, v)
      setMsgs(prev => (prev.some(p => p.id === m.id) ? prev : [...prev, m]))
      setThreads(ts => ts?.map(t => (t.id === th.id ? { ...t, last: m.content, lastAt: m.created_at } : t)) ?? ts)
      setText('')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (threads === null) return <p className="muted">Chargement des messages…</p>
  if (threads.length === 0) return <div className="empty-soft"><Icon name="chat" size={36} /><p>Aucun message pour l’instant. Vous pourrez écrire à un hôte depuis la page d’un repas.</p></div>

  return (
    <div className="messenger">
      <div className="thread-pick" role="tablist" aria-label="Conversations">
        {threads.map(t => (
          <button key={t.id} role="tab" aria-selected={cur === t.id} className={cur === t.id ? 'on' : ''} onClick={() => { if (t.id !== cur) { setMsgs([]); setCur(t.id) } }}>
            <Avatar name={t.name} src={t.avatar} size={40} />
            <span className="t"><strong>{t.name}</strong><small>{t.last ? t.last.slice(0, 60) : 'Nouvelle conversation'}</small></span>
            {t.unread > 0 && <span className="badge">{t.unread}</span>}
          </button>
        ))}
      </div>
      {th && (
        <div className="chatbox">
          <div className="chat-head">
            <Avatar name={th.name} src={th.avatar} size={44} />
            <div style={{ flex: 1, minWidth: '10rem' }}><strong style={{ fontSize: '1.05rem' }}>{th.name}</strong></div>
            <button className="btn btn-ghost btn-sm" onClick={() => onReport(th.name)}><Icon name="flag" size={16} /> Signaler</button>
          </div>
          <div ref={box} className="bubbles">
            {msgs.length === 0 && <span className="chat-day">Écrivez le premier message</span>}
            {msgs.map(m => {
              const me = m.sender_id === uid
              return (
                <div key={m.id} className={`bubble${me ? ' me' : ''}`}>
                  {m.content}
                  <small>{me ? 'Vous' : th.name} · {fmtStamp(m.created_at)}</small>
                </div>
              )
            })}
          </div>
          <form className="chat-input" onSubmit={e => { e.preventDefault(); send() }}>
            <input className="input input-pill" value={text} onChange={e => setText(e.target.value)} placeholder="Écrivez votre message…" maxLength={2000} aria-label="Message" />
            <button className="btn btn-primary" type="submit" disabled={!text.trim() || sending}>{sending ? 'Envoi…' : 'Envoyer'}</button>
          </form>
          {err && <p className="err" role="alert" style={{ margin: '0 1.1rem 0.6rem' }}>{err}</p>}
          <p className="muted small" style={{ margin: '0 1.1rem 0.9rem' }}>Pour votre sécurité, les numéros et emails sont masqués : restez sur Shareat pour discuter et payer.</p>
        </div>
      )}
    </div>
  )
}

/** Fenêtre de signalement, utilisée dans les deux espaces. */
export function ReportModal({ name, onClose, onSent }: { name: string; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const reasons = ['Comportement irrespectueux', 'Demande de payer en dehors du site', 'Faux profil ou arnaque', 'Problème d’hygiène ou de sécurité', 'Autre']
  // Le signalement part par email à l'équipe (la messagerie de l'appareil s'ouvre, déjà remplie).
  const submit = () => {
    const body = `Personne signalée : ${name}\nRaison : ${reason}\n\n${details.trim()}`
    window.location.href = `mailto:${PUBLISHER.email}?subject=${encodeURIComponent(`Signalement : ${name}`)}&body=${encodeURIComponent(body)}`
    onSent()
  }
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Signaler" onSubmit={e => { e.preventDefault(); if (reason) submit() }}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <h2 className="title">Signaler {name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>Votre signalement est confidentiel : la personne ne saura pas que c’est vous. Votre messagerie s’ouvre avec le message prêt à envoyer à l’équipe.</p>
        <div className="chips chips-wrap" role="radiogroup" aria-label="Raison" style={{ marginBottom: '1rem' }}>
          {reasons.map(r => <button type="button" key={r} role="radio" aria-checked={reason === r} className={`chip${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <textarea className="input" rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Racontez ce qui s’est passé (facultatif)" maxLength={1500} aria-label="Détails" />
        <button className="btn btn-danger btn-block" type="submit" disabled={!reason} style={{ marginTop: '1rem' }}>Préparer le signalement</button>
        <p className="muted small" style={{ marginTop: '0.8rem' }}>En cas de danger, appelez le 112.</p>
      </form>
    </div>
  )
}

/** Affiché tant que l'utilisateur n'est pas chargé, ou si la base n'est pas reliée (développement). */
export function SpaceGate({ state }: { state: 'loading' | 'in' | 'unconfigured' }) {
  return (
    <section className="section" style={{ paddingTop: '2rem' }}>
      <div className="space-body glass" style={{ maxWidth: 640, margin: '0 auto' }}>
        {state === 'unconfigured'
          ? <div className="note warn"><Icon name="eye" size={18} /><span>La base de données n’est pas reliée (variables Supabase manquantes) : l’espace ne peut pas s’afficher.</span></div>
          : <p className="muted" style={{ margin: 0 }}>Chargement de votre espace…</p>}
      </div>
    </section>
  )
}
