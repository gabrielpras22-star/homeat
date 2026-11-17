import type { Metadata } from 'next'
import LegalPage from '../components/LegalPage'
import { PUBLISHER } from '@/lib/legal'
import { COMMISSION_RATE, FREE_CANCELLATION_HOURS, STUDENT_MAX_PRICE, TRANSFER_DELAY_HOURS } from '@/lib/shared'

export const metadata: Metadata = { title: 'Conditions d’utilisation et de vente — Shareat' }

export default function Conditions() {
  const pct = `${Math.round(COMMISSION_RATE * 100)} %`
  const mail = <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>
  return (
    <LegalPage title="Conditions générales d’utilisation et de vente">
      <h2>1. Objet</h2>
      <p>Shareat est une plateforme en ligne qui met en relation des particuliers proposant de partager un repas chez eux (les « hôtes ») et des personnes souhaitant y participer (les « invités »). Les présentes conditions encadrent l’utilisation du site et les réservations. Elles sont acceptées lors de la création d’un compte.</p>
      <p>Shareat est éditée par {PUBLISHER.name} (voir les <a href="/mentions-legales">mentions légales</a>). Shareat agit en tant qu’intermédiaire : le repas est fourni par l’hôte, qui en est seul responsable.</p>

      <h2>2. Compte</h2>
      <p>L’inscription est réservée aux personnes âgées de 18 ans ou plus. Les informations fournies doivent être exactes. Chacun est responsable de la confidentialité de son mot de passe et de l’activité de son compte. Shareat peut suspendre un compte en cas de manquement aux présentes conditions, de fraude ou de comportement dangereux, après en avoir informé l’utilisateur sauf urgence.</p>

      <h2>3. Informations sur le fonctionnement de la plateforme</h2>
      <ul>
        <li><strong>Classement</strong> : les tables sont affichées par date du repas, de la plus proche à la plus lointaine. Aucun hôte ne paie pour être mieux placé.</li>
        <li><strong>Statut des hôtes</strong> : les hôtes sont des particuliers, sauf mention contraire. Les règles protectrices du droit de la consommation s’appliquent aux relations entre un professionnel et un consommateur, et non entre deux particuliers.</li>
        <li><strong>Rémunération de Shareat</strong> : une commission de {pct} du prix fixé par l’hôte, ajoutée au prix payé par l’invité. Shareat n’a pas de lien capitalistique avec les hôtes.</li>
        <li><strong>Avis</strong> : seuls les invités ayant réservé et payé un repas peuvent publier un avis sur celui-ci, après la date du repas. Les avis sont affichés du plus récent au plus ancien, ne sont ni rémunérés ni modifiés par Shareat, et peuvent être retirés s’ils sont illicites ou sans rapport avec le repas.</li>
      </ul>

      <h2>4. Obligations des hôtes</h2>
      <p>En publiant une table, l’hôte s’engage à :</p>
      <ul>
        <li>décrire honnêtement le repas, son prix, son lieu et ses catégories (« Halal », « Casher », « Végétarien », « Sans gluten »…), qui l’engagent ;</li>
        <li>déclarer, pour chaque table, les allergènes majeurs présents parmi les 14 listés par le règlement (UE) n° 1169/2011 (ou leur absence), et répondre aux questions des invités sur la composition des plats ;</li>
        <li>pour la catégorie « Repas étudiant », proposer un prix payé par l’invité de {STUDENT_MAX_PRICE} € maximum par couvert ;</li>
        <li>n’utiliser que des photos dont il détient les droits ;</li>
        <li>respecter les règles d’hygiène alimentaire et de sécurité, et accueillir les invités dans un logement adapté ;</li>
        <li>respecter la réglementation applicable à son activité, notamment son caractère occasionnel ; une activité régulière et lucrative peut nécessiter une déclaration ou une immatriculation ;</li>
        <li>vérifier que son assurance habitation couvre l’accueil de personnes à son domicile ;</li>
        <li>déclarer ses revenus. Les sommes perçues via Shareat peuvent être imposables et soumises à cotisations sociales : informations sur <a href="https://www.impots.gouv.fr" target="_blank" rel="noopener">impots.gouv.fr</a> et <a href="https://www.urssaf.fr" target="_blank" rel="noopener">urssaf.fr</a>. Conformément à l’article 242 bis du Code général des impôts, Shareat adresse chaque année aux hôtes un récapitulatif des sommes perçues et transmet ces informations à l’administration fiscale lorsque la loi l’impose.</li>
      </ul>
      <p>Pour recevoir ses gains, l’hôte ouvre un compte de versement auprès de Stripe et accepte les conditions de service de Stripe. La vérification d’identité est effectuée par Stripe. La part de l’hôte (son prix par couvert multiplié par le nombre de couverts réservés) lui est virée environ {TRANSFER_DELAY_HOURS} h après le repas, puis arrive sur son compte bancaire selon le calendrier de versement Stripe.</p>

      <h2>5. Obligations des invités</h2>
      <p>L’invité s’engage à se présenter à l’heure convenue, à respecter le domicile de l’hôte et les autres convives, et à signaler à l’avance ses allergies ou restrictions alimentaires.</p>

      <h2>6. Prix et paiement</h2>
      <p>Le prix affiché par couvert est le prix fixé par l’hôte augmenté de la commission Shareat de {pct}. Il est indiqué toutes taxes comprises, en euros. Le paiement s’effectue en ligne, en totalité, au moment de la réservation, par l’intermédiaire de Stripe. Shareat encaisse le paiement pour le compte de l’hôte et conserve sa commission ; la part de l’hôte lui est virée environ {TRANSFER_DELAY_HOURS} h après le repas, ce qui permet de rembourser les invités si le repas n’a pas lieu. La réservation est confirmée dès l’acceptation du paiement ; un email de confirmation, puis un rappel la veille du repas, sont envoyés à l’invité.</p>

      <h2>7. Absence de droit de rétractation</h2>
      <p>Conformément à l’article L221-28, 12° du Code de la consommation, le droit de rétractation ne s’applique pas aux prestations de restauration fournies à une date déterminée. Les conditions d’annulation ci-dessous s’appliquent à la place.</p>

      <h2>8. Annulation et remboursement</h2>
      <ul>
        <li><strong>Par l’invité, jusqu’à {FREE_CANCELLATION_HOURS} h avant le repas</strong> : annulation gratuite depuis l’espace « Réservations », remboursement intégral (commission comprise).</li>
        <li><strong>Par l’invité, moins de {FREE_CANCELLATION_HOURS} h avant le repas</strong> : la réservation reste due. L’invité peut contacter l’hôte, libre d’accepter un remboursement.</li>
        <li><strong>Par l’hôte</strong>, à tout moment : tous les invités sont remboursés intégralement et automatiquement, et prévenus par email.</li>
        <li><strong>Repas qui n’a pas eu lieu</strong> : l’invité le signale à {PUBLISHER.email} dans les {TRANSFER_DELAY_HOURS} h suivant l’heure prévue ; après vérification, il est remboursé.</li>
        <li><strong>Table complète pendant le paiement</strong> : si la dernière place est prise par un autre invité pendant le paiement, l’invité est remboursé intégralement et automatiquement.</li>
      </ul>
      <p>Les remboursements sont effectués sur le moyen de paiement utilisé, généralement sous 5 à 10 jours ouvrés selon la banque.</p>

      <h2>9. Responsabilité</h2>
      <p>Shareat met en relation hôtes et invités et sécurise le paiement. L’hôte est seul responsable du repas, de sa qualité, de sa conformité aux catégories annoncées et de l’accueil à son domicile. Shareat ne peut être tenue responsable des dommages résultant d’un repas, sauf faute de sa part. Shareat s’efforce d’assurer la disponibilité du site sans pouvoir la garantir.</p>

      <h2>10. Contenus et comportements interdits</h2>
      <p>Sont interdits : les annonces fictives ou trompeuses, la vente d’alcool en dehors du repas, tout contenu illicite, discriminatoire ou injurieux, et le contournement de la plateforme pour le paiement d’une réservation trouvée sur Shareat. Tout contenu peut être signalé à {mail}.</p>

      <h2>11. Données personnelles</h2>
      <p>Voir la <a href="/confidentialite">politique de confidentialité</a>.</p>

      <h2>12. Réclamations et litiges</h2>
      <p>Toute réclamation peut être adressée à {mail}. Une solution amiable est recherchée en priorité. Les présentes conditions sont soumises au droit français. Le consommateur peut saisir, à son choix, la juridiction de son domicile ou celle du lieu du repas.</p>

      <h2>13. Modification des conditions</h2>
      <p>Les conditions peuvent évoluer. Les utilisateurs sont informés de toute modification importante ; les réservations déjà payées restent régies par les conditions en vigueur au moment du paiement.</p>
    </LegalPage>
  )
}
