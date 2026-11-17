'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/site/Icons'
import PasswordField from '../components/site/PasswordField'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { createThrottle, emailOk, passwordOk } from '@/lib/security'

type Mode = 'login' | 'forgot' | 'sent' | 'reset'

/** Page où revenir après connexion (chemin interne uniquement). */
function nextPath() {
  const s = new URLSearchParams(window.location.search).get('suite') || ''
  return /^\/(?!\/)[\w\-/?=&%.]*$/.test(s) ? s : '/mon-compte'
}

export default function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lockLeft, setLockLeft] = useState(0)
  const throttle = useRef(createThrottle(5, 30_000))

  // Lien « mot de passe oublié » : Supabase ouvre une session de récupération, on demande le nouveau mot de passe.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setError(''); setMode('reset') }
    })
    return () => subscription.unsubscribe()
  }, [])

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
    if (!supabaseConfigured) { setError('La base de données n’est pas reliée : connexion impossible.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
    const ok = !e
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
    router.push(nextPath())
  }

  const reset = async () => {
    setError('')
    if (!passwordOk(pw)) { setError('Le mot de passe ne respecte pas toutes les règles.'); return }
    if (pw !== pw2) { setError('Les deux mots de passe sont différents.'); return }
    setBusy(true)
    const { error: e } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (e) { setError('Changement impossible : ' + e.message + '. Redemandez un lien.'); return }
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
            <label className="field"><span className="field-label">Email</span>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" /></label>
            <PasswordField label="Mot de passe" value={pw} onChange={setPw} autoComplete="current-password" showRules={false} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '-0.3rem' }}>
              <button type="button" className="link" onClick={() => { setError(''); setMode('forgot') }}>Mot de passe oublié ?</button>
            </div>
            {lockLeft > 0 && <p className="err" role="alert"><Icon name="clock" size={16} /> Trop d’essais. Pour votre sécurité, attendez {lockLeft} secondes.</p>}
            {error && lockLeft <= 0 && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" style={{ marginTop: '1rem' }} disabled={busy || lockLeft > 0}>{busy ? 'Connexion…' : 'Se connecter'}</button>
            <div className="divider">ou</div>
            <Link className="btn btn-ghost btn-block" href="/inscription">Créer un compte</Link>
            <p className="muted small" style={{ marginTop: '1.2rem', lineHeight: 1.6 }}>Sur un ordinateur partagé, pensez à vous déconnecter depuis votre espace en partant.</p>
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

        {mode === 'reset' && (
          <form onSubmit={e => { e.preventDefault(); reset() }} noValidate>
            <p className="eyebrow">Dernière étape</p>
            <h1 className="title">Nouveau mot de passe</h1>
            <PasswordField label="Nouveau mot de passe" value={pw} onChange={setPw} autoComplete="new-password" />
            <PasswordField label="Retapez-le" value={pw2} onChange={setPw2} autoComplete="new-password" showRules={false} />
            {error && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer et me connecter'}</button>
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
