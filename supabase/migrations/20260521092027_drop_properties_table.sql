
-- Drop legacy properties table now that rag_properties is the source of truth
DROP TABLE IF EXISTS public.properties CASCADE;
