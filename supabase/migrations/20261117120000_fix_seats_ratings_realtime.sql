-- Places restantes : gérées par la base, à la création ET au changement de statut.
-- SECURITY DEFINER : l'invité n'a pas le droit de modifier la table meals (RLS),
-- la fonction doit donc s'exécuter avec les droits de son propriétaire.
create or replace function public.update_available_seats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  seats_left integer;
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'confirmed' then
      select available_seats into seats_left from meals where id = NEW.meal_id for update;
      if seats_left is null or seats_left < NEW.seats then
        raise exception 'Plus assez de places disponibles';
      end if;
      update meals set available_seats = available_seats - NEW.seats where id = NEW.meal_id;
    end if;
    return NEW;
  end if;

  if NEW.status = 'confirmed' and OLD.status = 'pending' then
    select available_seats into seats_left from meals where id = NEW.meal_id for update;
    if seats_left is null or seats_left < NEW.seats then
      raise exception 'Plus assez de places disponibles';
    end if;
    update meals set available_seats = available_seats - NEW.seats where id = NEW.meal_id;
  end if;
  if NEW.status = 'cancelled' and OLD.status = 'confirmed' then
    update meals set available_seats = available_seats + NEW.seats where id = NEW.meal_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_booking_created on public.bookings;
create trigger on_booking_created
  after insert on public.bookings
  for each row execute function public.update_available_seats();

-- Notes : le voyageur qui laisse un avis n'a pas le droit de modifier
-- le profil de l'hôte ni le repas ; la fonction doit donc être SECURITY DEFINER.
alter function public.update_rating() security definer;
alter function public.update_rating() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Messagerie en temps réel.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
