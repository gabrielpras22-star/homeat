'use client'

import { useState } from 'react'
import Icon from '../components/site/Icons'
import { Journey, type Step } from '../components/site/Interactive'
import { FREE_CANCELLATION_HOURS, TRANSFER_DELAY_HOURS } from '@/lib/shared'

const GUEST: Step[] = [
  { short: 'Je crée mon compte', title: 'Je crée mon compte', icon: 'user', text: 'Il faut un compte pour réserver. Cela prend une minute : votre nom, votre email et un mot de passe solide.', points: ['Il faut avoir 18 ans ou plus.', 'Vous confirmez votre email avec un code.'] },
  { short: 'Je cherche un repas', title: 'Je cherche un repas', icon: 'search', text: 'Tapez votre ville, ou regardez la carte. Vous pouvez trier : halal, végétarien, sans gluten, repas étudiant…', points: ['Chaque repas montre la date, l’heure, le prix et les places restantes.', 'Les allergènes sont toujours indiqués.'] },
  { short: 'Je pose mes questions', title: 'Je pose mes questions', icon: 'chat', text: 'Un doute ? Écrivez à l’hôte avant de réserver, avec la messagerie du site. Pas besoin de donner votre numéro.' },
  { short: 'Je réserve et je paie', title: 'Je réserve et je paie', icon: 'card', text: 'Choisissez le nombre de places, puis payez en ligne. Le paiement est protégé par Stripe : Shareat ne voit jamais votre carte.', points: ['Vous recevez l’adresse exacte juste après.', `Annulation gratuite jusqu’à ${FREE_CANCELLATION_HOURS} h avant.`] },
  { short: 'Je mange et je note', title: 'Je mange, puis je donne mon avis', icon: 'star', text: 'Le jour venu, vous allez chez l’hôte. Après le repas, vous pouvez mettre des étoiles et un petit mot pour aider les autres.' },
]

const HOST: Step[] = [
  { short: 'Je crée mon compte', title: 'Je crée mon compte hôte', icon: 'user', text: 'Même compte que les invités. Choisissez « Je veux recevoir » à l’inscription, ou activez l’espace hôte plus tard.' },
  { short: 'Je relie ma banque', title: 'Je relie mon compte bancaire', icon: 'shield', text: 'Pour être payé, vous vérifiez votre identité et donnez votre IBAN à Stripe (notre partenaire de paiement). Environ 5 minutes.' },
  { short: 'Je propose un repas', title: 'Je propose un repas', icon: 'plate', text: 'Un titre, une date, un prix, le nombre de places, le menu et les allergènes. Ajoutez de belles photos de vos plats.', points: ['Votre adresse reste cachée : seule une zone d’1 km est visible.', 'Votre page s’améliore avec le score de visibilité.'] },
  { short: 'Je reçois', title: 'Je reçois mes invités', icon: 'users', text: 'Vous voyez qui a réservé dans votre espace hôte. Vous pouvez leur écrire. Le jour venu, vous les accueillez.' },
  { short: 'Je suis payé', title: 'Je suis payé, et je donne mon avis', icon: 'euro', text: `L’argent arrive sur votre compte ${TRANSFER_DELAY_HOURS} h après le repas. Vous pouvez aussi laisser un avis sur vos invités (ponctualité, respect).` },
]

export default function HowTabs() {
  const [who, setWho] = useState<'guest' | 'host'>('guest')
  return (
    <>
      <div className="role-pick reveal" style={{ maxWidth: 560 }}>
        <button className={`role-opt${who === 'guest' ? ' on' : ''}`} onClick={() => setWho('guest')} aria-pressed={who === 'guest'}>
          <Icon name="user" size={26} /><strong>Je veux manger</strong><span>Je suis invité</span>
        </button>
        <button className={`role-opt${who === 'host' ? ' on' : ''}`} onClick={() => setWho('host')} aria-pressed={who === 'host'}>
          <Icon name="plate" size={26} /><strong>Je veux cuisiner</strong><span>Je suis hôte</span>
        </button>
      </div>
      <div key={who} className="fade-swap">
        {who === 'guest'
          ? <Journey steps={GUEST} cta={{ href: '/inscription', label: 'Créer mon compte' }} />
          : <Journey steps={HOST} cta={{ href: '/inscription?role=hote', label: 'Devenir hôte' }} />}
      </div>
    </>
  )
}
