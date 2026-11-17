import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageShell from '../components/site/PageShell'
import GuestSpace from './GuestSpace'

export const metadata: Metadata = {
  title: 'Mon espace · Shareat',
  description: 'Vos réservations, vos avis, vos favoris, vos messages et la sécurité de votre compte.',
}

export default function MonCompte() {
  return (
    <PageShell>
      <Suspense fallback={<div className="section">Chargement…</div>}>
        <GuestSpace />
      </Suspense>
    </PageShell>
  )
}
