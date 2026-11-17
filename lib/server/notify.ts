import 'server-only'
import { admin } from './clients'
import { emailLayout, esc, sendEmail, siteUrl, userEmail } from './email'

type MealInfo = { id: string; title: string; date: string; time: string | null; city: string; host_id: string; hostName: string; address: string | null }

const eur = (n: number) => {
  const v = Math.round((Number(n) || 0) * 100) / 100
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace('.', ',')) + ' €'
}
const when = (m: MealInfo) => {
  const [y, mo, d] = m.date.slice(0, 10).split('-').map(Number)
  const day = new Date(Date.UTC(y, mo - 1, d, 12)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return m.time ? `${day} à ${m.time.slice(0, 5).replace(':', 'h')}` : day
}

async function mealInfo(mealId: string): Promise<MealInfo | null> {
  const db = admin()
  const { data: meal } = await db.from('meals').select('id, title, date, time, city, host_id').eq('id', mealId).maybeSingle()
  if (!meal) return null
  const [{ data: host }, { data: priv }] = await Promise.all([
    db.from('profiles').select('full_name').eq('id', meal.host_id).maybeSingle(),
    db.from('meal_private').select('address').eq('meal_id', mealId).maybeSingle(),
  ])
  return { ...meal, hostName: host?.full_name || 'votre hôte', address: priv?.address ?? null } as MealInfo
}

async function name(userId: string) {
  const { data } = await admin().from('profiles').select('full_name').eq('id', userId).maybeSingle()
  return data?.full_name || 'Un invité'
}

/** Les notifications ne doivent jamais faire échouer l'action principale. */
async function safe(fn: () => Promise<unknown>) {
  try { await fn() } catch (e) { console.error('Notification', e) }
}

export const notifyBookingConfirmed = (b: { meal_id: string; guest_id: string; seats: number; total_amount: number }) => safe(async () => {
  const m = await mealInfo(b.meal_id)
  if (!m) return
  const guestName = await name(b.guest_id)
  await sendEmail(await userEmail(b.guest_id), `Réservation confirmée : ${m.title}`, emailLayout('À table !', [
    `Votre place chez <strong>${esc(m.hostName)}</strong> est réservée pour <strong>${b.seats} couvert${b.seats > 1 ? 's' : ''}</strong>, ${esc(when(m))}.`,
    m.address ? `Adresse : <strong>${esc(m.address)}</strong>` : `Ville : ${esc(m.city)}`,
    `Montant payé : ${eur(b.total_amount)}. Annulation gratuite jusqu’à 48 h avant le repas depuis votre espace.`,
  ], { label: 'Voir ma réservation', url: siteUrl() }))
  await sendEmail(await userEmail(m.host_id), `Nouvelle réservation : ${m.title}`, emailLayout('Nouvelle réservation', [
    `<strong>${esc(guestName)}</strong> a réservé ${b.seats} place${b.seats > 1 ? 's' : ''} pour « ${esc(m.title)} », ${esc(when(m))}.`,
    'Vous pouvez lui écrire depuis la messagerie Shareat. Votre part vous est virée 24 h après le repas.',
  ], { label: 'Ouvrir mon espace hôte', url: siteUrl() }))
})

export const notifyBookingCancelled = (b: { meal_id: string; guest_id: string; seats: number }, refunded: number, byHost: boolean) => safe(async () => {
  const m = await mealInfo(b.meal_id)
  if (!m) return
  await sendEmail(await userEmail(b.guest_id), `Réservation annulée : ${m.title}`, emailLayout('Réservation annulée', [
    byHost
      ? `${esc(m.hostName)} a dû annuler « ${esc(m.title)} » prévu ${esc(when(m))}. Nous en sommes désolés.`
      : `Votre réservation pour « ${esc(m.title)} », ${esc(when(m))}, est annulée.`,
    refunded > 0 ? `Vous êtes remboursé de <strong>${eur(refunded)}</strong> sur votre moyen de paiement, sous 5 à 10 jours selon votre banque.` : 'Aucun montant n’avait été prélevé.',
  ], { label: 'Trouver une autre table', url: siteUrl() }))
  if (!byHost) {
    const guestName = await name(b.guest_id)
    await sendEmail(await userEmail(m.host_id), `Annulation : ${m.title}`, emailLayout('Une réservation a été annulée', [
      `${esc(guestName)} a annulé ${b.seats} place${b.seats > 1 ? 's' : ''} pour « ${esc(m.title)} », ${esc(when(m))}. Les places sont de nouveau disponibles.`,
    ]))
  }
})

export const notifyReminder = (b: { meal_id: string; guest_id: string; seats: number }) => safe(async () => {
  const m = await mealInfo(b.meal_id)
  if (!m) return
  await sendEmail(await userEmail(b.guest_id), `C’est demain : ${m.title}`, emailLayout('Rappel : votre repas, c’est demain', [
    `Rendez-vous chez <strong>${esc(m.hostName)}</strong> ${esc(when(m))} pour ${b.seats} couvert${b.seats > 1 ? 's' : ''}.`,
    m.address ? `Adresse : <strong>${esc(m.address)}</strong>` : `Ville : ${esc(m.city)}`,
    'Un empêchement ? Prévenez votre hôte par la messagerie.',
  ], { label: 'Écrire à mon hôte', url: siteUrl() }))
})

export const notifyTransfer = (hostId: string, mealTitle: string, amount: number) => safe(async () => {
  await sendEmail(await userEmail(hostId), `Virement en route : ${mealTitle}`, emailLayout('Votre virement est en route', [
    `Votre part pour « ${esc(mealTitle)} » (<strong>${eur(amount)}</strong>) a été envoyée sur votre compte de versement.`,
    'Elle arrive sur votre compte bancaire selon le calendrier de versement Stripe, en général sous quelques jours.',
  ], { label: 'Voir mes versements', url: siteUrl() }))
})

export const notifyMessage = (senderId: string, receiverId: string, preview: string) => safe(async () => {
  const sender = await name(senderId)
  const short = preview.length > 160 ? preview.slice(0, 157) + '…' : preview
  await sendEmail(await userEmail(receiverId), `Nouveau message de ${sender}`, emailLayout(`${sender} vous a écrit`, [
    `« ${esc(short)} »`,
  ], { label: 'Répondre', url: siteUrl() }))
})
