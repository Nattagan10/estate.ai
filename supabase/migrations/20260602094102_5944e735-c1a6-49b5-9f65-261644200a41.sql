
-- Tighten chat_logs INSERT to verify session ownership
DROP POLICY IF EXISTS chat_logs_insert_for_existing_session ON public.chat_logs;

CREATE POLICY chat_logs_insert_session_owner
ON public.chat_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (
  role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])
  AND EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_logs.session_id
      AND (
        (s.user_id IS NULL AND auth.uid() IS NULL)
        OR s.user_id = auth.uid()
      )
  )
);

-- Add SELECT policy so users can read logs for sessions they own
CREATE POLICY chat_logs_select_own
ON public.chat_logs
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_logs.session_id
      AND (
        (s.user_id IS NULL AND auth.uid() IS NULL)
        OR s.user_id = auth.uid()
      )
  )
);

-- Add INSERT policy on profiles so authenticated users can create their own profile
CREATE POLICY profiles_insert_own
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
