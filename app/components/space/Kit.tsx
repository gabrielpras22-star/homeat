'use client'
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from '../site/Icons'
import type { DemoThread } from '@/lib/apercu'

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

export function SpaceLayout({ who, role, tabs, tab, setTab, children, switchTo }: {
  who: string; role: string; tabs: Tab[]; tab: string; setTab: (t: string) => void; children: ReactNode; switchTo: { href: string; label: string }
}) {
  return (
    <section className="section" style={{ paddingTop: '2rem' }}>
      <div className="space">
        <aside className="space-side glass" aria-label="Menu de mon espace">
          <div className="space-id">
            <Avatar name={who} size={46} />
            <div><strong>{who}</strong><small>{role}</small></div>
          </div>
          {tabs.map(t => (
            <button key={t.id} className={`dash-tab${tab === t.id ? ' on' : ''}`} onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-current={tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} size={19} /><span className="lbl">{t.label}</span>{t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
          <Link className="dash-tab" href={switchTo.href} style={{ textDecoration: 'none', marginTop: '0.6rem' }}><Icon name="arrow" size={19} /><span className="lbl">{switchTo.label}</span></Link>
          <Link className="dash-tab danger" href="/" style={{ textDecoration: 'none' }}><Icon name="logout" size={19} /><span className="lbl">Déconnexion</span></Link>
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

// ─────────────── Messagerie ───────────────

export function Messenger({ threads, setThreads, onReport, blocked = [], onBlock, onUnblock }: {
  threads: DemoThread[]
  setThreads: (f: (t: DemoThread[]) => DemoThread[]) => void
  onReport: (name: string) => void
  blocked?: string[]
  onBlock?: (name: string) => void
  onUnblock?: (name: string) => void
}) {
  const [cur, setCur] = useState(threads[0]?.id ?? null)
  const [text, setText] = useState('')
  const [askDel, setAskDel] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const th = threads.find(t => t.id === cur)
  const isBlocked = Boolean(th && blocked.includes(th.name))

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [th?.msgs.length])

  const open = (id: string) => { setCur(id); setAskDel(null); setThreads(ts => ts.map(t => (t.id === id ? { ...t, unread: 0 } : t))) }
  const send = () => {
    const v = text.trim().slice(0, 2000)
    if (!v || !th || isBlocked) return
    // Protection : on masque les numéros de téléphone et emails pour garder les échanges et paiements sur Shareat.
    const safe = v.replace(/(\+?\d[\d .-]{7,}\d)/g, '[numéro masqué]').replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, '[email masqué]')
    setThreads(ts => ts.map(t => (t.id === th.id ? { ...t, msgs: [...t.msgs, { me: true, text: safe, at: 'à l’instant' }] } : t)))
    setText('')
  }
  const remove = (i: number) => {
    if (!th) return
    setThreads(ts => ts.map(t => (t.id === th.id ? { ...t, msgs: t.msgs.map((m, k) => (k === i ? { ...m, deleted: true, text: '' } : m)) } : t)))
    setAskDel(null)
  }

  if (threads.length === 0) return <div className="empty-soft"><Icon name="chat" size={36} /><p>Aucun message pour l’instant.</p></div>

  return (
    <div className="messenger">
      <div className="thread-pick" role="tablist" aria-label="Conversations">
        {threads.map(t => (
          <button key={t.id} role="tab" aria-selected={cur === t.id} className={cur === t.id ? 'on' : ''} onClick={() => open(t.id)}>
            <Avatar name={t.name} size={40} />
            <span className="t"><strong>{t.name}</strong><small>{blocked.includes(t.name) ? 'Bloqué' : t.about}</small></span>
            {t.unread > 0 && <span className="badge">{t.unread}</span>}
          </button>
        ))}
      </div>
      {th && (
        <div className="chatbox">
          <div className="chat-head">
            <Avatar name={th.name} size={44} />
            <div style={{ flex: 1, minWidth: '10rem' }}><strong style={{ fontSize: '1.05rem' }}>{th.name}</strong><p className="muted small" style={{ margin: 0 }}>À propos de : {th.about}</p></div>
            <button className="btn btn-ghost btn-sm" onClick={() => onReport(th.name)}><Icon name="flag" size={16} /> Signaler</button>
            {onBlock && !isBlocked && <button className="btn btn-ghost btn-sm danger-link" onClick={() => onBlock(th.name)}><Icon name="x" size={16} /> Bloquer</button>}
          </div>
          <div ref={box} className="bubbles">
            <span className="chat-day">Conversation</span>
            {th.msgs.map((m, i) => (
              <div key={i} className={`bubble fade-swap${m.me ? ' me' : ''}${m.deleted ? ' deleted' : ''}`}>
                {m.deleted
                  ? <em>{m.me ? 'Vous avez supprimé ce message' : 'Message supprimé de votre côté'}</em>
                  : askDel === i
                    ? <span className="del-ask">{m.me ? 'Supprimer pour tout le monde ?' : 'Supprimer de votre côté ?'}
                        <span><button type="button" onClick={() => remove(i)}>Oui, supprimer</button><button type="button" onClick={() => setAskDel(null)}>Non</button></span></span>
                    : <>{m.text}<button type="button" className="del-btn" aria-label="Supprimer ce message" title="Supprimer" onClick={() => setAskDel(i)}><Icon name="trash" size={14} /></button></>}
                <small>{m.me ? 'Vous' : th.name} · {m.at}</small>
              </div>
            ))}
          </div>
          {isBlocked ? (
            <div className="note warn" style={{ margin: '0.9rem 1rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>Vous avez bloqué {th.name}. Cette personne ne peut plus vous écrire.</span>
              {onUnblock && <button className="btn btn-ghost btn-sm" onClick={() => onUnblock(th.name)}>Débloquer</button>}
            </div>
          ) : (
            <form className="chat-input" onSubmit={e => { e.preventDefault(); send() }}>
              <input className="input input-pill" value={text} onChange={e => setText(e.target.value)} placeholder="Écrivez votre message…" maxLength={2000} aria-label="Message" />
              <button className="btn btn-primary" type="submit" disabled={!text.trim()}>Envoyer</button>
            </form>
          )}
          <p className="muted small" style={{ margin: '0 1.1rem 0.9rem' }}>Pour votre sécurité, les numéros et emails sont masqués : restez sur Shareat pour discuter et payer.</p>
        </div>
      )}
    </div>
  )
}

/** Fenêtre « Bloquer » : aucune justification demandée, la personne n'est pas prévenue. */
export function BlockModal({ name, who, onClose, onYes }: { name: string; who: 'host' | 'guest'; onClose: () => void; onYes: () => void }) {
  return (
    <Confirm title={`Bloquer ${name} ?`} confirm="Bloquer" danger onNo={onClose} onYes={onYes}>
      <p style={{ marginTop: 0 }}>Pas besoin de vous justifier. {name} ne sera pas prévenu(e).</p>
      <ul style={{ paddingLeft: '1.2rem', margin: '0 0 0.6rem', lineHeight: 1.8 }}>
        <li>Cette personne ne pourra plus vous écrire.</li>
        {who === 'host'
          ? <><li>Vous ne verrez plus ses repas.</li><li>Vos réservations chez elle restent valables : annulez-les si besoin.</li></>
          : <><li>Elle ne pourra plus réserver vos repas.</li><li>Si elle a une réservation à venir chez vous, elle sera annulée et remboursée.</li></>}
      </ul>
      <p style={{ margin: 0 }}>Vous pourrez la débloquer à tout moment. En cas de danger ou de comportement grave, pensez aussi à la signaler.</p>
    </Confirm>
  )
}

/** Liste des personnes bloquées, avec « Débloquer ». */
export function BlockedList({ blocked, onUnblock }: { blocked: string[]; onUnblock: (n: string) => void }) {
  if (blocked.length === 0) return <p className="muted small" style={{ margin: '0.4rem 0' }}>Vous n’avez bloqué personne.</p>
  return (
    <>
      {blocked.map(n => (
        <div key={n} className="set-row"><div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}><Avatar name={n} size={36} /><strong>{n}</strong></div>
          <button className="btn btn-ghost btn-sm" onClick={() => onUnblock(n)}>Débloquer</button></div>
      ))}
    </>
  )
}

/** Réglages de notifications (liste d'interrupteurs). */
export function NotificationSettings({ rows, toast }: { rows: { id: string; t: string; d: string; on: boolean }[]; toast: (m: string) => void }) {
  const [n, setN] = useState<Record<string, boolean>>(() => Object.fromEntries(rows.map(r => [r.id, r.on])))
  return (
    <>
      <Head title="Notifications" text="Choisissez ce que vous voulez recevoir, par email ou par SMS." />
      {rows.map(r => (
        <div key={r.id} className="set-row"><div><strong>{r.t}</strong><p>{r.d}</p></div>
          <Toggle on={n[r.id]} onChange={v => { setN(p => ({ ...p, [r.id]: v })); toast(v ? 'Notification activée' : 'Notification désactivée') }} label={r.t} /></div>
      ))}
    </>
  )
}

/** Fenêtre de signalement, utilisée dans les deux espaces. */
export function ReportModal({ name, onClose, onSent }: { name: string; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const reasons = ['Comportement irrespectueux', 'Demande de payer en dehors du site', 'Faux profil ou arnaque', 'Problème d’hygiène ou de sécurité', 'Autre']
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal" role="dialog" aria-modal="true" aria-label="Signaler" onSubmit={e => { e.preventDefault(); if (reason) onSent() }}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">×</button>
        <h2 className="title">Signaler {name}</h2>
        <p className="muted" style={{ marginTop: 0 }}>Votre signalement est confidentiel : la personne ne saura pas que c’est vous.</p>
        <div className="chips chips-wrap" role="radiogroup" aria-label="Raison" style={{ marginBottom: '1rem' }}>
          {reasons.map(r => <button type="button" key={r} role="radio" aria-checked={reason === r} className={`chip${reason === r ? ' on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
        </div>
        <textarea className="input" rows={3} value={details} onChange={e => setDetails(e.target.value)} placeholder="Racontez ce qui s’est passé (facultatif)" maxLength={1500} aria-label="Détails" />
        <button className="btn btn-danger btn-block" type="submit" disabled={!reason} style={{ marginTop: '1rem' }}>Envoyer le signalement</button>
        <p className="muted small" style={{ marginTop: '0.8rem' }}>En cas de danger, appelez le 112.</p>
      </form>
    </div>
  )
}
