-- Migration: add lat/lng/distance params to rpc_search_properties and rpc_fetch_map_pins
-- Uses Haversine formula for distance calculation (meters)

-- Drop old versions (signature changed — new params added)
DROP FUNCTION IF EXISTS rpc_search_properties(text,text[],numeric,numeric,boolean,integer,boolean,text,integer,integer);
DROP FUNCTION IF EXISTS rpc_fetch_map_pins(text,text[],numeric,numeric,boolean,integer,boolean);

-- ─── rpc_search_properties ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_search_properties(
  p_area           text    = NULL,
  p_property_types text[]  = NULL,
  p_min_price      numeric = NULL,
  p_max_price      numeric = NULL,
  p_near_transit   boolean = false,
  p_min_year       int     = NULL,
  p_has_yield      boolean = false,
  p_sort_by        text    = 'relevance',
  p_limit          int     = 12,
  p_page           int     = 1,
  p_lat            float   = NULL,   -- anchor latitude
  p_lng            float   = NULL,   -- anchor longitude
  p_max_dist_m     int     = NULL    -- max distance in meters (NULL = no limit)
)
RETURNS json
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_offset int  := (GREATEST(p_page, 1) - 1) * p_limit;
  v_sort   text := COALESCE(p_sort_by, 'relevance');
  v_total  int;
  v_rows   json;
BEGIN

  -- COUNT (distinct by name+district, with optional distance filter)
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT DISTINCT ON (r.name, r.district) r.id
    FROM public.rag_properties r
    WHERE
      (p_area IS NULL OR r.district_canonical ILIKE '%' || p_area || '%'
                      OR r.district           ILIKE '%' || p_area || '%'
                      OR r.neighborhood       ILIKE '%' || p_area || '%')
      AND (p_property_types IS NULL OR r.property_type ILIKE ANY(p_property_types))
      AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
      AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
      AND (NOT p_near_transit OR (r.near_transit IS NOT NULL AND r.near_transit <> ''))
      AND (p_min_year IS NULL OR r.year_built >= p_min_year)
      AND (NOT p_has_yield OR r.rental_yield IS NOT NULL)
      AND (
        p_max_dist_m IS NULL OR p_lat IS NULL OR p_lng IS NULL OR r.latitude IS NULL
        OR 6371000 * 2 * asin(sqrt(
             power(sin(radians((r.latitude  - p_lat) / 2)), 2) +
             cos(radians(p_lat)) * cos(radians(r.latitude)) *
             power(sin(radians((r.longitude - p_lng) / 2)), 2)
           )) <= p_max_dist_m
      )
    ORDER BY r.name, r.district, r.id
  ) cnt;

  -- ROWS with distance_m column
  SELECT json_agg(row_to_json(outer_q)) INTO v_rows
  FROM (
    SELECT *
    FROM (
      SELECT DISTINCT ON (r.name, r.district)
        r.id, r.name, r.property_type, r.province, r.district, r.neighborhood,
        r.developer, r.price_thb, r.price_per_sqm, r.year_built, r.nbr_floors,
        r.rental_yield, r.near_transit, r.amenities, r.url,
        r.latitude, r.longitude, r.coord_accurate, r.text_content,
        CASE
          WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.latitude IS NOT NULL
          THEN ROUND(6371000 * 2 * asin(sqrt(
                 power(sin(radians((r.latitude  - p_lat) / 2)), 2) +
                 cos(radians(p_lat)) * cos(radians(r.latitude)) *
                 power(sin(radians((r.longitude - p_lng) / 2)), 2)
               )))::int
        END AS distance_m
      FROM public.rag_properties r
      WHERE
        (p_area IS NULL OR r.district_canonical ILIKE '%' || p_area || '%'
                        OR r.district           ILIKE '%' || p_area || '%'
                        OR r.neighborhood       ILIKE '%' || p_area || '%')
        AND (p_property_types IS NULL OR r.property_type ILIKE ANY(p_property_types))
        AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
        AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
        AND (NOT p_near_transit OR (r.near_transit IS NOT NULL AND r.near_transit <> ''))
        AND (p_min_year IS NULL OR r.year_built >= p_min_year)
        AND (NOT p_has_yield OR r.rental_yield IS NOT NULL)
        AND (
          p_max_dist_m IS NULL OR p_lat IS NULL OR p_lng IS NULL OR r.latitude IS NULL
          OR 6371000 * 2 * asin(sqrt(
               power(sin(radians((r.latitude  - p_lat) / 2)), 2) +
               cos(radians(p_lat)) * cos(radians(r.latitude)) *
               power(sin(radians((r.longitude - p_lng) / 2)), 2)
             )) <= p_max_dist_m
        )
      ORDER BY r.name, r.district, r.id   -- required for DISTINCT ON
    ) deduped
    ORDER BY
      -- If anchor provided → primary sort by distance; else use p_sort_by
      CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL THEN distance_m END ASC NULLS LAST,
      CASE WHEN (p_lat IS NULL) AND v_sort = 'price_asc'  THEN price_thb      END ASC  NULLS LAST,
      CASE WHEN (p_lat IS NULL) AND v_sort = 'price_desc' THEN price_thb      END DESC NULLS LAST,
      CASE WHEN (p_lat IS NULL) AND v_sort = 'newest'     THEN year_built     END DESC NULLS LAST,
      CASE WHEN (p_lat IS NULL) AND v_sort = 'yield'      THEN rental_yield   END DESC NULLS LAST,
      price_thb ASC NULLS LAST
    LIMIT  p_limit
    OFFSET v_offset
  ) outer_q;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END;
