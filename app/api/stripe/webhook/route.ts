import type Stripe from 'stripe'
import { admin, stripe } from '@/lib/server/clients'
import { fulfillCheckoutSession } from '@/lib/server/bookings'

/**
 * Webhook Stripe (facultatif mais recommandé) : confirme la réservation même si
 * l'invité ferme la page avant d'y revenir. Nécessite STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook non configuré', { status: 503 })

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(payload, request.headers.get('stripe-signature') || '', secret)
  } catch {
    return new Response('Signature invalide', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await fulfillCheckoutSession(event.data.object as Stripe.Checkout.Session)
    } else if (event.type === 'checkout.session.expired') {
      const bookingId = (event.data.object as Stripe.Checkout.Session).metadata?.booking_id
      if (bookingId) {
        await admin().from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', bookingId).eq('status', 'pending')
      }
    }
  } catch (e) {
    console.error('Webhook Stripe', event.type, e)
    return new Response('Erreur de traitement', { status: 500 })
  }
  return new Response('ok')
}
