'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icons'
import { COMMISSION_RATE, FREE_CANCELLATION_HOURS, TRANSFER_DELAY_HOURS, displayPrice } from '@/lib/shared'

const eur = (n: number) => {
  const v = Math.round(n * 100) / 100
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + ' €'
}

// ─────────────────────────── Accordéon (FAQ) ───────────────────────────

export type QA = { q: string; a: ReactNode; cat?: string }

export function Accordion({ items, startOpen = -1 }: { items: QA[]; startOpen?: number }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="acc">
      {items.map((it, i) => (
        <div key={it.q} className={`acc-item glass${open === i ? ' open' : ''}`}>
          <button className="acc-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            {it.q}<Icon name="plus" />
          </button>
          <div className="acc-a"><div><p>{it.a}</p></div></div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────── Parcours en étapes cliquables ───────────────────────────

export type Step = { title: string; short: string; icon: string; text: ReactNode; points?: string[] }

export function Journey({ steps, cta }: { steps: Step[]; cta?: { href: string; label: string } }) {
  const [i, setI] = useState(0)
  const s = steps[i]
  return (
    <div className="journey">
      <div className="journey-steps glass" role="tablist" aria-label="Étapes">
        {steps.map((st, k) => (
          <button key={st.title} role="tab" aria-selected={k === i} className={`journey-step${k === i ? ' on' : ''}${k < i ? ' done' : ''}`} onClick={() => setI(k)}>
            <span className="journey-num">{k < i ? <Icon name="check" size={18} /> : k + 1}</span>
            <span>{st.short}</span>
          </button>
        ))}
      </div>
      <div className="journey-panel glass" role="tabpanel">
        <div className="progress" aria-hidden="true"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>
        <div key={i} className="fade-swap" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <span className="tile-icon"><Icon name={s.icon} size={34} /></span>
          <p className="eyebrow" style={{ margin: 0 }}>Étape {i + 1} sur {steps.length}</p>
          <h3>{s.title}</h3>
          <p>{s.text}</p>
          {s.points && <ul>{s.points.map(p => <li key={p}>{p}</li>)}</ul>}
        </div>
        <div className="journey-nav">
          <button className="btn btn-ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}><Icon name="back" size={18} /> Avant</button>
          {i < steps.length - 1
            ? <button className="btn btn-primary" onClick={() => setI(i + 1)}>Étape suivante <Icon name="arrow" size={18} /></button>
            : cta && <Link className="btn btn-primary" href={cta.href}>{cta.label} <Icon name="arrow" size={18} /></Link>}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Calculateur de prix ───────────────────────────

export function PriceCalc({ mode = 'guest' }: { mode?: 'guest' | 'host' }) {
  const [price, setPrice] = useState(18)
  const [seats, setSeats] = useState(6)
  const shown = displayPrice(price)
  const fee = Math.round((shown - price) * 100) / 100
  return (
    <div className="calc glass">
      <div>
        <p className="eyebrow">{mode === 'host' ? 'Simulez vos gains' : 'Comment le prix est calculé'}</p>
        <label className="field">
          <span className="field-label">Prix fixé par l’hôte : {eur(price)}</span>
          <input type="range" min={5} max={60} step={1} value={price} onChange={e => setPrice(Number(e.target.value))} aria-label="Prix fixé par l’hôte" />
        </label>
        {mode === 'host' && (
          <label className="field">
            <span className="field-label">Nombre d’invités : {seats}</span>
            <input type="range" min={1} max={12} step={1} value={seats} onChange={e => setSeats(Number(e.target.value))} aria-label="Nombre d’invités" />
          </label>
        )}
        <p className="muted small">Déplacez le curseur : les chiffres changent tout de suite.</p>
      </div>
      <div className="calc-out">
        {mode === 'host' ? (
          <>
            <div className="calc-row calc-big"><span>Vos gains estimés</span><strong>{eur(price * seats)}</strong></div>
            <div className="calc-row"><span>Chaque invité paie</span><strong>{eur(shown)}</strong></div>
            <p className="muted small" style={{ margin: 0 }}>Commission Shareat : {Math.round(COMMISSION_RATE * 100)} % (taux provisoire, fixé définitivement avant l’ouverture). Virement {TRANSFER_DELAY_HOURS} h après le repas.</p>
          </>
        ) : (
          <>
            <div className="calc-row"><span>L’hôte reçoit</span><strong>{eur(price)}</strong></div>
            <div className="calc-row"><span>Shareat ({Math.round(COMMISSION_RATE * 100)} %)</span><strong>{eur(fee)}</strong></div>
            <div className="calc-row calc-big"><span>Vous payez</span><strong>{eur(shown)}</strong></div>
          </>
        )}
        <div className="calc-bar" aria-hidden="true">
          <i style={{ flex: price, background: 'var(--sky)' }} />
          <i style={{ flex: fee, background: 'var(--powder)', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────── Frise d'annulation ───────────────────────────

const TL = [
  { t: 'Réservation', s: 'Vous payez en ligne', d: 'Votre place est bloquée tout de suite. Vous recevez un email de confirmation et l’adresse exacte du repas.' },
  { t: `Jusqu’à ${FREE_CANCELLATION_HOURS} h avant`, s: 'Annulation gratuite', d: `Vous changez d’avis ? Annulez depuis « Mes réservations » jusqu’à ${FREE_CANCELLATION_HOURS} heures avant le repas : vous êtes remboursé en entier, sans question.` },
  { t: 'Moins de 48 h', s: 'Place maintenue', d: 'L’hôte a fait ses courses pour vous : la place n’est plus remboursable. Si l’hôte annule lui-même, vous êtes toujours remboursé en entier.' },
  { t: 'Le repas', s: 'Bon appétit', d: `Après le repas, vous pouvez laisser un avis. L’hôte reçoit son argent ${TRANSFER_DELAY_HOURS} heures plus tard.` },
]

export function CancelTimeline() {
  const [i, setI] = useState(1)
  return (
    <div className="glass">
      <div className="timeline">
        {TL.map((x, k) => (
          <button key={x.t} className={`tl-item${k === i ? ' on' : ''}`} onClick={() => setI(k)} aria-pressed={k === i}>
            <span className="tl-dot" />
            <strong>{x.t}</strong>
            <span>{x.s}</span>
          </button>
        ))}
      </div>
      <p key={i} className="tl-detail fade-swap">{TL[i].d}</p>
    </div>
  )
}

// ─────────────────────────── Compteur animé ───────────────────────────

export function Counter({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1200)
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [to, suffix])
  return <span ref={ref} className="counter">{to}{suffix}</span>
}

// ─────────────────────────── Grande tuile cliquable ───────────────────────────

export function Tile({ href, icon, title, text, go, delay = 0 }: { href: string; icon: string; title: string; text: string; go: string; delay?: number }) {
  return (
    <Link href={href} className="tile glass reveal" style={{ ['--d' as string]: `${delay}s` }}>
      <span className="tile-icon"><Icon name={icon} size={28} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      <span className="tile-go">{go} <Icon name="arrow" size={18} /></span>
    </Link>
  )
}
