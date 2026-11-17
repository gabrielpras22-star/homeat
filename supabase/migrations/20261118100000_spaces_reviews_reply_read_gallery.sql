-- Espaces hôte et invité reliés aux vraies données.

-- 1. Avis dans les deux sens : un avis par réservation ET par sens (invité → hôte, hôte → invité).
alter table public.reviews drop constraint if exists reviews_booking_id_key;
alter table public.reviews add constraint reviews_booking_type_key unique (booking_id, type);

-- La note d'un repas ne compte que les avis des invités.
create or replace function public.update_rating()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  update profiles set
    rating = (select avg(rating) from reviews where reviewed_id = NEW.reviewed_id and type = NEW.type),
    reviews_count = (select count(*) from reviews where reviewed_id = NEW.reviewed_id and type = NEW.type)
  where id = NEW.reviewed_id and NEW.type = 'guest_to_host';
  if NEW.type = 'guest_to_host' then
    update meals set
      rating = (select avg(rating) from reviews where meal_id = NEW.meal_id and type = 'guest_to_host'),
      reviews_count = (select count(*) from reviews where meal_id = NEW.meal_id and type = 'guest_to_host')
    where id = NEW.meal_id;
  end if;
  return NEW;
end;
$$;
revoke execute on function public.update_rating() from public, anon, authenticated;

-- L'hôte peut noter un invité venu à l'un de ses repas, une fois le repas passé.
drop policy if exists "Hôte note un invité" on public.reviews;
create policy "Hôte note un invité" on public.reviews for insert to authenticated
with check (
  reviewer_id = auth.uid() and type = 'host_to_guest' and exists (
    select 1 from bookings b join meals m on m.id = b.meal_id
    where b.id = reviews.booking_id and m.host_id = auth.uid() and m.id = reviews.meal_id
      and b.guest_id = reviews.reviewed_id and b.status in ('confirmed', 'completed') and m.date <= current_date
  )
);

-- 2. Réponse publique de l'hôte à un avis reçu (seule la colonne reply est modifiable).
alter table public.reviews add column if not exists reply text check (reply is null or char_length(reply) <= 600);
grant select (reply) on public.reviews to anon, authenticated;
grant update (reply) on public.reviews to authenticated;
drop policy if exists "Hôte répond à un avis" on public.reviews;
create policy "Hôte répond à un avis" on public.reviews for update to authenticated
using (reviewed_id = auth.uid() and type = 'guest_to_host')
with check (reviewed_id = auth.uid() and type = 'guest_to_host');

-- 3. Le destinataire d'un message peut le marquer comme lu.
grant update (is_read) on public.messages to authenticated;
drop policy if exists "Marquer comme lu" on public.messages;
create policy "Marquer comme lu" on public.messages for update to authenticated
using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());

-- 4. Chacun peut lister ses propres photos (galerie de l'espace hôte).
drop policy if exists "Photos de plats : liste par leur auteur" on storage.objects;
create policy "Photos de plats : liste par leur auteur" on storage.objects for select to authenticated
using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
