'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import Icon from '../components/site/Icons'
import { Accordion, type QA } from '../components/site/Interactive'
import { COMMISSION_RATE, FREE_CANCELLATION_HOURS, TRANSFER_DELAY_HOURS } from '@/lib/shared'
import { PUBLISHER } from '@/lib/legal'
import { cleanText, createThrottle, emailOk, ticketId } from '@/lib/security'

const CATS = [
  { id: 'reserver', icon: 'calendar', label: 'Réserver' },
  { id: 'payer', icon: 'card', label: 'Payer et rembourser' },
  { id: 'compte', icon: 'user', label: 'Mon compte' },
  { id: 'hote', icon: 'plate', label: 'Être hôte' },
  { id: 'securite', icon: 'shield', label: 'Sécurité' },
]

const FAQ: QA[] = [
  { cat: 'reserver', q: 'Comment réserver un repas ?', a: 'Cliquez sur « Trouver un repas », choisissez une table, indiquez le nombre de places puis payez en ligne. C’est tout : vous recevez un email avec l’adresse.' },
  { cat: 'reserver', q: 'Quand vais-je recevoir l’adresse ?', a: 'Juste après le paiement, sur la page du repas et dans votre email de confirmation. Avant, seule une zone d’environ 1 km est visible.' },
  { cat: 'reserver', q: 'Puis-je venir avec des amis ?', a: 'Oui : choisissez plusieurs places au moment de réserver, dans la limite des places restantes.' },
  { cat: 'reserver', q: 'J’ai une allergie, que faire ?', a: 'Regardez la liste des allergènes sur la page du repas, puis écrivez à l’hôte avant de réserver pour lui en parler.' },
  { cat: 'payer', q: 'Comment annuler et être remboursé ?', a: `Allez dans « Mon espace » > « Mes réservations » > « Annuler ». Jusqu’à ${FREE_CANCELLATION_HOURS} h avant le repas, vous êtes remboursé en entier, sous 5 à 10 jours.` },
  { cat: 'payer', q: 'L’hôte a annulé, que se passe-t-il ?', a: 'Vous êtes remboursé automatiquement et en entier. Vous recevez un email pour vous prévenir.' },
  { cat: 'payer', q: 'Combien prend Shareat ?', a: `Shareat prend une commission de ${Math.round(COMMISSION_RATE * 100)} % sur chaque place (taux provisoire). Elle paie le paiement sécurisé, le service client et les remboursements. Le prix que vous voyez est toujours le prix final.` },
  { cat: 'payer', q: 'Le repas ne s’est pas bien passé, puis-je être remboursé ?', a: 'Écrivez-nous dans les 48 h avec le formulaire ci-dessous (sujet « Litige »). Nous écoutons les deux personnes et décidons d’un remboursement si c’est justifié.' },
  { cat: 'compte', q: 'J’ai oublié mon mot de passe', a: 'Sur la page Connexion, cliquez sur « Mot de passe oublié ». Vous recevez un lien valable 1 heure pour en choisir un nouveau.' },
  { cat: 'compte', q: 'Comment supprimer mon compte ?', a: 'Dans « Mon espace » > « Sécurité » > « Supprimer mon compte ». Vos données sont effacées, sauf celles que la loi nous oblige à garder (factures).' },
  { cat: 'compte', q: 'Comment télécharger mes données ?', a: 'Dans « Mon espace » > « Sécurité » > « Télécharger mes données ». Vous recevez un fichier avec tout ce que nous savons de vous.' },
  { cat: 'hote', q: 'Quand suis-je payé ?', a: `${TRANSFER_DELAY_HOURS} h après le début du repas, sur le compte bancaire relié à Stripe. Comptez 1 à 3 jours pour que la banque l’affiche.` },
  { cat: 'hote', q: 'Comment être mieux classé dans les recherches ?', a: 'Dans votre espace hôte, ouvrez « Visibilité » : une liste de conseils simples (photos, description, réponses rapides, avis).' },
  { cat: 'hote', q: 'Un invité ne vient pas : que faire ?', a: 'Vous gardez votre paiement. Vous pouvez le signaler et laisser un avis sur lui dans « Avis sur mes invités ».' },
  { cat: 'securite', q: 'Comment signaler quelqu’un ?', a: 'Sur son profil ou dans la conversation, cliquez sur « Signaler ». Ou utilisez le formulaire ci-dessous avec le sujet « Signalement ». Nous regardons sous 24 h.' },
  { cat: 'securite', q: 'On me demande de payer en dehors du site', a: 'Ne payez jamais en dehors de Shareat : vous ne seriez plus protégé. Signalez-nous la personne tout de suite.' },
  { cat: 'securite', q: 'Je pense que mon compte a été piraté', a: 'Changez votre mot de passe, puis « Déconnecter tous les appareils » dans Sécurité. Écrivez-nous : nous bloquons le compte le temps de vérifier.' },
]

const SUBJECTS = ['Question sur une réservation', 'Remboursement', 'Litige après un repas', 'Signalement d’une personne', 'Problème de compte', 'Être hôte', 'Autre chose']

const throttle = createThrottle(3, 60_000)

