# Shareat

Plateforme de tables d’hôtes chez l’habitant : Next.js 16 (App Router), Supabase, Stripe Connect, Leaflet/OpenStreetMap.

## Fonctionnement

- Les hôtes fixent un prix par couvert ; le prix affiché aux invités est majoré de 10 % (commission Shareat).
- Paiement 100 % en ligne via Stripe Checkout (paiements « à destination ») : la part de l’hôte est versée sur son compte Stripe Express, Shareat conserve la commission.
- Annulation gratuite par l’invité jusqu’à 48 h avant le repas ; annulation par l’hôte = remboursement de tous les invités.
- Adresse exacte de l’hôte privée (table `meal_private`) jusqu’à la réservation ; carte publique avec position approximative (≈ 1 km).
- Catégories multiples par repas (repas étudiant, halal, casher, végétarien…), contrôlées en base.

## Variables d’environnement

Voir `.env.example`. Toutes sont requises en production sauf `NEXT_PUBLIC_SITE_URL`.

## Base de données

Les migrations SQL sont dans `supabase/migrations/` (déjà appliquées au projet Supabase).

## Développement

```bash
npm install
npm run dev
```
