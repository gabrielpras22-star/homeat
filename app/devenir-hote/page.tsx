/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import Link from 'next/link'
import PageShell from '../components/site/PageShell'
import Icon from '../components/site/Icons'
import { Accordion, PriceCalc } from '../components/site/Interactive'
import { COMMISSION_RATE, STUDENT_MAX_PRICE, TRANSFER_DELAY_HOURS } from '@/lib/shared'

export const metadata: Metadata = {
  title: 'Devenir hôte · Shareat',
  description: 'Ouvrez votre table, fixez votre prix et recevez des invités chez vous.',
}

const TOOLS = [
  { icon: 'camera', t: 'Photos de vos plats', d: 'Ajoutez plusieurs photos, choisissez celle de couverture, changez l’ordre en un clic.' },
  { icon: 'rocket', t: 'Conseils de visibilité', d: 'Une liste de conseils simples, cochés au fur et à mesure, pour apparaître plus haut dans les recherches.' },
  { icon: 'users', t: 'Vos invités', d: 'Voyez qui vient, combien de places restent, et écrivez à tout le monde en même temps.' },
  { icon: 'star', t: 'Avis dans les deux sens', d: 'Vos invités vous notent, et vous notez vos invités : ponctualité, respect, communication.' },
  { icon: 'chart', t: 'Vos revenus', d: 'Chaque virement est listé, avec un graphique de vos gains mois par mois.' },
  { icon: 'calendar', t: 'Votre calendrier', d: 'Dupliquez un repas qui marche pour le proposer à nouveau la semaine suivante.' },
]

const FAQ = [
  { q: 'Faut-il être un chef ?', a: 'Non. Il faut aimer cuisiner et recevoir. Les invités viennent pour la cuisine maison et la rencontre, pas pour un restaurant étoilé.' },
  { q: 'Combien je gagne ?', a: `Vous fixez votre prix par personne. Shareat prend une commission de ${Math.round(COMMISSION_RATE * 100)} % (taux provisoire, fixé définitivement avant l’ouverture) pour le paiement sécurisé et le service client. Vos gains arrivent ${TRANSFER_DELAY_HOURS} h après le repas.` },
  { q: 'Mon adresse est-elle visible ?', a: 'Non. Seule une zone d’environ 1 km apparaît sur la carte. L’adresse exacte est donnée uniquement aux invités qui ont payé.' },
  { q: 'Et si un invité se comporte mal ?', a: 'Vous pouvez le signaler à tout moment et laisser un avis honnête sur lui. Les autres hôtes seront prévenus par sa note.' },
  { q: 'Dois-je déclarer cet argent ?', a: 'Oui, ces revenus sont à déclarer aux impôts. Shareat vous donne un récapitulatif annuel de vos gains pour vous aider.' },
  { q: 'Qu’est-ce qu’un repas étudiant ?', a: `Un repas à ${STUDENT_MAX_PRICE} € maximum pour l’invité. Une belle façon d’accueillir des étudiants et de remplir votre table.` },
]

export default function BecomeHost() {
  return (
    <PageShell
      crumb="Devenir hôte"
      eyebrow="Devenir hôte"
      title={<>Partagez votre <span className="accent">table</span></>}
      lead="Vous aimez cuisiner ? Recevez chez vous des personnes curieuses de votre cuisine et de votre histoire, et soyez payé pour cela."
    >
      <section className="section narrow" style={{ paddingTop: 0 }}>
        <div className="row-btns reveal" style={{ justifyContent: 'flex-start', marginTop: 0 }}>
          <Link className="btn btn-primary btn-lg" href="/inscription?role=hote">Créer mon compte hôte <Icon name="arrow" size={18} /></Link>
          <Link className="btn btn-ghost btn-lg" href="/espace-hote">Voir l’espace hôte</Link>
        </div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Vos gains</p>
        <h2 className="title reveal">Combien vais-je gagner ?</h2>
        <div className="reveal"><PriceCalc mode="host" /></div>
      </section>

      <section className="section narrow">
        <div className="split">
          <img className="reveal" src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1000&q=70" alt="Un hôte cuisine chez lui" />
          <div className="reveal" style={{ ['--d' as string]: '0.1s' }}>
            <p className="eyebrow">En 3 étapes</p>
            <ol className="checklist" style={{ marginTop: '0.6rem' }}>
              {[['Créez votre compte', 'Une minute, avec un email vérifié.'], ['Reliez votre banque', 'Via Stripe, environ 5 minutes.'], ['Publiez votre repas', 'Date, prix, menu, photos : c’est en ligne.']].map(([t, d], i) => (
                <li key={t}><span className="tick" style={{ background: 'var(--sky)', borderColor: 'var(--sky)', fontWeight: 700 }}>{i + 1}</span><div><strong>{t}</strong><small>{d}</small></div></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Votre espace hôte</p>
        <h2 className="title reveal">Des outils pour bien recevoir</h2>
        <div className="cards">
          {TOOLS.map((t, i) => (
            <div key={t.t} className="info-card glass reveal" style={{ ['--d' as string]: `${i * 0.05}s` }}>
              <span className="tile-icon"><Icon name={t.icon} /></span>
              <h3>{t.t}</h3>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section narrow">
        <p className="eyebrow reveal">Questions</p>
        <h2 className="title reveal">Vous vous demandez sûrement…</h2>
        <div className="reveal"><Accordion items={FAQ} startOpen={0} /></div>
        <p className="muted small" style={{ marginTop: '1.2rem' }}>En publiant, vous vous engagez à respecter les <Link className="inline-link" href="/conditions">conditions d’utilisation</Link> (hygiène, allergènes, déclaration de vos revenus).</p>
      </section>
    </PageShell>
  )
}
