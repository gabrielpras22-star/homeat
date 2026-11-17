import { admin, handle, requireUser, siteOrigin, stripe } from '@/lib/server/clients'

/** Crée (si besoin) le compte de versement Stripe de l'hôte et renvoie le lien d'inscription Stripe. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const db = admin()
    const { data: existing } = await db.from('host_payouts').select('stripe_account_id').eq('host_id', user.id).maybeSingle()

    let accountId = existing?.stripe_account_id as string | undefined
    if (!accountId) {
      const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const account = await stripe().v2.core.accounts.create({
        contact_email: user.email,
        display_name: profile?.full_name || undefined,
        dashboard: 'express',
        identity: { country: 'fr', entity_type: 'individual' },
        configuration: {
          recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
        },
        defaults: {
          currency: 'eur',
          locales: ['fr-FR'],
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
        metadata: { shareat_user_id: user.id },
      })
      accountId = account.id
      const { error } = await db.from('host_payouts').insert({ host_id: user.id, stripe_account_id: accountId, transfers_active: false })
      if (error) throw new Error('Enregistrement du compte de versement impossible : ' + error.message)
    }

    const origin = siteOrigin(request)
    const link = await stripe().v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: `${origin}/?versements=relancer`,
          return_url: `${origin}/?versements=retour`,
        },
      },
    })
    return { url: link.url }
  })
}
