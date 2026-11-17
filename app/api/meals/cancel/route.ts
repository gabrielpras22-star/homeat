import { admin, handle, HttpError, readJson, requireUser } from '@/lib/server/clients'
import { BOOKING_COLS, cancelBooking, type BookingRow } from '@/lib/server/bookings'
import { notifyBookingCancelled } from '@/lib/server/notify'

/** Annulation d'une table par son hôte : tous les invités sont remboursés intégralement. */
export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser(request)
    const { meal_id } = await readJson<{ meal_id: string }>(request)
    if (!meal_id) throw new HttpError(400, 'Table introuvable.')
    const db = admin()
    const { data: meal } = await db.from('meals').select('id, host_id, is_active').eq('id', meal_id).maybeSingle()
    if (!meal || meal.host_id !== user.id) throw new HttpError(404, 'Table introuvable.')

    // On retire d'abord la table pour bloquer toute nouvelle réservation.
    await db.from('meals').update({ is_active: false }).eq('id', meal.id)

    const { data: bookings } = await db.from('bookings')
      .select(BOOKING_COLS)
      .eq('meal_id', meal.id).in('status', ['pending', 'confirmed'])
    let refundedGuests = 0
    const failures: string[] = []
    for (const b of (bookings || []) as BookingRow[]) {
      try {
        const { refunded } = await cancelBooking(b)
        if (refunded > 0) refundedGuests++
        if (b.status === 'confirmed') await notifyBookingCancelled(b, refunded, true)
      } catch (e) {
        failures.push(b.id)
        console.error('Remboursement impossible', b.id, e)
      }
    }
    if (failures.length) throw new HttpError(502, `Table retirée, mais ${failures.length} remboursement(s) ont échoué. Contactez le support Shareat.`)
    return { cancelled: true, refunded_guests: refundedGuests }
  })
}
