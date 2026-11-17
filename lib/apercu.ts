// DONNÉES D'EXEMPLE pour l'aperçu local des espaces hôte et invité.
// Elles ne s'affichent que si Supabase n'est pas configuré (bandeau « Aperçu » visible)
// et ne sont jamais enregistrées. Le site en ligne n'affiche aucune fausse annonce ni faux avis.

import { todayParis } from './shared'

const u = (id: string, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`

/** Date AAAA-MM-JJ décalée de n jours par rapport à aujourd'hui (heure de Paris). */
export function inDays(n: number) {
  const [y, m, d] = todayParis().split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export const PHOTOS = {
  couscous: u('1541518763669-27fef04b14ea'),
  pasta: u('1473093295043-cdd812d0e601'),
  ramen: u('1569718212165-3a8278d5f624'),
  tacos: u('1565299585323-38d6b0865b47'),
  curry: u('1585937421612-70a008356fbe'),
  french: u('1467003909585-2f8a72700288'),
  mezze: u('1511690656952-34342bb7c2f2'),
  paella: u('1534080564583-6be75777b70a'),
  table: u('1414235077428-338989a2e8c0'),
}

export type DemoMeal = { id: string; title: string; cuisine: string; date: string; time: string; price: number; seats: number; booked: number; status: 'online' | 'past' | 'cancelled' | 'draft'; photo: string; tags: string[] }
export type DemoGuest = { id: string; name: string; seats: number; mealId: string; note?: string; reviewed?: boolean }
export type DemoReview = { id: string; author: string; rating: number; date: string; text: string; meal: string; reply?: string; crit?: Record<string, number> }
export type DemoThread = { id: string; name: string; about: string; unread: number; msgs: { me: boolean; text: string; at: string; deleted?: boolean }[] }

export const HOST_DEMO = {
  name: 'Exemple Hôte',
  city: 'Bordeaux',
  meals: [
    { id: 'm1', title: 'Couscous du dimanche', cuisine: 'Marocaine', date: inDays(5), time: '19:30', price: 18, seats: 8, booked: 5, status: 'online', photo: PHOTOS.couscous, tags: ['Halal', 'Enfants bienvenus'] },
    { id: 'm2', title: 'Soirée mezze et grillades', cuisine: 'Libanaise', date: inDays(12), time: '20:00', price: 22, seats: 6, booked: 2, status: 'online', photo: PHOTOS.mezze, tags: ['Végétarien'] },
    { id: 'm3', title: 'Atelier tajine', cuisine: 'Marocaine', date: inDays(-9), time: '18:30', price: 25, seats: 6, booked: 6, status: 'past', photo: PHOTOS.table, tags: ['Atelier cuisine'] },
  ] as DemoMeal[],
  guests: [
    { id: 'g1', name: 'Invité A', seats: 2, mealId: 'm1', note: 'Allergie : fruits à coque' },
    { id: 'g2', name: 'Invitée B', seats: 1, mealId: 'm1' },
    { id: 'g3', name: 'Invité C', seats: 2, mealId: 'm1', note: 'Vient avec sa fille de 9 ans' },
    { id: 'g4', name: 'Invitée D', seats: 2, mealId: 'm2' },
    { id: 'g5', name: 'Invité E', seats: 3, mealId: 'm3' },
    { id: 'g6', name: 'Invitée F', seats: 2, mealId: 'm3', reviewed: true },
    { id: 'g7', name: 'Invité G', seats: 1, mealId: 'm3' },
  ] as DemoGuest[],
  reviews: [
    { id: 'r1', author: 'Invitée F', rating: 5, date: inDays(-8), meal: 'Atelier tajine', text: 'Exemple d’avis : accueil chaleureux, on a appris plein de choses et le tajine était délicieux.' },
    { id: 'r2', author: 'Invité E', rating: 4, date: inDays(-8), meal: 'Atelier tajine', text: 'Exemple d’avis : super soirée, juste un peu d’attente avant le plat.', reply: 'Merci ! La prochaine fois je lance la cuisson plus tôt.' },
  ] as DemoReview[],
  payouts: [
    { id: 'p1', meal: 'Atelier tajine', date: inDays(-8), amount: 150 },
    { id: 'p2', meal: 'Brunch du samedi', date: inDays(-26), amount: 96 },
    { id: 'p3', meal: 'Couscous du dimanche', date: inDays(-40), amount: 126 },
  ],
  months: [['Juin', 0], ['Juil.', 54], ['Août', 90], ['Sept.', 126], ['Oct.', 222], ['Nov.', 150]] as [string, number][],
  threads: [
    { id: 't1', name: 'Invité A', about: 'Couscous du dimanche', unread: 1, msgs: [{ me: false, text: 'Bonjour ! Est-ce qu’il y aura des fruits à coque dans le dessert ? Je suis allergique.', at: '10:12' }] },
    { id: 't2', name: 'Invitée D', about: 'Soirée mezze et grillades', unread: 0, msgs: [{ me: false, text: 'Peut-on venir à 20 h 15 ?', at: 'hier' }, { me: true, text: 'Bien sûr, à samedi !', at: 'hier' }] },
  ] as DemoThread[],
}

/** Exemples de repas à venir, ouverts à la réservation (vue « À venir » de l'espace invité). */
export const UPCOMING_DEMO = [
  { id: 'u1', title: 'Couscous du dimanche', host: 'Exemple Hôte', city: 'Bordeaux', date: inDays(5), time: '19:30', price: 18, left: 3, photo: PHOTOS.couscous, tags: ['Halal', 'Enfants bienvenus'], allergens: ['Gluten', 'Céleri'] },
  { id: 'u2', title: 'Tacos al pastor', host: 'Hôte Exemple 5', city: 'Bordeaux', date: inDays(7), time: '20:00', price: 15, left: 5, photo: PHOTOS.tacos, tags: ['Sans lactose'], allergens: [] },
  { id: 'u3', title: 'Repas étudiant : curry', host: 'Hôte Exemple 3', city: 'Talence', date: inDays(9), time: '19:00', price: 9, left: 2, photo: PHOTOS.curry, tags: ['Repas étudiant', 'Végétarien'], allergens: ['Lait', 'Fruits à coque'] },
  { id: 'u4', title: 'Soirée mezze et grillades', host: 'Exemple Hôte', city: 'Bordeaux', date: inDays(12), time: '20:00', price: 22, left: 4, photo: PHOTOS.mezze, tags: ['Végétarien'], allergens: ['Sésame'] },
]

export const GUEST_DEMO = {
  name: 'Exemple Invité',
  bookings: [
    { id: 'b1', ref: 'R-2026-0412', title: 'Ramen maison et gyoza', host: 'Hôte Exemple 1', city: 'Bordeaux', date: inDays(4), time: '19:30', seats: 2, total: 39.6, photo: PHOTOS.ramen, status: 'confirmed', address: '12 rue d’Exemple, 33000 Bordeaux' },
    { id: 'b2', ref: 'R-2026-0433', title: 'Paella entre amis', host: 'Hôte Exemple 2', city: 'Mérignac', date: inDays(1), time: '20:00', seats: 1, total: 24.2, photo: PHOTOS.paella, status: 'confirmed', address: '3 allée d’Exemple, 33700 Mérignac' },
    { id: 'b3', ref: 'R-2026-0377', title: 'Curry du Kerala', host: 'Hôte Exemple 3', city: 'Bordeaux', date: inDays(-6), time: '19:00', seats: 2, total: 35.2, photo: PHOTOS.curry, status: 'past', address: '' },
    { id: 'b4', ref: 'R-2026-0301', title: 'Pâtes fraîches de Nonna', host: 'Hôte Exemple 4', city: 'Pessac', date: inDays(-20), time: '19:30', seats: 1, total: 19.8, photo: PHOTOS.pasta, status: 'past', reviewed: true, address: '' },
  ],
  favorites: [
    { id: 'f1', title: 'Tacos al pastor', host: 'Hôte Exemple 5', city: 'Bordeaux', price: 16.5, photo: PHOTOS.tacos },
    { id: 'f2', title: 'Dîner bistrot', host: 'Hôte Exemple 6', city: 'Talence', price: 27.5, photo: PHOTOS.french },
  ],
  reviewsAboutMe: [
    { id: 'ra1', author: 'Hôte Exemple 4', rating: 5, date: inDays(-19), meal: 'Pâtes fraîches de Nonna', text: 'Exemple d’avis : invité ponctuel et très sympathique, revenez quand vous voulez !' },
  ] as DemoReview[],
  myReviews: [
    { id: 'mr1', author: 'Vous', rating: 5, date: inDays(-19), meal: 'Pâtes fraîches de Nonna', text: 'Exemple d’avis : des pâtes comme en Italie et une hôte adorable.', crit: { Cuisine: 5, Accueil: 5, Propreté: 5, 'Rapport qualité-prix': 4 } },
  ] as DemoReview[],
  threads: [
    { id: 't1', name: 'Hôte Exemple 1', about: 'Ramen maison et gyoza', unread: 1, msgs: [{ me: true, text: 'Bonjour, peut-on avoir une version sans porc ?', at: 'hier' }, { me: false, text: 'Oui, je prépare un bouillon au poulet pour vous deux.', at: '09:40' }] },
  ] as DemoThread[],
  tickets: [{ id: 'SH-7K3P-92', subject: 'Remboursement', date: inDays(-15), status: 'Résolue' }],
}
