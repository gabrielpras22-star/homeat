-- ═══════════════════════════════════════════════════════════════════
-- Shareat : allergènes, plafond « Repas étudiant », photos, virements différés
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Allergènes (14 allergènes majeurs, règlement UE 1169/2011) ──
-- NULL = non déclaré (interdit à la publication), {} = aucun allergène majeur.
alter table public.meals add column if not exists allergens text[];
alter table public.meals drop constraint if exists meals_allergens_allowed;
alter table public.meals add constraint meals_allergens_allowed check (
  allergens is null or allergens <@ array[
    'Gluten', 'Crustacés', 'Œufs', 'Poissons', 'Arachides', 'Soja', 'Lait',
    'Fruits à coque', 'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'
  ]::text[]
);

-- ── 2. « Repas étudiant » : prix payé par l'invité (prix hôte + 10 %) limité à 10 € ──
alter table public.meals drop constraint if exists meals_student_price_cap;
alter table public.meals add constraint meals_student_price_cap check (
  tags is null or not ('Repas étudiant' = any(tags)) or round(price_per_seat * 110) <= 1000
);

-- ── 3. Publication : allergènes obligatoires (en plus des contrôles existants) ──
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
  if NEW.allergens is null then
    raise exception 'Indiquez les allergènes présents (ou « aucun »)';
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

grant insert (allergens) on public.meals to authenticated;
grant update (allergens) on public.meals to authenticated;

-- ── 4. Virement à l'hôte après le repas, rappels par email ──
alter table public.bookings add column if not exists stripe_charge_id text;
alter table public.bookings add column if not exists stripe_transfer_id text;
alter table public.bookings add column if not exists transferred_at timestamptz;
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
create index if not exists bookings_status_idx on public.bookings (status);

-- ── 5. Photos des plats (Supabase Storage) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-photos', 'meal-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Photos de plats : envoi par leur auteur" on storage.objects;
create policy "Photos de plats : envoi par leur auteur" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Photos de plats : suppression par leur auteur" on storage.objects;
create policy "Photos de plats : suppression par leur auteur" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
