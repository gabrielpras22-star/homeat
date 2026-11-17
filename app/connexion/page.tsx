import type { Metadata } from 'next'
import PageShell from '../components/site/PageShell'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Connexion · Shareat',
  description: 'Connectez-vous à votre compte Shareat.',
}

export default function Connexion() {
  return (
    <PageShell>
      <div className="auth-wrap">
        <LoginForm />
      </div>
    </PageShell>
  )
}
