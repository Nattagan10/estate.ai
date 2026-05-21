-- Run this in Supabase SQL Editor before importing data
-- Creates the shared rag_properties table used by both estate.ai and python-service

CREATE TABLE IF NOT EXISTS public.rag_properties (
  id              TEXT PRIMARY KEY,
  name            TEXT,
  property_type   TEXT,
  province        TEXT,
  district        TEXT,
  neighborhood    TEXT,
  developer       TEXT,
  price_thb       BIGINT,
  price_per_sqm   BIGINT,
  year_built      INT,
  nbr_floors      INT,
  rental_yield    FLOAT,
  near_transit    TEXT,
  amenities       TEXT[],
  url             TEXT,
  latitude        FLOAT,
  longitude       FLOAT,
  coord_accurate  BOOLEAN DEFAULT FALSE,
  text_content    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for location queries
CREATE INDEX IF NOT EXISTS idx_rag_properties_lat_lon
  ON public.rag_properties (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Index for price sorting
CREATE INDEX IF NOT EXISTS idx_rag_properties_price
  ON public.rag_properties (price_thb);

-- Index for text search
CREATE INDEX IF NOT EXISTS idx_rag_properties_name
  ON public.rag_properties USING gin(to_tsvector('simple', coalesce(name, '')));

-- Enable RLS (read-only for anon, full access for service role)
ALTER TABLE public.rag_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_properties_read_all"
  ON public.rag_properties FOR SELECT
  USING (true);
