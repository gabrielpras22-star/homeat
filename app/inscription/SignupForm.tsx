'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/site/Icons'
import PasswordField from '../components/site/PasswordField'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { ageFrom, cleanText, emailOk, nameOk, passwordOk } from '@/lib/security'

type Role = 'guest' | 'host' | 'both'
const STEPS = ['Qui êtes-vous ?', 'Vos informations', 'Vérification', 'Terminé']

export default function SignupForm() {
  const params = useSearchParams()
  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role>(params.get('role') === 'hote' ? 'host' : 'guest')
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const [birth, setBirth] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [terms, setTerms] = useState(false)
  const [news, setNews] = useState(false)
  const [trap, setTrap] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  const name = `${first} ${last}`.trim()
  const ctx = { email, name }

  // Compte à rebours avant de pouvoir renvoyer le code.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const next = () => { setError(''); setStep(s => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const submitInfos = async () => {
    setError('')
    if (trap) return // robot
    if (!nameOk(first) || !nameOk(last)) return setError('Écrivez votre prénom et votre nom (lettres seulement).')
    if (!emailOk(email)) return setError('Votre adresse email ne semble pas correcte.')
    const age = ageFrom(birth)
    if (age == null) return setError('Indiquez votre date de naissance.')
    if (age < 18) return setError('Désolé, Shareat est réservé aux personnes de 18 ans et plus.')
    if (age > 120) return setError('Cette date de naissance ne semble pas correcte.')
    if (!passwordOk(pw, ctx)) return setError('Votre mot de passe ne respecte pas toutes les règles (voir la liste en vert).')
    if (pw !== pw2) return setError('Les deux mots de passe ne sont pas identiques.')
    if (!terms) return setError('Acceptez les conditions et la politique de confidentialité pour continuer.')

    if (supabaseConfigured) {
      setBusy(true)
      const { error: e } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: pw,
        options: { data: { full_name: cleanText(name, 120), role, birth_date: birth, newsletter: news } },
      })
      setBusy(false)
      // Même message que l'adresse existe ou non : on ne révèle pas qui a un compte.
      if (e && !/already/i.test(e.message)) return setError('Inscription impossible pour le moment. Réessayez dans un instant.')
    }
    setCooldown(60)
    next()
  }

  const setDigit = (i: number, v: string) => {
    const digits = v.replace(/\D/g, '')
    if (digits.length > 1) { // collage d'un code complet
      const arr = digits.slice(0, 6).split('')
      setCode(c => c.map((_, k) => arr[k] ?? ''))
      codeRefs.current[Math.min(5, arr.length)]?.focus()
      return
    }
    setCode(c => c.map((d, k) => (k === i ? digits : d)))
    if (digits && i < 5) codeRefs.current[i + 1]?.focus()
  }

  const verify = async () => {
    setError('')
    const token = code.join('')
    if (token.length !== 6) return setError('Tapez les 6 chiffres reçus par email.')
    if (supabaseConfigured) {
      setBusy(true)
      const { error: e } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'signup' })
      setBusy(false)
      if (e) return setError('Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.')
    }
    next()
  }

  const resend = async () => {
    if (cooldown > 0) return
    if (supabaseConfigured) await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
    setCooldown(60)
  }

  return (
    <div className="auth-card glass">
      <p className="eyebrow">Créer un compte · étape {step + 1} sur 4</p>
      <h1 className="title">{STEPS[step]}</h1>
      <div className="auth-steps" aria-hidden="true">{STEPS.map((s, i) => <i key={s} className={i <= step ? 'on' : ''} />)}</div>

      <div key={step} className="fade-swap">
        {step === 0 && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>Choisissez ce que vous voulez faire. Vous pourrez changer plus tard.</p>
            <div className="role-pick">
              {([['guest', 'user', 'Je veux manger', 'Je réserve des repas chez des hôtes.'], ['host', 'plate', 'Je veux cuisiner', 'Je reçois des invités chez moi.']] as const).map(([id, icon, t, d]) => (
                <button key={id} type="button" className={`role-opt${role === id ? ' on' : ''}`} onClick={() => setRole(id)} aria-pressed={role === id}>
                  <Icon name={icon} size={28} /><strong>{t}</strong><span>{d}</span>
                </button>
              ))}
            </div>
            <label className="check"><input type="checkbox" checked={role === 'both'} onChange={e => setRole(e.target.checked ? 'both' : 'guest')} /><span>Les deux : je veux manger et cuisiner.</span></label>
            <button className="btn btn-primary btn-block btn-lg" onClick={next}>Continuer <Icon name="arrow" size={18} /></button>
            <p className="muted small center" style={{ marginTop: '1.2rem' }}>Déjà un compte ? <Link className="inline-link" href="/connexion">Se connecter</Link></p>
          </>
        )}

        {step === 1 && (
          <form onSubmit={e => { e.preventDefault(); submitInfos() }} noValidate>
            <div className="two-col">
              <label className="field"><span className="field-label">Prénom</span><input className="input" value={first} onChange={e => setFirst(e.target.value)} autoComplete="given-name" maxLength={60} /></label>
              <label className="field"><span className="field-label">Nom</span><input className="input" value={last} onChange={e => setLast(e.target.value)} autoComplete="family-name" maxLength={60} /></label>
            </div>
            <label className="field"><span className="field-label">Email</span><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="vous@exemple.fr" />
              <span className="field-hint">Nous vous enverrons un code pour vérifier qu’elle est bien à vous.</span></label>
            <label className="field"><span className="field-label">Date de naissance</span><input className="input" type="date" value={birth} onChange={e => setBirth(e.target.value)} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} />
              <span className="field-hint">Shareat est réservé aux 18 ans et plus. Elle n’est jamais affichée.</span></label>
            <PasswordField label="Mot de passe" value={pw} onChange={setPw} autoComplete="new-password" ctx={ctx} />
            <PasswordField label="Retapez le mot de passe" value={pw2} onChange={setPw2} autoComplete="new-password" showRules={false} />
            {pw2 && pw !== pw2 && <p className="field-hint" style={{ color: 'var(--danger)', marginTop: '-0.6rem' }}>Les deux mots de passe sont différents.</p>}
            <label className="hp" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} />
              <span>J’ai 18 ans ou plus et j’accepte les <Link className="inline-link" href="/conditions" target="_blank">conditions d’utilisation</Link> et la <Link className="inline-link" href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span></label>
            <label className="check"><input type="checkbox" checked={news} onChange={e => setNews(e.target.checked)} /><span>Je veux recevoir les nouveaux repas près de chez moi par email (facultatif, désinscription en un clic).</span></label>
            {error && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <div className="row-btns" style={{ justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(0)}><Icon name="back" size={18} /> Retour</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
            </div>
            <div className="note"><Icon name="lock" size={18} /><span>Votre mot de passe est chiffré : personne chez Shareat ne peut le lire.</span></div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={e => { e.preventDefault(); verify() }}>
            <p className="muted" style={{ marginTop: 0, lineHeight: 1.7 }}>Nous avons envoyé un code à 6 chiffres à <strong style={{ color: 'var(--text)' }}>{email}</strong>. Tapez-le ici. Pensez à regarder dans les courriers indésirables.</p>
            {!supabaseConfigured && <div className="note warn"><Icon name="eye" size={18} /><span>Aperçu : aucun email n’est envoyé. Tapez n’importe quels 6 chiffres.</span></div>}
            <div className="code-inputs">
              {code.map((d, i) => (
                <input key={i} ref={el => { codeRefs.current[i] = el }} className="input" inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  value={d} onChange={e => setDigit(i, e.target.value)} aria-label={`Chiffre ${i + 1}`} maxLength={6}
                  onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) codeRefs.current[i - 1]?.focus() }} />
              ))}
            </div>
            {error && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? 'Vérification…' : 'Vérifier mon email'}</button>
            <p className="muted small center" style={{ marginTop: '1rem' }}>
              Pas reçu ? <button type="button" className="link" onClick={resend} disabled={cooldown > 0}>{cooldown > 0 ? `Renvoyer dans ${cooldown} s` : 'Renvoyer le code'}</button>
              {' · '}<button type="button" className="link" onClick={() => setStep(1)}>Changer d’email</button>
            </p>
          </form>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
            <span className="tile-icon" style={{ color: 'var(--ok)', width: 72, height: 72 }}><Icon name="check" size={36} /></span>
            <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.7 }}>Bienvenue {first || ''} ! Votre compte est prêt.</p>
            <div className="note ok" style={{ margin: 0 }}><Icon name="shield" size={18} /><span>Conseil : activez la double vérification dans « Sécurité » pour protéger encore mieux votre compte.</span></div>
            <div className="row-btns" style={{ justifyContent: 'flex-start', marginTop: '0.4rem' }}>
              {role !== 'guest' && <Link className="btn btn-primary" href="/espace-hote">Aller à mon espace hôte</Link>}
              <Link className={`btn ${role === 'guest' ? 'btn-primary' : 'btn-ghost'}`} href={role === 'guest' ? '/?vue=explorer' : '/mon-compte'}>{role === 'guest' ? 'Trouver un repas' : 'Mon espace invité'}</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
