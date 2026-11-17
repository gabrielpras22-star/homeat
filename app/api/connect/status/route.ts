import { admin, handle, requireUser, stripe } from '@/lib/server/clients'

/** Interroge Stripe pour savoir si l'hôte peut recevoir des versements, et met la base à jour. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const db = admin()
    const { data: row } = await db.from('host_payouts').select('stripe_account_id').eq('host_id', user.id).maybeSingle()
    if (!row) return { configured: false, active: false }

    const account = await stripe().v2.core.accounts.retrieve(row.stripe_account_id, { include: ['configuration.recipient', 'requirements'] })
    const status = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status
    const active = status === 'active'
    await db.from('host_payouts').update({ transfers_active: active, updated_at: new Date().toISOString() }).eq('host_id', user.id)
    return { configured: true, active, status: status ?? 'unknown' }
  })
}
