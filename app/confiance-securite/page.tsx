import type { Metadata } from 'next'
import Link from 'next/link'
import PageShell from '../components/site/PageShell'
import Icon from '../components/site/Icons'
import { FREE_CANCELLATION_HOURS } from '@/lib/shared'

export const metadata: Metadata = {
  title: 'Confiance et sécurité · Shareat',
  description: 'Comptes protégés, paiement sécurisé, adresse privée, avis vérifiés : comment Shareat vous protège.',
}

const BLOCKS: { title: string; items: { icon: string; t: string; d: string }[] }[] = [
  {
    title: 'Votre compte est protégé',
    items: [
      { icon: 'key', t: 'Mot de passe solide', d: 'Au moins 10 caractères, avec majuscule, minuscule et chiffre. Les mots de passe trop connus ou déjà piratés sont refusés.' },
      { icon: 'mail', t: 'Email vérifié', d: 'Un code est envoyé à votre adresse pour prouver qu’elle est bien à vous avant d’activer le compte.' },
      { icon: 'lock', t: 'Double vérification', d: 'Vous pouvez activer un code à usage unique à chaque connexion (application d’authentification).' },
      { icon: 'bell', t: 'Alertes de connexion', d: 'Un email vous prévient quand votre compte est ouvert sur un nouvel appareil. Vous pouvez déconnecter tous les appareils d’un clic.' },
      { icon: 'clock', t: 'Trop d’essais = pause', d: 'Après plusieurs mots de passe faux, la connexion est bloquée quelques minutes pour arrêter les robots.' },
      { icon: 'user', t: '18 ans et plus', d: 'Shareat est réservé aux adultes. La date de naissance est demandée à l’inscription.' },
    ],
  },
  {
    title: 'Votre argent est protégé',
    items: [
      { icon: 'card', t: 'Paiement par Stripe', d: 'Le paiement passe par Stripe, utilisé par des millions de sites. Shareat ne voit et ne garde jamais votre numéro de carte.' },
      { icon: 'euro', t: 'L’hôte est payé après', d: 'L’argent est gardé jusqu’au repas. L’hôte le reçoit seulement 24 h après. Si le repas n’a pas lieu, vous êtes remboursé.' },
      { icon: 'calendar', t: 'Annulation gratuite', d: `Jusqu’à ${FREE_CANCELLATION_HOURS} h avant le repas, vous êtes remboursé en entier. Si l’hôte annule, tout le monde est remboursé.` },
      { icon: 'chat', t: 'Payez sur le site seulement', d: 'Ne payez jamais un hôte en liquide ou par virement en dehors de Shareat : vous ne seriez plus protégé.' },
    ],
  },
  {
    title: 'Votre vie privée est protégée',
    items: [
      { icon: 'map', t: 'Adresse cachée', d: 'Avant de réserver, on ne montre qu’une zone d’environ 1 km. L’adresse exacte est donnée seulement aux invités qui ont payé.' },
      { icon: 'chat', t: 'Messagerie interne', d: 'Vous discutez sans donner votre numéro ni votre email. Les messages restent sur Shareat.' },
      { icon: 'doc', t: 'Vos données vous appartiennent', d: 'Téléchargez vos données ou supprimez votre compte quand vous voulez, depuis votre espace (RGPD).' },
    ],
  },
  {
    title: 'Des avis et des repas fiables',
    items: [
      { icon: 'star', t: 'Avis vérifiés', d: 'Seule une personne qui a vraiment payé et participé au repas peut laisser un avis. Les hôtes notent aussi leurs invités.' },
      { icon: 'leaf', t: 'Allergènes obligatoires', d: 'Chaque hôte doit dire quels allergènes majeurs sont dans son repas (14 allergènes, règle européenne).' },
      { icon: 'flag', t: 'Signaler en un clic', d: 'Un comportement bizarre, un faux profil, un message gênant ? Signalez-le : notre équipe regarde sous 24 h.' },
      { icon: 'shield', t: 'Aucune fausse annonce', d: 'Pas de faux repas ni de faux avis pour faire joli. Ce que vous voyez est réel.' },
    ],
  },
]

export default function Trust() {
  return (
    <PageShell
      crumb="Confiance et sécurité"
      eyebrow="Confiance et sécurité"
      title={<>Vous êtes <span className="accent">protégé</span>, à chaque étape</>}
      lead="Manger chez quelqu’un qu’on ne connaît pas, ça demande de la confiance. Voici tout ce que nous faisons pour que tout se passe bien."
    >
      {BLOCKS.map(b => (
        <section key={b.title} className="section narrow">
          <h2 className="title reveal">{b.title}</h2>
          <div className="cards">
            {b.items.map((it, i) => (
              <div key={it.t} className="info-card glass reveal" style={{ ['--d' as string]: `${i * 0.05}s` }}>
                <span className="tile-icon"><Icon name={it.icon} /></span>
                <h3>{it.t}</h3>
                <p>{it.d}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
      <section className="section narrow">
        <div className="glass reveal" style={{ padding: 'clamp(1.4rem, 4vw, 2.4rem)', display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: '36rem' }}>
            <h2 className="title" style={{ margin: '0 0 0.4rem' }}>Un problème pendant un repas ?</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>En cas de danger, appelez le 112. Pour tout le reste, notre équipe vous répond : signalement, litige, remboursement.</p>
          </div>
          <div className="row-btns" style={{ margin: 0 }}>
            <Link className="btn btn-primary" href="/aide#contact"><Icon name="flag" size={18} /> Signaler un problème</Link>
            <Link className="btn btn-ghost" href="/aide">Centre d’aide</Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
