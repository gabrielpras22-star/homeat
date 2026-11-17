'use client'

import { useState } from 'react'
import Icon from './Icons'
import { SCORE_COLOR, SCORE_LABEL, passwordChecks, passwordScore } from '@/lib/security'

/** Champ mot de passe avec bouton « Voir », jauge de force et règles qui se cochent en direct. */
export default function PasswordField({ label, value, onChange, autoComplete, ctx, showRules = true }: {
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete: 'new-password' | 'current-password'
  ctx?: { email?: string; name?: string }
  showRules?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const score = passwordScore(value, ctx)
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="pw-wrap">
        <input className="input" type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete} maxLength={128} aria-label={label} spellCheck={false} />
        <button type="button" className="pw-toggle" onClick={() => setVisible(v => !v)} aria-pressed={visible}>{visible ? 'Cacher' : 'Voir'}</button>
      </div>
      {showRules && (
        <>
          <div className="meter" aria-hidden="true">
            {[0, 1, 2, 3].map(i => <i key={i} style={{ background: value && i < Math.max(1, score) ? SCORE_COLOR[score] : undefined }} />)}
          </div>
          {value && <span className="field-hint" style={{ color: SCORE_COLOR[score] }}>Force : {SCORE_LABEL[score]}</span>}
          <ul className="rules">
            {passwordChecks(value, ctx).map(c => (
              <li key={c.id} className={c.ok ? 'ok' : ''}><Icon name={c.ok ? 'check' : 'x'} size={14} /> {c.label}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
