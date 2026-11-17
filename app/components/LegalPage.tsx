import Link from 'next/link'
import type { ReactNode } from 'react'
import { LAST_UPDATE } from '@/lib/legal'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="shell">
      <header className="nav">
        <Link className="logo" href="/">Shareat</Link>
        <nav className="nav-links">
          <Link className="nav-link" href="/mentions-legales">Mentions légales</Link>
          <Link className="nav-link" href="/conditions">Conditions</Link>
          <Link className="nav-link" href="/confidentialite">Confidentialité</Link>
        </nav>
      </header>
      <main className="main">
        <article className="legal">
          <Link className="legal-back" href="/">← Retour à Shareat</Link>
          <h1>{title}</h1>
          <p className="legal-updated">Dernière mise à jour : {LAST_UPDATE}</p>
          {children}
        </article>
      </main>
      <footer className="footer">
        <span className="logo logo-static">Shareat</span>
        <nav className="footer-links" aria-label="Informations légales">
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/conditions">Conditions d’utilisation et de vente</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
      </footer>
    </div>
  )
}