$$;


-- ─── rpc_fetch_map_pins ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rpc_fetch_map_pins(
  p_area           text    = NULL,
  p_property_types text[]  = NULL,
  p_min_price      numeric = NULL,
  p_max_price      numeric = NULL,
  p_near_transit   boolean = false,
  p_min_year       int     = NULL,
  p_has_yield      boolean = false,
  p_lat            float   = NULL,
  p_lng            float   = NULL,
  p_max_dist_m     int     = NULL
)
RETURNS json
LANGUAGE plpgsql STABLE
AS $$
DECLARE v_rows json;
BEGIN
  SELECT json_agg(row_to_json(pins)) INTO v_rows
  FROM (
    SELECT DISTINCT ON (r.name, r.district)
      r.id,
      r.name,
      r.latitude  AS lat,
      r.longitude AS lng,
      r.price_thb AS price,
      COALESCE(r.neighborhood, r.district, r.province, '') AS area_name,
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.latitude IS NOT NULL
        THEN ROUND(6371000 * 2 * asin(sqrt(
               power(sin(radians((r.latitude  - p_lat) / 2)), 2) +
               cos(radians(p_lat)) * cos(radians(r.latitude)) *
               power(sin(radians((r.longitude - p_lng) / 2)), 2)
             )))::int
      END AS distance_m
    FROM public.rag_properties r
    WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      AND (p_area IS NULL OR r.district_canonical ILIKE '%' || p_area || '%'
                          OR r.district           ILIKE '%' || p_area || '%'
                          OR r.neighborhood       ILIKE '%' || p_area || '%')
      AND (p_property_types IS NULL OR r.property_type ILIKE ANY(p_property_types))
      AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
      AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
      AND (NOT p_near_transit OR (r.near_transit IS NOT NULL AND r.near_transit <> ''))
      AND (p_min_year IS NULL OR r.year_built >= p_min_year)
      AND (NOT p_has_yield OR r.rental_yield IS NOT NULL)
      AND (
        p_max_dist_m IS NULL OR p_lat IS NULL OR p_lng IS NULL OR r.latitude IS NULL
        OR 6371000 * 2 * asin(sqrt(
             power(sin(radians((r.latitude  - p_lat) / 2)), 2) +
             cos(radians(p_lat)) * cos(radians(r.latitude)) *
             power(sin(radians((r.longitude - p_lng) / 2)), 2)
           )) <= p_max_dist_m
      )
    ORDER BY r.name, r.district, r.id
    LIMIT 2000
  ) pins;

  RETURN COALESCE(v_rows, '[]'::json);
END;
$$;
