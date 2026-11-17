import 'server-only'
import type Stripe from 'stripe'
import { admin, stripe, HttpError } from './clients'
import { notifyBookingConfirmed } from './notify'

export type BookingRow = {
  id: string
  meal_id: string
  guest_id: string
  seats: number
  total_amount: number
  host_amount: number | null
  status: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  stripe_transfer_id: string | null
}

export const BOOKING_COLS = 'id, meal_id, guest_id, seats, total_amount, host_amount, status, stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id, stripe_transfer_id'

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data } = await admin().from('bookings').select(BOOKING_COLS).eq('id', id).maybeSingle()
  return (data as BookingRow | null) ?? null
}

/**
 * Rembourse intégralement un paiement. Le paiement est encaissé par Shareat et
 * l'hôte n'est payé qu'après le repas : si le virement à l'hôte a déjà eu lieu,
 * on l'annule d'abord (cas exceptionnel).
 */
async function refundPayment(paymentIntentId: string, transferId?: string | null): Promise<number> {
  if (transferId) {
    await stripe().transfers.createReversal(transferId, {}, { idempotencyKey: `reversal-${transferId}` })
  }
  const refund = await stripe().refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `refund-${paymentIntentId}` })
  return refund.amount / 100
}

const ids = (session: Stripe.Checkout.Session) => {
  const pi = session.payment_intent
  const paymentIntentId = typeof pi === 'string' ? pi : pi?.id ?? null
  const charge = typeof pi === 'object' && pi ? pi.latest_charge : null
  const chargeId = typeof charge === 'string' ? charge : charge?.id ?? null
  return { paymentIntentId, chargeId }
}

/**
 * Confirme la réservation liée à une session Checkout payée.
 * Idempotent : peut être appelé au retour du paiement, par le webhook et par le rattrapage.
 */
export async function fulfillCheckoutSession(sessionOrId: string | Stripe.Checkout.Session) {
  const id = typeof sessionOrId === 'string' ? sessionOrId : sessionOrId.id
  // On relit toujours la session avec le paiement détaillé (identifiant du prélèvement).
  const session = await stripe().checkout.sessions.retrieve(id, { expand: ['payment_intent'] })
  const bookingId = session.metadata?.booking_id
  if (!bookingId) throw new HttpError(404, 'Réservation introuvable pour ce paiement.')
  const booking = await getBooking(bookingId)
  if (!booking) throw new HttpError(404, 'Réservation introuvable.')
  if (booking.status === 'confirmed' || booking.status === 'completed') return { status: 'confirmed' as const, booking }
  if (session.payment_status !== 'paid') return { status: 'unpaid' as const, booking }

  const { paymentIntentId, chargeId } = ids(session)

  // Paiement reçu pour une réservation déjà annulée (ancienne page de paiement) : on rembourse.
  if (booking.status === 'cancelled') {
    const { data: row } = await admin().from('bookings').select('refunded_amount').eq('id', booking.id).maybeSingle()
    if (!row?.refunded_amount && paymentIntentId) {
      const refunded = await refundPayment(paymentIntentId)
      await admin().from('bookings').update({ refunded_amount: refunded, stripe_payment_intent_id: paymentIntentId, stripe_charge_id: chargeId, stripe_payment_status: 'refunded' }).eq('id', booking.id)
    }
    return { status: 'refunded' as const, booking }
  }

  // Le passage pending → confirmed décompte les places (trigger) et échoue s'il n'en reste plus.
  const { data: updated, error } = await admin()
    .from('bookings')
    .update({ status: 'confirmed', stripe_payment_intent_id: paymentIntentId, stripe_charge_id: chargeId, stripe_payment_status: 'paid' })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .select(BOOKING_COLS)
    .maybeSingle()

  if (error) {
    // Plus de place (quelqu'un a payé juste avant) : remboursement automatique.
    const refunded = paymentIntentId ? await refundPayment(paymentIntentId) : 0
    await admin().from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), refunded_amount: refunded, stripe_payment_intent_id: paymentIntentId, stripe_charge_id: chargeId, stripe_payment_status: 'refunded' })
      .eq('id', booking.id)
    return { status: 'refunded' as const, booking }
  }
  if (!updated) {
    // Déjà traité en parallèle (retour navigateur + webhook).
    const fresh = await getBooking(booking.id)
    return { status: fresh?.status === 'confirmed' ? 'confirmed' as const : 'unpaid' as const, booking: fresh ?? booking }
  }
  // Seul l'appel qui a effectivement confirmé envoie les emails.
  await notifyBookingConfirmed(updated as BookingRow)
  return { status: 'confirmed' as const, booking: updated as BookingRow }
}

/** Annule une réservation. Si elle était payée, la rembourse intégralement. */
export async function cancelBooking(booking: BookingRow) {
  if (booking.status === 'cancelled') return { refunded: 0 }
  let refunded = 0
  if ((booking.status === 'confirmed' || booking.status === 'completed') && booking.stripe_payment_intent_id) {
    refunded = await refundPayment(booking.stripe_payment_intent_id, booking.stripe_transfer_id)
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

/**
 * Vire à l'hôte sa part d'une réservation dont le repas a eu lieu.
 * Idempotent grâce à la clé d'idempotence Stripe et au contrôle du statut.
 */
export async function transferToHost(booking: BookingRow): Promise<{ transferred: number } | { skipped: string }> {
  if (booking.status !== 'confirmed' || booking.stripe_transfer_id) return { skipped: 'déjà traité' }
  const db = admin()
  const { data: meal } = await db.from('meals').select('host_id, title').eq('id', booking.meal_id).maybeSingle()
  if (!meal) return { skipped: 'repas introuvable' }
  const { data: payout } = await db.from('host_payouts').select('stripe_account_id, transfers_active').eq('host_id', meal.host_id).maybeSingle()
  if (!payout?.transfers_active) return { skipped: 'versements de l’hôte inactifs' }

  let chargeId = booking.stripe_charge_id
  if (!chargeId && booking.stripe_payment_intent_id) {
    const pi = await stripe().paymentIntents.retrieve(booking.stripe_payment_intent_id)
    chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null
  }
  if (!chargeId) return { skipped: 'paiement introuvable' }

  const amount = Math.round(Number(booking.host_amount) * 100)
  if (!(amount > 0)) return { skipped: 'montant hôte inconnu' }
  const transfer = await stripe().transfers.create({
    amount,
    currency: 'eur',
    destination: payout.stripe_account_id,
    source_transaction: chargeId,
    transfer_group: booking.id,
    description: `Shareat : ${meal.title}`,
    metadata: { booking_id: booking.id },
  }, { idempotencyKey: `transfer-${booking.id}` })

  await db.from('bookings').update({
    status: 'completed',
    stripe_transfer_id: transfer.id,
    stripe_charge_id: chargeId,
    transferred_at: new Date().toISOString(),
  }).eq('id', booking.id).eq('status', 'confirmed')
  return { transferred: amount / 100 }
}
