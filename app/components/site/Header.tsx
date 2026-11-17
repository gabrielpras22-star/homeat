'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import Icon from './Icons'
import { supabaseConfigured } from '@/lib/supabase'

/** Toutes les pages du site, dans l'ordre du menu. */
export const NAV_LINKS: { href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/?vue=explorer', label: 'Trouver un repas', icon: 'search' },
  { href: '/?vue=carte', label: 'Carte', icon: 'map' },
  { href: '/le-concept', label: 'Le concept', icon: 'globe' },
  { href: '/comment-ca-marche', label: 'Comment ça marche', icon: 'sparkle' },
  { href: '/devenir-hote', label: 'Devenir hôte', icon: 'plate' },
  { href: '/confiance-securite', label: 'Sécurité', icon: 'shield' },
  { href: '/aide', label: 'Aide', icon: 'help' },
]

const ACCOUNT_LINKS = [
  { href: '/mon-compte', label: 'Mon espace invité', icon: 'user' },
  { href: '/espace-hote', label: 'Mon espace hôte', icon: 'plate' },
]

/** Barre du bas, version téléphone : les 5 endroits les plus utiles, gros et lisibles. */
const BOTTOM = [
  { href: '/', label: 'Accueil', icon: 'home' },
  { href: '/?vue=explorer', label: 'Repas', icon: 'search' },
  { href: '/mon-compte', label: 'Mon espace', icon: 'user' },
  { href: '/espace-hote', label: 'Hôte', icon: 'plate' },
  { href: '/aide', label: 'Aide', icon: 'help' },
]

/**
 * Menu du haut, identique sur toutes les pages. La page en cours est en gras.
 * `current` permet à la page d'accueil (qui change de vue sans changer d'adresse) d'indiquer sa vue.
 */
export default function Header({ onNavigate, account, current }: { onNavigate?: (href: string) => void; account?: ReactNode; current?: string }) {
  const pathname = usePathname()
  const here = current ?? pathname
  const [open, setOpen] = useState(false)
  const pillsRef = useRef<HTMLElement>(null)

  // Échap ferme le menu ; la page derrière ne défile pas pendant qu'il est ouvert.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])

  // Sur téléphone, la page en cours reste visible dans la rangée de pages.
  useEffect(() => {
    const el = pillsRef.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (el && pillsRef.current) pillsRef.current.scrollLeft = el.offsetLeft - pillsRef.current.clientWidth / 2 + el.clientWidth / 2
  }, [here])

  const isActive = (href: string) => (href === '/' || href.startsWith('/?') ? here === href : here.startsWith(href))
  const click = (href: string) => { setOpen(false); onNavigate?.(href) }
  const link = (l: { href: string; label: string; icon: string }, cls: string, withIcon = false) => (
    <Link key={l.href} href={l.href} className={`${cls}${isActive(l.href) ? ' active' : ''}`} aria-current={isActive(l.href) ? 'page' : undefined} onClick={() => click(l.href)}>
      {withIcon && <Icon name={l.icon} />}{l.label}
    </Link>
  )

  return (
    <>
      {!supabaseConfigured && (
        <p className="preview-band" role="note">
          <Icon name="eye" size={16} /> Aperçu local : les comptes, repas et avis affichés sont des exemples, rien n’est enregistré.
        </p>
      )}
      <header className="nav">
        <div className="nav-top">
          <button className="burger" aria-label="Ouvrir le menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <Link className="logo" href="/" onClick={() => click('/')} aria-label="Shareat, accueil">Shareat</Link>
          <div className="nav-actions">
            {account ?? (
              <>
                <Link className="btn btn-ghost btn-sm" href="/connexion">Connexion</Link>
                <Link className="btn btn-primary btn-sm" href="/inscription">Créer un compte</Link>
              </>
            )}
          </div>
        </div>
        <nav ref={pillsRef} className="nav-links" aria-label="Pages du site">
          {NAV_LINKS.map(l => link(l, 'nav-link'))}
        </nav>
      </header>

      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <nav className="drawer" aria-label="Menu" onClick={e => e.stopPropagation()}>
            <div className="drawer-head">
              <span className="logo logo-static" style={{ margin: 0 }}>Shareat</span>
              <button className="burger" aria-label="Fermer le menu" onClick={() => setOpen(false)}><Icon name="x" /></button>
            </div>
            <p className="drawer-title">Les pages</p>
            {NAV_LINKS.map(l => link(l, 'drawer-link', true))}
            <p className="drawer-title">Mon compte</p>
            {ACCOUNT_LINKS.map(l => link(l, 'drawer-link', true))}
            <div className="drawer-btns">
              <Link className="btn btn-ghost btn-block" href="/connexion" onClick={() => click('/connexion')}>Connexion</Link>
              <Link className="btn btn-primary btn-block" href="/inscription" onClick={() => click('/inscription')}>Créer un compte</Link>
            </div>
          </nav>
        </div>
      )}

      <nav className="bottom-bar" aria-label="Navigation rapide">
        {BOTTOM.map(l => (
          <Link key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''} aria-current={isActive(l.href) ? 'page' : undefined} onClick={() => click(l.href)}>
            <Icon name={l.icon} size={22} /><span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