export default function HelpCenter() {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [helpful, setHelpful] = useState<'oui' | 'non' | null>(null)

  // Formulaire de contact
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [email, setEmail] = useState('')
  const [booking, setBooking] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [trap, setTrap] = useState('') // piège à robots, invisible pour les humains
  const [error, setError] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const openedAt = useRef(0)

  // Suivi de demande
  const [track, setTrack] = useState('')
  const [trackResult, setTrackResult] = useState<string | null>(null)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FAQ.filter(f => (!cat || f.cat === cat) && (!q || (f.q + ' ' + String(f.a)).toLowerCase().includes(q)))
  }, [query, cat])

  const submit = () => {
    setError('')
    const wait = throttle.remainingMs()
    if (wait > 0) { setError(`Trop d’envois d’un coup. Réessayez dans ${Math.ceil(wait / 1000)} secondes.`); return }
    if (trap || (openedAt.current && Date.now() - openedAt.current < 2500)) { throttle.fail(); setSent(ticketId()); return } // robot : on fait semblant
    if (!emailOk(email)) { setError('Votre adresse email ne semble pas correcte.'); return }
    const msg = cleanText(message, 3000)
    if (msg.length < 20) { setError('Expliquez votre demande en quelques phrases (20 caractères minimum).'); return }
    if (!consent) { setError('Cochez la case pour accepter que nous utilisions ces informations pour vous répondre.'); return }
    throttle.fail() // compte chaque envoi pour limiter les rafales
    setSent(ticketId())
  }

  const isUrgent = subject.startsWith('Signalement') || subject.startsWith('Litige')

  return (
    <>
      {/* Recherche + catégories */}
      <section className="section narrow" style={{ paddingTop: 0 }}>
        <div className="search-big glass reveal">
          <Icon name="search" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tapez votre question : annuler, rembourser, mot de passe…" aria-label="Rechercher dans l’aide" />
          {query && <button className="btn btn-ghost btn-sm" onClick={() => setQuery('')}>Effacer</button>}
        </div>
        <div className="chips chips-wrap reveal" role="group" aria-label="Thèmes" style={{ marginBottom: '1.4rem' }}>
          <button className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat(null)} aria-pressed={!cat}>Tout</button>
          {CATS.map(c => (
            <button key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(cat === c.id ? null : c.id)} aria-pressed={cat === c.id}
              style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
              <Icon name={c.icon} size={16} /> {c.label}
            </button>
          ))}
        </div>
        {list.length > 0
          ? <Accordion key={`${cat}-${query}`} items={list} />
          : <div className="empty-soft glass"><Icon name="help" size={36} /><p>Aucune réponse trouvée pour « {query} ». Écrivez-nous plus bas : nous vous répondrons.</p><a className="btn btn-primary" href="#contact">Nous écrire</a></div>}
        <div className="note" style={{ marginTop: '1.2rem', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
          {helpful
            ? <span className="fade-swap">{helpful === 'oui' ? 'Merci, ça nous aide à améliorer l’aide.' : 'Désolé. Écrivez-nous ci-dessous : nous vous répondons personnellement.'}</span>
            : <><span>Avez-vous trouvé votre réponse ?</span><span className="row-btns-inline"><button className="btn btn-ghost btn-sm" onClick={() => setHelpful('oui')}>Oui</button><button className="btn btn-ghost btn-sm" onClick={() => setHelpful('non')}>Non</button></span></>}
        </div>
      </section>

      {/* Les engagements du service client */}
      <section className="section narrow">
        <h2 className="title reveal">Notre service client</h2>
        <div className="cards">
          {[
            { icon: 'clock', t: 'Réponse sous 24 h', d: 'Tous les jours, même le week-end. Les signalements et litiges sont traités en premier.' },
            { icon: 'smile', t: 'Une vraie personne', d: 'Pas de robot : quelqu’un de l’équipe lit votre message et vous répond.' },
            { icon: 'doc', t: 'Un numéro de suivi', d: 'Chaque demande reçoit un numéro. Vous pouvez suivre où elle en est à tout moment.' },
            { icon: 'scale', t: 'Médiation gratuite', d: 'Si notre réponse ne vous satisfait pas, vous pouvez saisir gratuitement un médiateur de la consommation.' },
          ].map((c, i) => (
            <div key={c.t} className="info-card glass reveal" style={{ ['--d' as string]: `${i * 0.05}s` }}>
              <span className="tile-icon"><Icon name={c.icon} /></span>
              <h3>{c.t}</h3>
              <p>{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formulaire de contact */}
      <section className="section narrow" id="contact">
        <div className="split" style={{ alignItems: 'start' }}>
          <div className="reveal">
            <p className="eyebrow">Nous écrire</p>
            <h2 className="title">Contacter l’équipe</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>Choisissez le sujet, expliquez simplement ce qui se passe. Si cela concerne une réservation, donnez son numéro (il est dans votre email de confirmation).</p>
            <div className="note warn"><Icon name="phone" size={18} /><span>En cas de danger pendant un repas, appelez d’abord le <strong>112</strong> (urgences).</span></div>
            <div className="note"><Icon name="mail" size={18} /><span>Vous pouvez aussi écrire à <strong>{PUBLISHER.email}</strong>.</span></div>

            <div className="glass" style={{ padding: '1.3rem', marginTop: '1.4rem' }}>
              <h3 style={{ margin: '0 0 0.7rem', fontSize: '1rem' }}>Suivre une demande</h3>
              <form style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} onSubmit={e => { e.preventDefault(); setTrackResult(/^SH-[A-Z0-9]{4}-[A-Z0-9]{2}$/i.test(track.trim()) ? 'reçue' : 'invalide') }}>
                <input className="input input-pill" style={{ flex: 1, minWidth: '10rem' }} value={track} onChange={e => { setTrack(e.target.value); setTrackResult(null) }} placeholder="SH-XXXX-XX" aria-label="Numéro de demande" />
                <button className="btn btn-ghost" type="submit">Voir</button>
              </form>
              {trackResult === 'reçue' && <p className="fade-swap small" style={{ color: 'var(--ok)', margin: '0.7rem 0 0' }}>Demande {track.toUpperCase()} : reçue, une personne de l’équipe s’en occupe. Réponse par email sous 24 h.</p>}
              {trackResult === 'invalide' && <p className="err small">Ce numéro n’a pas le bon format. Exemple : SH-7K3P-92.</p>}
            </div>
          </div>

          <div className="glass reveal" style={{ padding: 'clamp(1.3rem, 4vw, 2rem)', ['--d' as string]: '0.08s' }}>
            {sent ? (
              <div className="fade-swap" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', alignItems: 'flex-start' }}>
                <span className="tile-icon" style={{ color: 'var(--ok)' }}><Icon name="check" size={30} /></span>
                <h3 className="title" style={{ margin: 0 }}>Message bien reçu</h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Votre numéro de demande : <span className="ticket">{sent}</span></p>
                <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>Gardez-le précieusement. Nous vous répondons par email sous 24 h{isUrgent ? ' (en priorité, car c’est un signalement ou un litige)' : ''}.</p>
                <button className="btn btn-ghost" onClick={() => { setSent(null); setMessage(''); setBooking(''); setConsent(false) }}>Envoyer un autre message</button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); submit() }} onFocus={() => { if (!openedAt.current) openedAt.current = Date.now() }} noValidate>
                <label className="field">
                  <span className="field-label">Sujet</span>
                  <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
                    {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </label>
                {isUrgent && <p className="note warn fade-swap"><Icon name="flag" size={18} /><span>Ce sujet est traité en priorité.</span></p>}
                <label className="field">
                  <span className="field-label">Votre email</span>
                  <input className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr" maxLength={254} />
                </label>
                <label className="field">
                  <span className="field-label">Numéro de réservation (si vous l’avez)</span>
                  <input className="input" value={booking} onChange={e => setBooking(e.target.value)} placeholder="Ex. R-2026-1234" maxLength={40} />
                </label>
                <label className="field">
                  <span className="field-label">Votre message</span>
                  <textarea className="input" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Expliquez ce qui se passe, avec la date du repas si besoin." maxLength={3000} />
                  <span className="field-hint">{message.length} / 3000</span>
                </label>
                <label className="hp" aria-hidden="true">Ne pas remplir<input tabIndex={-1} autoComplete="off" value={trap} onChange={e => setTrap(e.target.value)} /></label>
                <label className="check">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
                  <span>J’accepte que Shareat utilise ces informations pour répondre à ma demande (voir la <Link className="inline-link" href="/confidentialite">confidentialité</Link>).</span>
                </label>
                {error && <p className="err" role="alert"><Icon name="x" size={16} /> {error}</p>}
                <button className="btn btn-primary btn-block" type="submit">Envoyer mon message <Icon name="arrow" size={18} /></button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Réclamation et médiation */}
      <section className="section narrow">
        <div className="glass reveal" style={{ padding: 'clamp(1.3rem, 4vw, 2rem)' }}>
          <h2 className="title" style={{ marginTop: 0 }}>Pas satisfait de notre réponse ?</h2>
          <ol className="checklist">
            <li><span className="tick" style={{ background: 'var(--sky)', borderColor: 'var(--sky)', fontWeight: 700 }}>1</span><div><strong>Réclamation écrite</strong><small>Répondez à notre email en écrivant « réclamation ». Une autre personne de l’équipe reprend le dossier sous 7 jours.</small></div></li>
            <li><span className="tick" style={{ background: 'var(--sky)', borderColor: 'var(--sky)', fontWeight: 700 }}>2</span><div><strong>Médiateur de la consommation</strong><small>Si le désaccord continue après 2 mois, vous pouvez saisir gratuitement le médiateur : [nom et site du médiateur à compléter].</small></div></li>
            <li><span className="tick" style={{ background: 'var(--sky)', borderColor: 'var(--sky)', fontWeight: 700 }}>3</span><div><strong>Conciliateur de justice</strong><small>Gratuit lui aussi : il aide à trouver un accord à l’amiable, près de chez vous (conciliateurs.fr).</small></div></li>
          </ol>
        </div>
      </section>
    </>
  )
}
