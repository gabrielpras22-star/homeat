import { admin, handle, requireUser, stripe } from '@/lib/server/clients'
import { BOOKING_COLS, cancelBooking, fulfillCheckoutSession, type BookingRow } from '@/lib/server/bookings'

/**
 * Filet de sécurité appelé à chaque visite d'un invité connecté : finalise les paiements
 * aboutis dont le retour sur le site n'a pas eu lieu (fenêtre fermée), et nettoie les
 * réservations en attente dont la page de paiement a expiré.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { data } = await admin().from('bookings')
      .select(BOOKING_COLS)
      .eq('guest_id', user.id).eq('status', 'pending').not('stripe_checkout_session_id', 'is', null)
    let confirmed = 0
    for (const b of (data || []) as BookingRow[]) {
      const session = await stripe().checkout.sessions.retrieve(b.stripe_checkout_session_id!)
      if (session.payment_status === 'paid') {
        const r = await fulfillCheckoutSession(session)
        if (r.status === 'confirmed') confirmed++
      } else if (session.status === 'expired') {
        await cancelBooking(b)
      }
    }
    return { confirmed }
  })
}
