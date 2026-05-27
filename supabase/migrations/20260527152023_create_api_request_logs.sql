-- Migration: create api_request_logs table for backend monitoring
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  session_id uuid,
  user_message text,
  detected_lang text,
  local_filters jsonb DEFAULT '{}',
  ai_profile jsonb DEFAULT '{}',
  merged_filters jsonb DEFAULT '{}',
  search_mode text,
  properties_total integer DEFAULT 0,
  properties_sample jsonb DEFAULT '[]',
  response_length integer DEFAULT 0,
  duration_ms integer,
  error text
);

ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
-- No public policy — service role only (admin reads via supabaseAdmin client)
