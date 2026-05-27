
-- Drop old RPC functions before recreating with correct implementations
DROP FUNCTION IF EXISTS public.rpc_search_properties(text, text[], bigint, bigint, boolean, integer, integer, text, integer, boolean);
DROP FUNCTION IF EXISTS public.rpc_fetch_map_pins(text, text[], bigint, bigint, boolean, integer, boolean);
