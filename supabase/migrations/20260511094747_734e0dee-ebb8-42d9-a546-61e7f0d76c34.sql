
-- Lock down SECURITY DEFINER functions (RLS policies still call them as table owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Replace overly-permissive INSERT policies with shape-checks
DROP POLICY IF EXISTS "chat_sessions_insert_any" ON public.chat_sessions;
DROP POLICY IF EXISTS "chat_logs_insert_any" ON public.chat_logs;

-- Anonymous demo users have no auth.uid(); ensure user_id is null OR matches them
CREATE POLICY "chat_sessions_insert_self_or_anon" ON public.chat_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "chat_logs_insert_for_existing_session" ON public.chat_logs
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    role IN ('user','assistant','system')
    AND EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id)
  );
