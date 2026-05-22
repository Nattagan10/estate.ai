
-- Enable pg_trgm for trigram indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- RAG-optimised properties table (replaces public.properties)
CREATE TABLE public.rag_properties (
  id               TEXT PRIMARY KEY,
  name             TEXT,
  property_type    TEXT,
  province         TEXT,
  district         TEXT,
  neighborhood     TEXT,
  developer        TEXT,
  price_thb        BIGINT,
  price_per_sqm    BIGINT,
  year_built       INTEGER,
  nbr_floors       INTEGER,
  rental_yield     DOUBLE PRECISION,
  near_transit     TEXT,
  amenities        TEXT[],
  url              TEXT,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  coord_accurate   BOOLEAN DEFAULT false,
  text_content     TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rag_properties_lat_lon ON public.rag_properties (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX idx_rag_properties_price  ON public.rag_properties (price_thb);
CREATE INDEX idx_rp_price_thb          ON public.rag_properties (price_thb);

CREATE INDEX idx_rag_properties_name   ON public.rag_properties
  USING gin (to_tsvector('simple', COALESCE(name, '')));

CREATE INDEX idx_rp_name_trgm         ON public.rag_properties USING gin (name gin_trgm_ops);
CREATE INDEX idx_rp_district_trgm     ON public.rag_properties USING gin (district gin_trgm_ops);
CREATE INDEX idx_rp_neighborhood_trgm ON public.rag_properties USING gin (neighborhood gin_trgm_ops);

-- RLS
ALTER TABLE public.rag_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rag_properties_read_all" ON public.rag_properties
  FOR SELECT USING (true);
