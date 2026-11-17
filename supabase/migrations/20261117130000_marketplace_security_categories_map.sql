-- ═══════════════════════════════════════════════════════════════════
-- Shareat : sécurité, paiement en ligne, catégories, carte
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Catégories de repas (plusieurs par repas, liste contrôlée) ──
alter table public.meals drop constraint if exists meals_tags_allowed;
alter table public.meals add constraint meals_tags_allowed check (
  tags is null or tags <@ array[
    'Repas étudiant', 'Halal', 'Casher', 'Végétarien', 'Végan',
    'Sans gluten', 'Sans porc', 'Sans lactose', 'Enfants bienvenus', 'Atelier cuisine'
  ]::text[]
);

-- ── 2. Position approximative publique (carte) ──
alter table public.meals add column if not exists lat double precision;
alter table public.meals add column if not exists lng double precision;
alter table public.meals drop constraint if exists meals_coords_valid;
alter table public.meals add constraint meals_coords_valid check (
  (lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180)
);
alter table public.meals drop constraint if exists meals_price_positive;
alter table public.meals add constraint meals_price_positive check (price_per_seat > 0 and price_per_seat <= 500);
alter table public.meals drop constraint if exists meals_seats_valid;
alter table public.meals add constraint meals_seats_valid check (max_seats between 1 and 50 and available_seats >= 0 and available_seats <= max_seats);

-- ── 3. Adresse exacte : visible seulement par l'hôte et ses invités confirmés ──
create table if not exists public.meal_private (
  meal_id uuid primary key references public.meals(id) on delete cascade,
  address text not null check (char_length(address) between 5 and 300),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
alter table public.meal_private enable row level security;
drop policy if exists "Hôte gère l'adresse" on public.meal_private;
create policy "Hôte gère l'adresse" on public.meal_private for all
  using (exists (select 1 from public.meals m where m.id = meal_private.meal_id and m.host_id = auth.uid()))
  with check (exists (select 1 from public.meals m where m.id = meal_private.meal_id and m.host_id = auth.uid()));
drop policy if exists "Invités confirmés voient l'adresse" on public.meal_private;
create policy "Invités confirmés voient l'adresse" on public.meal_private for select
  using (exists (select 1 from public.bookings b where b.meal_id = meal_private.meal_id and b.guest_id = auth.uid() and b.status in ('confirmed', 'completed')));

-- ── 4. Comptes de versement des hôtes (Stripe Connect), écrits par le serveur uniquement ──
create table if not exists public.host_payouts (
  host_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_account_id text not null unique,
  transfers_active boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.host_payouts enable row level security;
drop policy if exists "Voir son compte de versement" on public.host_payouts;
create policy "Voir son compte de versement" on public.host_payouts for select using (host_id = auth.uid());

-- ── 5. Réservations : suivi du paiement ; création et changements de statut par le serveur uniquement ──
alter table public.bookings add column if not exists stripe_checkout_session_id text unique;
alter table public.bookings add column if not exists host_amount numeric;
alter table public.bookings add column if not exists platform_fee numeric;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists refunded_amount numeric;
drop policy if exists "Créer une réservation" on public.bookings;
drop policy if exists "Modifier sa réservation" on public.bookings;

-- ── 6. Publication d'un repas : valeurs contrôlées et compte de versement obligatoire ──
create or replace function public.meals_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from host_payouts where host_id = NEW.host_id and transfers_active) then
    raise exception 'Configurez vos versements avant de publier une table';
  end if;
  NEW.available_seats := NEW.max_seats;
  NEW.rating := 0;
  NEW.reviews_count := 0;
  NEW.is_active := true;
  if NEW.date < current_date then
    raise exception 'La date doit être aujourd''hui ou plus tard';
  end if;
  return NEW;
end;
$$;
revoke execute on function public.meals_before_insert() from public, anon, authenticated;
drop trigger if exists on_meal_insert on public.meals;
create trigger on_meal_insert before insert on public.meals
  for each row execute function public.meals_before_insert();

-- ── 7. Avis : réservés aux invités confirmés, après le repas ──
drop policy if exists "Écrire un avis" on public.reviews;
create policy "Écrire un avis" on public.reviews for insert with check (
  reviewer_id = auth.uid()
  and type = 'guest_to_host'
  and exists (
    select 1 from public.bookings b join public.meals m on m.id = b.meal_id
    where b.id = reviews.booking_id
      and b.guest_id = auth.uid()
      and b.status in ('confirmed', 'completed')
      and m.id = reviews.meal_id
      and m.host_id = reviews.reviewed_id
      and m.date <= current_date
  )
);

-- ── 8. Droits par colonne (les règles RLS restent en place) ──
revoke all on public.profiles, public.meals, public.bookings, public.reviews, public.messages, public.favorites,
  public.meal_private, public.host_payouts from anon, authenticated;

-- Lecture publique
grant select on public.meals, public.reviews to anon, authenticated;
grant select (id, created_at, full_name, avatar_url, bio, city, languages, is_host, rating, reviews_count)
  on public.profiles to anon, authenticated;

-- Lecture réservée aux utilisateurs connectés (filtrée par RLS)
grant select on public.bookings, public.messages, public.favorites, public.meal_private, public.host_payouts to authenticated;

-- Écritures autorisées
grant update (full_name, avatar_url, bio, city, phone, languages) on public.profiles to authenticated;
grant insert (host_id, title, description, cuisine, price_per_seat, max_seats, available_seats, date, time, city,
  menu, tags, photo_url, is_active, lat, lng) on public.meals to authenticated;
grant update (title, description, cuisine, price_per_seat, date, time, city, menu, tags, photo_url, lat, lng)
  on public.meals to authenticated;
grant insert, delete on public.favorites to authenticated;
grant insert on public.messages to authenticated;
grant insert (booking_id, reviewer_id, reviewed_id, meal_id, rating, comment, type) on public.reviews to authenticated;
grant insert, update, delete on public.meal_private to authenticated;

-- Un même repas ne peut pas être en favori deux fois
alter table public.favorites drop constraint if exists favorites_user_meal_unique;
alter table public.favorites add constraint favorites_user_meal_unique unique (user_id, meal_id);
