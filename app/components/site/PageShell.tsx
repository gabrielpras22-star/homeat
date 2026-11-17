import Link from 'next/link'
import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

/** Gabarit des pages secondaires : menu, fil d'Ariane (« vous êtes ici »), contenu, pied de page. */
export default function PageShell({ crumb, eyebrow, title, lead, children }: {
  crumb?: string
  eyebrow?: string
  title?: ReactNode
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="shell">
      <Header />
      <main className="main">
        {title && (
          <section className="page-hero">
            {crumb && (
              <nav className="crumbs reveal" aria-label="Vous êtes ici">
                <Link href="/">Accueil</Link><span aria-hidden="true">›</span><span aria-current="page">{crumb}</span>
              </nav>
            )}
            {eyebrow && <p className="eyebrow reveal">{eyebrow}</p>}
            <h1 className="display reveal" style={{ ['--d' as string]: '0.05s' }}>{title}</h1>
            {lead && <p className="lead reveal" style={{ ['--d' as string]: '0.1s' }}>{lead}</p>}
          </section>
        )}
        {children}
      </main>
      <Footer />
    </div>
  )
}
