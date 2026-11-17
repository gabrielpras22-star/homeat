import { admin, handle, HttpError, readJson, requireUser, siteOrigin, stripe } from '@/lib/server/clients'
import { bookingAmounts, displayCents, todayParis } from '@/lib/shared'
import { cancelBooking, fulfillCheckoutSession, type BookingRow } from '@/lib/server/bookings'

/** Crée une réservation en attente et la page de paiement Stripe correspondante. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const body = await readJson<{ meal_id: string; seats: number }>(request)
    const seats = Number(body.seats)
    if (!body.meal_id || !Number.isInteger(seats) || seats < 1 || seats > 50) throw new HttpError(400, 'Demande de réservation invalide.')

    const db = admin()
    const { data: meal } = await db.from('meals')
      .select('id, host_id, title, price_per_seat, available_seats, date, time, city, is_active')
      .eq('id', body.meal_id).maybeSingle()
    if (!meal || !meal.is_active) throw new HttpError(404, 'Cette table n’est plus disponible.')
    if (meal.host_id === user.id) throw new HttpError(400, 'Vous ne pouvez pas réserver votre propre table.')
    if (String(meal.date).slice(0, 10) < todayParis()) throw new HttpError(400, 'Ce repas est déjà passé.')
    if (meal.available_seats < seats) {
      throw new HttpError(409, meal.available_seats > 0 ? `Il ne reste que ${meal.available_seats} place(s).` : 'Cette table est complète.')
    }

    const { data: payout } = await db.from('host_payouts').select('stripe_account_id, transfers_active').eq('host_id', meal.host_id).maybeSingle()
    if (!payout?.transfers_active) throw new HttpError(409, 'L’hôte n’a pas encore activé ses versements : la réservation est impossible pour le moment.')

    // Une seule réservation en attente par invité et par table : on ferme les anciennes pages de paiement.
    const { data: oldPending } = await db.from('bookings')
      .select('id, meal_id, guest_id, seats, total_amount, status, stripe_checkout_session_id, stripe_payment_intent_id')
      .eq('meal_id', meal.id).eq('guest_id', user.id).eq('status', 'pending')
    for (const old of (oldPending || []) as BookingRow[]) {
      if (old.stripe_checkout_session_id) {
        const s = await stripe().checkout.sessions.retrieve(old.stripe_checkout_session_id)
        if (s.payment_status === 'paid') {
          await fulfillCheckoutSession(s)
          throw new HttpError(409, 'Un paiement précédent pour cette table a déjà abouti : retrouvez-le dans vos réservations.')
        }
      }
      await cancelBooking(old)
    }

    const amounts = bookingAmounts(meal.price_per_seat, seats)
    const { data: booking, error } = await db.from('bookings').insert({
      meal_id: meal.id,
      guest_id: user.id,
      seats,
      total_amount: amounts.total / 100,
      host_amount: amounts.host / 100,
      platform_fee: amounts.fee / 100,
      status: 'pending',
    }).select('id').single()
    if (error || !booking) throw new Error('Création de la réservation impossible : ' + error?.message)

    const origin = siteOrigin(request)
    try {
      const session = await stripe().checkout.sessions.create({
        mode: 'payment',
        locale: 'fr',
        customer_email: user.email,
        client_reference_id: booking.id,
        line_items: [{
          quantity: seats,
          price_data: {
            currency: 'eur',
            unit_amount: displayCents(meal.price_per_seat),
            product_data: {
              name: meal.title,
              description: `Table d’hôte à ${meal.city}, le ${new Date(meal.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
            },
          },
        }],
        payment_intent_data: {
          application_fee_amount: amounts.fee,
          transfer_data: { destination: payout.stripe_account_id },
          metadata: { booking_id: booking.id, meal_id: meal.id },
        },
        metadata: { booking_id: booking.id, meal_id: meal.id },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        success_url: `${origin}/?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?paiement=annule&reservation=${booking.id}`,
      })
      await db.from('bookings').update({ stripe_checkout_session_id: session.id }).eq('id', booking.id)
      return { url: session.url }
    } catch (e) {
      await db.from('bookings').delete().eq('id', booking.id)
      throw e
    }
  })
}
