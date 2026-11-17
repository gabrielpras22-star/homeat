import type { ReactNode } from 'react'
import { LAST_UPDATE } from '@/lib/legal'
import PageShell from './site/PageShell'

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <PageShell>
      <article className="legal glass" style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <h1>{title}</h1>
        <p className="legal-updated">Dernière mise à jour : {LAST_UPDATE}</p>
        {children}
      </article>
    </PageShell>
  )
}
