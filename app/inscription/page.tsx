import type { Metadata } from 'next'
import { Suspense } from 'react'
import PageShell from '../components/site/PageShell'
import SignupForm from './SignupForm'

export const metadata: Metadata = {
  title: 'Créer un compte · Shareat',
  description: 'Créez votre compte Shareat pour réserver un repas ou recevoir des invités.',
}

export default function Inscription() {
  return (
    <PageShell>
      <div className="auth-wrap">
        <Suspense fallback={<div className="auth-card glass">Chargement…</div>}>
          <SignupForm />
        </Suspense>
      </div>
    </PageShell>
  )
}
