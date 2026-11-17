import { handle, HttpError, readJson, requireUser, stripe } from '@/lib/server/clients'
import { fulfillCheckoutSession } from '@/lib/server/bookings'

/** Appelé au retour de la page de paiement : vérifie le paiement auprès de Stripe et confirme la réservation. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { session_id } = await readJson<{ session_id: string }>(request)
    if (!session_id || !/^cs_[A-Za-z0-9_]+$/.test(session_id)) throw new HttpError(400, 'Paiement introuvable.')
    const session = await stripe().checkout.sessions.retrieve(session_id)
    if (session.customer_email && user.email && session.customer_email.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpError(403, 'Ce paiement ne correspond pas à votre compte.')
    }
    const result = await fulfillCheckoutSession(session)
    if (result.booking.guest_id !== user.id) throw new HttpError(403, 'Ce paiement ne correspond pas à votre compte.')
    return { status: result.status, booking_id: result.booking.id, meal_id: result.booking.meal_id, seats: result.booking.seats }
  })
}
