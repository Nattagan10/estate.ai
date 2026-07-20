
DROP POLICY IF EXISTS chat_sessions_select_own_or_admin ON public.chat_sessions;
CREATE POLICY chat_sessions_select_own_or_admin ON public.chat_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS chat_logs_select_own ON public.chat_logs;
CREATE POLICY chat_logs_select_own ON public.chat_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = chat_logs.session_id
        AND (s.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

REVOKE SELECT ON public.chat_sessions FROM anon;
REVOKE SELECT ON public.chat_logs FROM anon;
