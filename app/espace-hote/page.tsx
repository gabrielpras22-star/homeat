import type { Metadata } from 'next'
import PageShell from '../components/site/PageShell'
import HostSpace from './HostSpace'

export const metadata: Metadata = {
  title: 'Espace hôte · Shareat',
  description: 'Gérez vos repas, vos photos, votre visibilité, vos invités et vos avis.',
}

export default function EspaceHote() {
  return (
    <PageShell>
      <HostSpace />
    </PageShell>
  )
}
