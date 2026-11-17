import type { Metadata } from 'next'
import PageShell from '../components/site/PageShell'
import HowTabs from './HowTabs'
import { CancelTimeline, PriceCalc } from '../components/site/Interactive'

export const metadata: Metadata = {
  title: 'Comment ça marche · Shareat',
  description: 'Réserver un repas ou recevoir des invités sur Shareat, étape par étape.',
}

export default function HowItWorks() {
  return (
    <PageShell
      crumb="Comment ça marche"
      eyebrow="Mode d’emploi"
      title={<>Comment ça <span className="accent">marche</span> ?</>}
      lead="Choisissez qui vous êtes, puis cliquez sur chaque étape. Tout est expliqué avec des mots simples."
    >
      <section className="section narrow">
        <HowTabs />
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">L’argent</p>
        <h2 className="title reveal">Combien ça coûte ?</h2>
        <div className="reveal"><PriceCalc /></div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Changer d’avis</p>
        <h2 className="title reveal">Et si je ne peux plus venir ?</h2>
        <p className="muted reveal" style={{ marginTop: '-0.6rem', marginBottom: '1.2rem' }}>Cliquez sur chaque point de la ligne pour voir ce qui se passe.</p>
        <div className="reveal"><CancelTimeline /></div>
      </section>
    </PageShell>
  )
}
