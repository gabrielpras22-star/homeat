import { admin, handle, HttpError, readJson, requireUser } from '@/lib/server/clients'
import { cancelBooking, getBooking } from '@/lib/server/bookings'
import { FREE_CANCELLATION_HOURS, parisDateTime } from '@/lib/shared'

/** Annulation par l'invité : gratuite (remboursement intégral) jusqu'à 48 h avant le repas. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { booking_id } = await readJson<{ booking_id: string }>(request)
    if (!booking_id) throw new HttpError(400, 'Réservation introuvable.')
    const booking = await getBooking(booking_id)
    if (!booking || booking.guest_id !== user.id) throw new HttpError(404, 'Réservation introuvable.')
    if (booking.status === 'cancelled') return { status: 'cancelled', refunded: 0 }
    if (booking.status === 'completed') throw new HttpError(400, 'Ce repas a déjà eu lieu.')

    if (booking.status === 'confirmed') {
      const { data: meal } = await admin().from('meals').select('date, time').eq('id', booking.meal_id).maybeSingle()
      if (!meal) throw new HttpError(404, 'Repas introuvable.')
      const hoursLeft = (parisDateTime(meal.date, meal.time).getTime() - Date.now()) / 3_600_000
      if (hoursLeft < FREE_CANCELLATION_HOURS) {
        throw new HttpError(400, `L’annulation en ligne n’est possible que jusqu’à ${FREE_CANCELLATION_HOURS} h avant le repas. Écrivez à votre hôte.`)
      }
    }
    const { refunded } = await cancelBooking(booking)
    return { status: 'cancelled', refunded }
  })
}
