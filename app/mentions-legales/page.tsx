import type { Metadata } from 'next'
import LegalPage from '../components/LegalPage'
import { PUBLISHER, PROVIDERS, SITE } from '@/lib/legal'

export const metadata: Metadata = { title: 'Mentions légales — Shareat' }

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <p>Conformément aux articles 6-III et 19 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l’économie numérique (LCEN), voici les informations relatives au site {SITE.name} ({SITE.url}).</p>

      <h2>Éditeur du site</h2>
      <p>
        <strong>{PUBLISHER.name}</strong><br />
        {PUBLISHER.status}<br />
        Adresse : {PUBLISHER.address}<br />
        Email : <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a><br />
        Téléphone : {PUBLISHER.phone}
        {PUBLISHER.siret && <><br />SIRET : {PUBLISHER.siret}</>}
      </p>
      <p>Directeur de la publication : {PUBLISHER.name}.</p>

      <h2>Hébergement</h2>
      <p>Site : {PROVIDERS.hosting}.</p>
      <p>Base de données : {PROVIDERS.database}.</p>

      <h2>Paiements</h2>
      <p>Les paiements sont traités par {PROVIDERS.payments}, établissement de monnaie électronique agréé par la Banque centrale d’Irlande. Shareat n’a jamais accès aux numéros de carte bancaire.</p>

      <h2>Propriété intellectuelle</h2>
      <p>La structure du site, ses textes et son identité visuelle sont la propriété de l’éditeur. Les photographies d’illustration proviennent d’Unsplash et sont utilisées selon la licence Unsplash. Les fonds de carte sont fournis par les contributeurs d’OpenStreetMap (licence ODbL). Le géocodage des adresses utilise le service public de la Géoplateforme (IGN).</p>
      <p>Les contenus publiés par les utilisateurs (annonces, photos, avis, messages) restent la propriété de leurs auteurs, qui accordent à Shareat le droit de les afficher sur le site pour les besoins du service.</p>

      <h2>Signaler un contenu</h2>
      <p>Pour signaler un contenu illicite ou une annonce trompeuse, écrivez à <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a> en précisant l’adresse de la page concernée et la raison du signalement. Les signalements sont traités dans les meilleurs délais.</p>

      <h2>Données personnelles</h2>
      <p>Le traitement de vos données est décrit dans la <a href="/confidentialite">politique de confidentialité</a>.</p>
    </LegalPage>
  )
}
