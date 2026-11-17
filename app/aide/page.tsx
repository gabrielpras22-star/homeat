import type { Metadata } from 'next'
import PageShell from '../components/site/PageShell'
import HelpCenter from './HelpCenter'

export const metadata: Metadata = {
  title: 'Centre d’aide · Shareat',
  description: 'Réponses aux questions fréquentes, contact, signalement et suivi de vos demandes.',
}

export default function Aide() {
  return (
    <PageShell
      crumb="Aide"
      eyebrow="Centre d’aide"
      title={<>Comment pouvons-nous <span className="accent">vous aider</span> ?</>}
      lead="Cherchez votre question ci-dessous. Si vous ne trouvez pas, écrivez-nous : une vraie personne vous répond."
    >
      <HelpCenter />
    </PageShell>
  )
}
