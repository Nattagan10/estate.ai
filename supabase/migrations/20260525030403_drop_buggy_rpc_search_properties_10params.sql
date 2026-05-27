
-- Drop the buggy 10-param rpc_search_properties function
DROP FUNCTION IF EXISTS public.rpc_search_properties(text, text[], bigint, bigint, boolean, integer, integer, text, integer, boolean);
