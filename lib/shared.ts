// Constantes et calculs partagés entre le navigateur et le serveur.

/** Commission Shareat : 10 % ajoutés au prix fixé par l'hôte. */
export const COMMISSION_RATE = 0.1

/** Annulation gratuite par l'invité jusqu'à 48 h avant le repas. */
export const FREE_CANCELLATION_HOURS = 48

export const CUISINES = ['Marocaine', 'Italienne', 'Japonaise', 'Mexicaine', 'Indienne', 'Française', 'Libanaise', 'Espagnole', 'Autre'] as const

/** Catégories de repas (doivent rester identiques à la contrainte meals_tags_allowed en base). */
export const CATEGORIES = [
  'Repas étudiant', 'Halal', 'Casher', 'Végétarien', 'Végan',
  'Sans gluten', 'Sans porc', 'Sans lactose', 'Enfants bienvenus', 'Atelier cuisine',
] as const

/** Prix de l'hôte en centimes. */
export const hostCents = (hostPrice: number) => Math.round((Number(hostPrice) || 0) * 100)

/** Prix affiché (prix hôte + 10 %) en centimes, arrondi au centime. */
export const displayCents = (hostPrice: number) => Math.round(hostCents(hostPrice) * (1 + COMMISSION_RATE))

/** Prix affiché par couvert, en euros. */
export const displayPrice = (hostPrice: number) => displayCents(hostPrice) / 100

/** Détail d'une réservation, en centimes. */
export const bookingAmounts = (hostPrice: number, seats: number) => {
  const host = hostCents(hostPrice) * seats
  const total = displayCents(hostPrice) * seats
  return { total, host, fee: total - host }
}

/** Date et heure d'un repas (heure de Paris) converties en instant absolu. */
export function parisDateTime(date: string, time?: string | null): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  const [hh, mm] = (time || '12:00').slice(0, 5).split(':').map(Number)
  // On part de l'heure « murale » en UTC puis on corrige du décalage de Paris à cette date.
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(guess))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asParis = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return new Date(guess - (asParis - guess))
}

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
