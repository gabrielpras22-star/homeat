import Link from 'next/link'

/** Pied de page commun : liens rangés par thème, pour se repérer facilement. */
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid glass">
        <div>
          <span className="logo logo-static" style={{ textAlign: 'left', margin: 0 }}>Shareat</span>
          <p>Des repas faits maison, chez des habitants, partagés avec des personnes qui deviennent des amis le temps d’une soirée.</p>
        </div>
        <div>
          <h4>Découvrir</h4>
          <Link href="/?vue=explorer">Trouver un repas</Link>
          <Link href="/?vue=carte">Voir la carte</Link>
          <Link href="/le-concept">Le concept</Link>
          <Link href="/comment-ca-marche">Comment ça marche</Link>
        </div>
        <div>
          <h4>Mon compte</h4>
          <Link href="/inscription">Créer un compte</Link>
          <Link href="/connexion">Connexion</Link>
          <Link href="/mon-compte">Espace invité</Link>
          <Link href="/espace-hote">Espace hôte</Link>
          <Link href="/devenir-hote">Devenir hôte</Link>
        </div>
        <div>
          <h4>Aide et confiance</h4>
          <Link href="/aide">Centre d’aide</Link>
          <Link href="/aide#contact">Nous écrire</Link>
          <Link href="/confiance-securite">Confiance et sécurité</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
        </div>
      </div>
      <span className="muted small">© 2026 Shareat · Paiements sécurisés par Stripe · Photos : Unsplash · Carte : OpenStreetMap</span>
    </footer>
  )
}
