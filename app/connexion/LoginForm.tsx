'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/site/Icons'
import PasswordField from '../components/site/PasswordField'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { createThrottle, emailOk } from '@/lib/security'

type Mode = 'login' | 'forgot' | 'sent'

export default function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lockLeft, setLockLeft] = useState(0)
  const throttle = useRef(createThrottle(5, 30_000))

  // Compte à rebours pendant le blocage après trop d'essais.
  useEffect(() => {
    if (lockLeft <= 0) return
    const t = setTimeout(() => setLockLeft(Math.ceil(throttle.current.remainingMs() / 1000)), 1000)
    return () => clearTimeout(t)
  }, [lockLeft])

  const login = async () => {
    setError('')
    const wait = throttle.current.remainingMs()
    if (wait > 0) { setLockLeft(Math.ceil(wait / 1000)); return }
    if (!emailOk(email) || !pw) { setError('Tapez votre email et votre mot de passe.'); return }
    setBusy(true)
    let ok = !supabaseConfigured // aperçu : toute connexion valide
    if (supabaseConfigured) {
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
      ok = !e
    }
    setBusy(false)
    if (!ok) {
      throttle.current.fail()
      const left = throttle.current.remainingMs()
      if (left > 0) { setLockLeft(Math.ceil(left / 1000)); return }
      // Message volontairement vague : on ne dit pas si c'est l'email ou le mot de passe qui est faux.
      setError(`Email ou mot de passe incorrect. Encore ${throttle.current.attemptsLeft()} essai(s) avant une courte pause.`)
      return
    }
    throttle.current.reset()
    router.push('/mon-compte')
  }

  const forgot = async () => {
    setError('')
    if (!emailOk(email)) { setError('Tapez l’adresse email de votre compte.'); return }
    setBusy(true)
    if (supabaseConfigured) {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/connexion` })
    }
    setBusy(false)
    setMode('sent') // même réponse que le compte existe ou non
  }

  return (
    <div className="auth-card glass">
      <div key={mode} className="fade-swap">
        {mode === 'login' && (
          <form onSubmit={e => { e.preventDefault(); login() }} noValidate>
            <p className="eyebrow">Bon retour</p>
            <h1 className="title">Connexion</h1>
            {!supabaseConfigured && <div className="note warn"><Icon name="eye" size={18} /><span>Aperçu : tapez n’importe quel email et mot de passe pour visiter l’espace.</span></div>}
            <label className="field"><span className="field-label">Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" /></label>
            <PasswordField label="Mot de passe" value={pw} onChange={setPw} autoComplete="current-password" showRules={false} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '-0.3rem' }}>
              <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><span>Rester connecté</span></label>
              <button type="button" className="link" onClick={() => { setError(''); setMode('forgot') }}>Mot de passe oublié ?</button>
            </div>
            {lockLeft > 0 && <p className="err" role="alert"><Icon name="clock" size={16} /> Trop d’essais. Pour votre sécurité, attendez {lockLeft} secondes.</p>}
            {error && lockLeft <= 0 && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }} disabled={busy || lockLeft > 0}>{busy ? 'Connexion…' : 'Se connecter'}</button>
            <div className="divider">ou</div>
            <Link className="btn btn-ghost btn-block" href="/inscription">Créer un compte</Link>
            <p className="muted small" style={{ marginTop: '1.2rem', lineHeight: 1.6 }}>Sur un ordinateur partagé, décochez « Rester connecté ». Si la double vérification est activée, un code vous sera demandé.</p>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={e => { e.preventDefault(); forgot() }} noValidate>
            <p className="eyebrow">Pas de panique</p>
            <h1 className="title">Mot de passe oublié</h1>
            <p className="muted" style={{ lineHeight: 1.7 }}>Tapez votre email. Nous vous envoyons un lien pour choisir un nouveau mot de passe. Il marche pendant 1 heure, une seule fois.</p>
            <label className="field"><span className="field-label">Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} /></label>
            {error && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir le lien'}</button>
            <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: '0.6rem' }} onClick={() => setMode('login')}><Icon name="back" size={18} /> Retour à la connexion</button>
          </form>
        )}

        {mode === 'sent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <span className="tile-icon"><Icon name="mail" size={30} /></span>
            <h1 className="title" style={{ margin: 0 }}>Regardez vos emails</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Si un compte existe avec l’adresse <strong style={{ color: 'var(--text)' }}>{email}</strong>, un lien vient d’être envoyé. Pensez aux courriers indésirables.</p>
            <button className="btn btn-ghost" onClick={() => setMode('login')}><Icon name="back" size={18} /> Retour à la connexion</button>
          </div>
        )}
      </div>
    </div>
  )
}
