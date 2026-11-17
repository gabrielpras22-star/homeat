import { admin } from '@/lib/server/clients'
import { BOOKING_COLS, cancelBooking, transferToHost, type BookingRow } from '@/lib/server/bookings'
import { notifyReminder, notifyTransfer } from '@/lib/server/notify'
import { parisDateTime, todayParis, TRANSFER_DELAY_HOURS } from '@/lib/shared'

type Row = BookingRow & { created_at: string; reminder_sent_at: string | null; meals: { date: string; time: string | null; title: string; host_id: string } | null }

/**
 * Tâche quotidienne (Vercel Cron, voir vercel.json). Protégée par CRON_SECRET :
 * Vercel envoie automatiquement « Authorization: Bearer <CRON_SECRET> ».
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 })
  }

  const db = admin()
  const report = { transfers: 0, errors: 0, reminders: 0, expired: 0 }
  const { data } = await db.from('bookings')
    .select(`${BOOKING_COLS}, created_at, reminder_sent_at, meals(date, time, title, host_id)`)
    .in('status', ['confirmed', 'pending'])
  const rows = (data || []) as unknown as Row[]

  const now = Date.now()
  const tomorrow = new Date(parisDateTime(todayParis(), '12:00').getTime() + 864e5)
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

  for (const b of rows) {
    try {
      if (b.status === 'pending') {
        // Paiement abandonné depuis plus de 2 h : on ferme la page de paiement.
        if (now - new Date(b.created_at).getTime() > 2 * 3_600_000) { await cancelBooking(b); report.expired++ }
        continue
      }
      if (!b.meals) continue
      const start = parisDateTime(b.meals.date, b.meals.time).getTime()

      // 1. Virement à l'hôte, 24 h après le repas.
      if (now >= start + TRANSFER_DELAY_HOURS * 3_600_000) {
        const r = await transferToHost(b)
        if ('transferred' in r) { report.transfers++; await notifyTransfer(b.meals.host_id, b.meals.title, r.transferred) }
        else console.warn('Virement reporté', b.id, r.skipped)
        continue
      }

      // 2. Rappel la veille du repas.
      if (b.meals.date.slice(0, 10) === tomorrow && !b.reminder_sent_at) {
        await notifyReminder(b)
        await db.from('bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', b.id)
        report.reminders++
      }
    } catch (e) {
      report.errors++
      console.error('Tâche quotidienne', b.id, e)
    }
  }
  return Response.json(report)
}
