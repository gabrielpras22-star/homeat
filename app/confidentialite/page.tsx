import type { Metadata } from 'next'
import LegalPage from '../components/LegalPage'
import { PUBLISHER, PROVIDERS } from '@/lib/legal'

export const metadata: Metadata = { title: 'Politique de confidentialité — Shareat' }

export default function Confidentialite() {
  const mail = <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Cette politique explique quelles données personnelles Shareat collecte, pourquoi, combien de temps elles sont conservées et comment exercer vos droits, conformément au Règlement général sur la protection des données (RGPD) et à la loi Informatique et Libertés.</p>

      <h2>Responsable du traitement</h2>
      <p>{PUBLISHER.name}, {PUBLISHER.address}. Contact pour toute question sur vos données : {mail}.</p>

      <h2>Données collectées et finalités</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Données</th><th>Pourquoi</th><th>Base légale</th></tr></thead>
          <tbody>
            <tr><td>Nom, email, mot de passe (chiffré)</td><td>Créer et sécuriser votre compte</td><td>Exécution du contrat</td></tr>
            <tr><td>Ville, présentation (facultatives)</td><td>Présenter votre profil aux autres membres</td><td>Exécution du contrat</td></tr>
            <tr><td>Annonces : titre, menu, prix, date, catégories, allergènes, photo</td><td>Publier vos tables</td><td>Exécution du contrat</td></tr>
            <tr><td>Adresse email</td><td>Emails de service : confirmation et rappel de réservation, annulation, virement, nouveau message</td><td>Exécution du contrat</td></tr>
            <tr><td>Adresse du repas</td><td>La communiquer aux invités ayant réservé ; seule une zone d’environ 1 km est publique</td><td>Exécution du contrat</td></tr>
            <tr><td>Réservations et montants</td><td>Gérer les réservations, annulations et remboursements</td><td>Exécution du contrat ; obligations comptables</td></tr>
            <tr><td>Messages entre membres</td><td>Permettre les échanges avant et après le repas</td><td>Exécution du contrat</td></tr>
            <tr><td>Avis et notes</td><td>Informer les futurs invités</td><td>Intérêt légitime</td></tr>
            <tr><td>Données des hôtes nécessaires aux versements (identité, IBAN)</td><td>Verser les gains des hôtes ; vérifications anti-fraude et anti-blanchiment</td><td>Obligation légale ; exécution du contrat</td></tr>
            <tr><td>Revenus des hôtes</td><td>Déclarations fiscales obligatoires des plateformes (article 1649 ter A du CGI, directive DAC7)</td><td>Obligation légale</td></tr>
          </tbody>
        </table>
      </div>
      <p>Les données bancaires (numéro de carte, IBAN) sont collectées directement par Stripe, qui agit pour ces données en tant que responsable de traitement indépendant. Shareat n’y a pas accès.</p>

      <h2>Destinataires et sous-traitants</h2>
      <ul>
        <li><strong>Supabase</strong> (base de données, authentification et stockage des photos) : {PROVIDERS.database}.</li>
        <li><strong>Resend</strong> (envoi des emails de service) : Resend, Inc., 2261 Market Street #5039, San Francisco, CA 94114, États-Unis.</li>
        <li><strong>Vercel</strong> (hébergement du site) : {PROVIDERS.hosting}.</li>
        <li><strong>Stripe</strong> (paiements et versements) : {PROVIDERS.payments}.</li>
        <li><strong>OpenStreetMap</strong> (fonds de carte) et <strong>Unsplash</strong> (photos d’illustration) : votre navigateur charge des images depuis leurs serveurs, qui reçoivent à cette occasion votre adresse IP.</li>
        <li><strong>Géoplateforme (IGN)</strong> : l’adresse saisie par un hôte est envoyée à ce service public pour la localiser.</li>
        <li>Les autres membres voient uniquement les informations de profil publiques (nom, ville, présentation, note) ; l’adresse d’un repas n’est visible que par les invités ayant réservé.</li>
        <li>L’administration fiscale, lorsque la loi l’impose.</li>
      </ul>
      <p>Certains prestataires sont établis hors de l’Union européenne (États-Unis, Singapour). Ces transferts sont encadrés par les clauses contractuelles types de la Commission européenne et, pour les entreprises américaines certifiées, par le cadre de protection des données UE–États-Unis.</p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Compte et profil : tant que le compte est actif, puis supprimés 3 ans après la dernière activité.</li>
        <li>Messages et annonces : jusqu’à la suppression du compte.</li>
        <li>Réservations et données de facturation : 10 ans (obligation comptable, article L123-22 du Code de commerce).</li>
        <li>Données fiscales des hôtes : 10 ans.</li>
      </ul>

      <h2>Cookies et stockage local</h2>
      <p>Shareat n’utilise ni cookie publicitaire ni outil de mesure d’audience. Votre session de connexion est conservée dans le stockage local de votre navigateur, ce qui est strictement nécessaire au service et ne demande pas de consentement. Lors du paiement, Stripe dépose sur ses propres pages des cookies nécessaires à la sécurité et à la lutte contre la fraude.</p>

      <h2>Vos droits</h2>
      <p>Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité et d’opposition, ainsi que du droit de définir des directives sur le sort de vos données après votre décès. Vous pouvez modifier votre profil à tout moment depuis votre espace. Pour exercer vos autres droits, notamment obtenir une copie de vos données ou supprimer votre compte, écrivez à {mail} depuis l’adresse liée à votre compte. Une réponse vous est apportée sous un mois.</p>
      <p>Les données que la loi impose de conserver (réservations, données fiscales) sont conservées pendant la durée légale même après la suppression du compte, puis effacées.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener">cnil.fr</a>).</p>

      <h2>Mineurs</h2>
      <p>Le service est réservé aux personnes âgées de 18 ans ou plus.</p>

      <h2>Sécurité</h2>
      <p>Les échanges sont chiffrés (HTTPS), les mots de passe sont stockés sous forme chiffrée et l’accès aux données est limité par des règles strictes en base de données. Les paiements sont traités par Stripe, certifié PCI-DSS niveau 1.</p>
    </LegalPage>
  )
}
