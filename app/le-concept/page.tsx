/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import Link from 'next/link'
import PageShell from '../components/site/PageShell'
import Icon from '../components/site/Icons'
import { Tile } from '../components/site/Interactive'

export const metadata: Metadata = {
  title: 'Le concept · Shareat',
  description: 'Shareat, c’est quoi ? Des repas faits maison chez des habitants, à partager avec d’autres invités.',
}

const img = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

const VALUES = [
  { icon: 'plate', t: 'Du fait maison', d: 'Pas de restaurant : une vraie cuisine, chez quelqu’un, préparée pour vous.' },
  { icon: 'users', t: 'Des rencontres', d: 'Vous partagez la table avec l’hôte et d’autres invités. On arrive inconnus, on repart amis.' },
  { icon: 'globe', t: 'Toutes les cultures', d: 'Marocaine, japonaise, italienne, libanaise… On voyage sans prendre l’avion.' },
  { icon: 'euro', t: 'Un prix clair', d: 'Le prix est écrit dès le début. Pas de surprise, pas de frais cachés.' },
  { icon: 'shield', t: 'En confiance', d: 'Paiement en ligne sécurisé, avis vérifiés, adresse donnée seulement après la réservation.' },
  { icon: 'leaf', t: 'Pour tout le monde', d: 'Halal, casher, végétarien, végan, sans gluten, repas étudiant à 10 € maximum…' },
]

export default function Concept() {
  return (
    <PageShell
      crumb="Le concept"
      eyebrow="Le concept"
      title={<>Manger <span className="accent">chez quelqu’un</span>, comme à la maison</>}
      lead="Shareat, c’est simple : une personne cuisine chez elle et ouvre sa table. Vous réservez une place, vous venez, vous mangez ensemble. Voilà."
    >
      <section className="section narrow">
        <div className="split">
          <div className="reveal">
            <p className="eyebrow">En une phrase</p>
            <p className="big-quote">Un <span className="accent">hôte</span> cuisine. Des <span className="accent">invités</span> réservent. Tout le monde passe une bonne soirée.</p>
          </div>
          <img className="reveal" style={{ ['--d' as string]: '0.1s' }} src={img('1556910103-1c02745aae4d', 1000)} alt="Une personne prépare un repas dans sa cuisine" />
        </div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Qui fait quoi ?</p>
        <h2 className="title reveal">Deux rôles, très simples</h2>
        <div className="tiles">
          <Tile href="/?vue=explorer" icon="user" title="L’invité" text="C’est vous si vous voulez manger. Vous choisissez un repas, vous payez votre place en ligne, vous y allez." go="Trouver un repas" />
          <Tile href="/devenir-hote" icon="plate" title="L’hôte" text="C’est vous si vous aimez cuisiner. Vous proposez un repas chez vous, vous fixez le prix, vous recevez des invités." go="Devenir hôte" delay={0.08} />
        </div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Ce qui compte pour nous</p>
        <h2 className="title reveal">Nos promesses</h2>
        <div className="cards">
          {VALUES.map((v, i) => (
            <div key={v.t} className="info-card glass reveal" style={{ ['--d' as string]: `${i * 0.05}s` }}>
              <span className="tile-icon"><Icon name={v.icon} /></span>
              <h3>{v.t}</h3>
              <p>{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section narrow">
        <div className="glass reveal" style={{ padding: 'clamp(1.6rem, 5vw, 3rem)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <h2 className="title" style={{ margin: 0 }}>Envie d’essayer ?</h2>
          <p className="muted" style={{ margin: 0, maxWidth: '32rem', lineHeight: 1.7 }}>Regardez comment ça marche en 5 étapes, ou allez directement voir les repas près de chez vous.</p>
          <div className="row-btns" style={{ marginTop: '0.4rem' }}>
            <Link className="btn btn-primary btn-lg" href="/comment-ca-marche">Comment ça marche <Icon name="arrow" size={18} /></Link>
            <Link className="btn btn-ghost btn-lg" href="/?vue=explorer">Voir les repas</Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
