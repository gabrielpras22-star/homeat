import { admin, handle, HttpError, requireUser, stripe } from '@/lib/server/clients'

/** Lien de connexion à l'espace Stripe Express de l'hôte (soldes et virements). */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { data: row } = await admin().from('host_payouts').select('stripe_account_id').eq('host_id', user.id).maybeSingle()
    if (!row) throw new HttpError(404, 'Configurez d’abord vos versements.')
    const link = await stripe().accounts.createLoginLink(row.stripe_account_id)
    return { url: link.url }
  })
}
