-- Fonctions de trigger : elles ne doivent pas être appelables via l'API (/rest/v1/rpc).
-- Les triggers continuent de fonctionner (aucun droit EXECUTE n'est vérifié au déclenchement).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.update_available_seats() from public, anon, authenticated;
revoke execute on function public.update_rating() from public, anon, authenticated;
