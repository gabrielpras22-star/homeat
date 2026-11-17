import 'server-only'
import type Stripe from 'stripe'
import { admin, stripe, HttpError } from './clients'

export type BookingRow = {
  id: string
  meal_id: string
  guest_id: string
  seats: number
  total_amount: number
  status: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
}

const BOOKING_COLS = 'id, meal_id, guest_id, seats, total_amount, status, stripe_checkout_session_id, stripe_payment_intent_id'

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data } = await admin().from('bookings').select(BOOKING_COLS).eq('id', id).maybeSingle()
  return (data as BookingRow | null) ?? null
}

/** Rembourse intégralement un paiement : l'hôte rend sa part, Shareat rend sa commission. */
async function refundPayment(paymentIntentId: string): Promise<number> {
  const refund = await stripe().refunds.create({
    payment_intent: paymentIntentId,
    reverse_transfer: true,
    refund_application_fee: true,
  })
  return refund.amount / 100
}

/**
 * Confirme la réservation liée à une session Checkout payée.
 * Idempotent : peut être appelé au retour du paiement ET par le webhook.
 */
export async function fulfillCheckoutSession(sessionOrId: string | Stripe.Checkout.Session) {
  const session = typeof sessionOrId === 'string'
    ? await stripe().checkout.sessions.retrieve(sessionOrId)
    : sessionOrId
  const bookingId = session.metadata?.booking_id
  if (!bookingId) throw new HttpError(404, 'Réservation introuvable pour ce paiement.')
  const booking = await getBooking(bookingId)
  if (!booking) throw new HttpError(404, 'Réservation introuvable.')
  if (booking.status === 'confirmed' || booking.status === 'completed') return { status: 'confirmed' as const, booking }
  if (session.payment_status !== 'paid') return { status: 'unpaid' as const, booking }

  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  // Paiement reçu pour une réservation déjà annulée (ancienne page de paiement) : on rembourse.
  if (booking.status === 'cancelled') {
    const { data: row } = await admin().from('bookings').select('refunded_amount').eq('id', booking.id).maybeSingle()
    if (!row?.refunded_amount && paymentIntentId) {
      const refunded = await refundPayment(paymentIntentId)
      await admin().from('bookings').update({ refunded_amount: refunded, stripe_payment_intent_id: paymentIntentId, stripe_payment_status: 'refunded' }).eq('id', booking.id)
    }
    return { status: 'refunded' as const, booking }
  }

  // Le passage pending → confirmed décompte les places (trigger) et échoue s'il n'en reste plus.
  const { data: updated, error } = await admin()
    .from('bookings')
    .update({ status: 'confirmed', stripe_payment_intent_id: paymentIntentId, stripe_payment_status: 'paid' })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .select(BOOKING_COLS)
    .maybeSingle()

  if (error) {
    // Plus de place (quelqu'un a payé juste avant) : remboursement automatique.
    const refunded = paymentIntentId ? await refundPayment(paymentIntentId) : 0
    await admin().from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), refunded_amount: refunded, stripe_payment_intent_id: paymentIntentId, stripe_payment_status: 'refunded' })
      .eq('id', booking.id)
    return { status: 'refunded' as const, booking }
  }
  if (!updated) {
    // Déjà traité en parallèle (retour navigateur + webhook).
    const fresh = await getBooking(booking.id)
    return { status: fresh?.status === 'confirmed' ? 'confirmed' as const : 'unpaid' as const, booking: fresh ?? booking }
  }
  return { status: 'confirmed' as const, booking: updated as BookingRow }
}

/** Annule une réservation. Si elle était payée, la rembourse intégralement. */
export async function cancelBooking(booking: BookingRow) {
  if (booking.status === 'cancelled') return { refunded: 0 }
  let refunded = 0
  if (booking.status === 'confirmed' && booking.stripe_payment_intent_id) {
    refunded = await refundPayment(booking.stripe_payment_intent_id)
  }
  if (booking.status === 'pending' && booking.stripe_checkout_session_id) {
    // Empêche de payer une session devenue inutile.
    try {
      const s = await stripe().checkout.sessions.retrieve(booking.stripe_checkout_session_id)
      if (s.status === 'open') await stripe().checkout.sessions.expire(s.id)
    } catch {
      // La session a peut-être déjà expiré : rien à faire.
    }
  }
  // confirmed → cancelled rend les places (trigger).
  const { error } = await admin().from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), refunded_amount: refunded || null, stripe_payment_status: refunded ? 'refunded' : undefined })
    .eq('id', booking.id)
  if (error) throw new HttpError(500, 'Le remboursement est parti mais la réservation n’a pas pu être mise à jour : ' + error.message)
  return { refunded }
}
