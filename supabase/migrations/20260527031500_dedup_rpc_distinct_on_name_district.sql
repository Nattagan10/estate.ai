
-- Fix: data from Baania has ~32 duplicate rows per project (same name+district,
-- different IDs). Add DISTINCT ON (name, district) so each project appears once.

CREATE OR REPLACE FUNCTION public.rpc_search_properties(
  p_area            text    DEFAULT NULL,
  p_property_types  text[]  DEFAULT NULL,
  p_min_price       bigint  DEFAULT NULL,
  p_max_price       bigint  DEFAULT NULL,
  p_near_transit    boolean DEFAULT false,
  p_page            integer DEFAULT 1,
  p_limit           integer DEFAULT 50,
  p_sort_by         text    DEFAULT 'relevance',
  p_min_year        integer DEFAULT NULL,
  p_has_yield       boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset          INT  := (COALESCE(p_page,1) - 1) * COALESCE(p_limit,50);
  v_total           BIGINT;
  v_rows            JSON;
  v_area_lower      TEXT := lower(COALESCE(p_area,''));
  v_district_filter TEXT := NULL;
BEGIN
  v_district_filter := CASE v_area_lower
    WHEN 'asok'                     THEN 'Watthana'
    WHEN 'asoke'                    THEN 'Watthana'
    WHEN 'thonglor'                 THEN 'Watthana'
    WHEN 'thong lo'                 THEN 'Watthana'
    WHEN 'phrom phong'              THEN 'Watthana'
    WHEN 'phromphong'               THEN 'Watthana'
    WHEN 'ekkamai'                  THEN 'Watthana'
    WHEN 'ekamai'                   THEN 'Watthana'
    WHEN 'nana'                     THEN 'Watthana'
    WHEN 'sukhumvit'                THEN 'Watthana'
    WHEN 'phloen chit'              THEN 'Pathum Wan'
    WHEN 'phloenchit'               THEN 'Pathum Wan'
    WHEN 'siam'                     THEN 'Pathum Wan'
    WHEN 'chidlom'                  THEN 'Pathum Wan'
    WHEN 'chit lom'                 THEN 'Pathum Wan'
    WHEN 'pathum wan'               THEN 'Pathum Wan'
    WHEN 'pathumwan'                THEN 'Pathum Wan'
    WHEN 'silom'                    THEN 'Bang Rak'
    WHEN 'bang rak'                 THEN 'Bang Rak'
    WHEN 'bangrak'                  THEN 'Bang Rak'
    WHEN 'sathorn'                  THEN 'Sathon'
    WHEN 'sathon'                   THEN 'Sathon'
    WHEN 'on nut'                   THEN 'Phra Khanong'
    WHEN 'onnut'                    THEN 'Phra Khanong'
    WHEN 'udom suk'                 THEN 'Phra Khanong'
    WHEN 'udomsuk'                  THEN 'Phra Khanong'
    WHEN 'phra khanong'             THEN 'Phra Khanong'
    WHEN 'bearing'                  THEN 'Phra Khanong'
    WHEN 'samrong'                  THEN 'Phra Khanong'
    WHEN 'ratchada'                 THEN 'Huai Khwang'
    WHEN 'rama 9'                   THEN 'Huai Khwang'
    WHEN 'rama ix'                  THEN 'Huai Khwang'
    WHEN 'thailand cultural centre' THEN 'Huai Khwang'
    WHEN 'cultural centre'          THEN 'Huai Khwang'
    WHEN 'sutthisan'                THEN 'Huai Khwang'
    WHEN 'huai khwang'              THEN 'Huai Khwang'
    WHEN 'huaikhwang'               THEN 'Huai Khwang'
    WHEN 'ari'                      THEN 'Phaya Thai'
    WHEN 'aree'                     THEN 'Phaya Thai'
    WHEN 'saphan khwai'             THEN 'Phaya Thai'
    WHEN 'phaya thai'               THEN 'Phaya Thai'
    WHEN 'phayathai'                THEN 'Phaya Thai'
    WHEN 'victory monument'         THEN 'Ratchathewi'
    WHEN 'ratchathewi'              THEN 'Ratchathewi'
    WHEN 'mo chit'                  THEN 'Chatuchak'
    WHEN 'chatuchak'                THEN 'Chatuchak'
    WHEN 'kaset'                    THEN 'Chatuchak'
    WHEN 'lat phrao'                THEN 'Lat Phrao'
    WHEN 'ladprao'                  THEN 'Lat Phrao'
    WHEN 'bang na'                  THEN 'Bang Na'
    WHEN 'bangna'                   THEN 'Bang Na'
    WHEN 'bang sue'                 THEN 'Bang Sue'
    WHEN 'bangsue'                  THEN 'Bang Sue'
    WHEN 'khlong toei'              THEN 'Khlong Toei'
    WHEN 'khlongtoei'               THEN 'Khlong Toei'
    ELSE NULL
  END;

  -- Count unique projects (deduped by name+district)
  SELECT COUNT(*) INTO v_total
  FROM (
    SELECT DISTINCT ON (r.name, r.district) r.id
    FROM public.rag_properties r
    WHERE
      (p_area IS NULL OR
        (v_district_filter IS NOT NULL AND r.district = v_district_filter) OR
        (v_district_filter IS NULL AND (
          r.district     ILIKE '%' || p_area || '%' OR
          r.neighborhood ILIKE '%' || p_area || '%' OR
          r.name         ILIKE '%' || p_area || '%'
        ))
      )
      AND (p_property_types IS NULL OR
           EXISTS (SELECT 1 FROM unnest(p_property_types) pt
                   WHERE r.property_type ILIKE '%' || pt || '%'))
      AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
      AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
      AND (NOT COALESCE(p_near_transit,FALSE) OR
           (r.near_transit IS NOT NULL AND r.near_transit <> ''))
      AND (p_min_year IS NULL OR r.year_built >= p_min_year)
      AND (NOT COALESCE(p_has_yield,FALSE) OR
           (r.rental_yield IS NOT NULL AND r.rental_yield > 0))
    ORDER BY r.name, r.district
  ) deduped;

  -- Fetch paginated deduplicated rows, then apply user sort
  SELECT json_agg(row_to_json(q)) INTO v_rows
  FROM (
    SELECT *
    FROM (
      SELECT DISTINCT ON (r.name, r.district)
             r.id, r.name, r.property_type, r.province, r.district, r.neighborhood,
             r.developer, r.price_thb, r.price_per_sqm, r.year_built, r.nbr_floors,
             r.rental_yield, r.near_transit, r.amenities, r.url,
             r.latitude, r.longitude, r.coord_accurate, r.text_content
      FROM public.rag_properties r
      WHERE
        (p_area IS NULL OR
          (v_district_filter IS NOT NULL AND r.district = v_district_filter) OR
          (v_district_filter IS NULL AND (
            r.district     ILIKE '%' || p_area || '%' OR
            r.neighborhood ILIKE '%' || p_area || '%' OR
            r.name         ILIKE '%' || p_area || '%'
          ))
        )
        AND (p_property_types IS NULL OR
             EXISTS (SELECT 1 FROM unnest(p_property_types) pt
                     WHERE r.property_type ILIKE '%' || pt || '%'))
        AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
        AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
        AND (NOT COALESCE(p_near_transit,FALSE) OR
             (r.near_transit IS NOT NULL AND r.near_transit <> ''))
        AND (p_min_year IS NULL OR r.year_built >= p_min_year)
        AND (NOT COALESCE(p_has_yield,FALSE) OR
             (r.rental_yield IS NOT NULL AND r.rental_yield > 0))
      ORDER BY r.name, r.district, r.id
    ) deduped
    ORDER BY
      CASE WHEN p_sort_by = 'price_asc'  THEN price_thb    END ASC  NULLS LAST,
      CASE WHEN p_sort_by = 'price_desc' THEN price_thb    END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'newest'     THEN year_built   END DESC NULLS LAST,
      CASE WHEN p_sort_by = 'yield'      THEN rental_yield END DESC NULLS LAST,
      price_thb ASC NULLS LAST
    LIMIT  COALESCE(p_limit,50)
    OFFSET v_offset
  ) q;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows,'[]'::json));
END;
$function$;


CREATE OR REPLACE FUNCTION public.rpc_fetch_map_pins(
  p_area            text    DEFAULT NULL,
  p_property_types  text[]  DEFAULT NULL,
  p_min_price       bigint  DEFAULT NULL,
  p_max_price       bigint  DEFAULT NULL,
  p_near_transit    boolean DEFAULT false,
  p_min_year        integer DEFAULT NULL,
  p_has_yield       boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows            JSON;
  v_area_lower      TEXT := lower(COALESCE(p_area,''));
  v_district_filter TEXT := NULL;
BEGIN
  v_district_filter := CASE v_area_lower
    WHEN 'asok'                     THEN 'Watthana'
    WHEN 'asoke'                    THEN 'Watthana'
    WHEN 'thonglor'                 THEN 'Watthana'
    WHEN 'thong lo'                 THEN 'Watthana'
    WHEN 'phrom phong'              THEN 'Watthana'
    WHEN 'phromphong'               THEN 'Watthana'
    WHEN 'ekkamai'                  THEN 'Watthana'
    WHEN 'ekamai'                   THEN 'Watthana'
    WHEN 'nana'                     THEN 'Watthana'
    WHEN 'sukhumvit'                THEN 'Watthana'
    WHEN 'phloen chit'              THEN 'Pathum Wan'
    WHEN 'phloenchit'               THEN 'Pathum Wan'
    WHEN 'siam'                     THEN 'Pathum Wan'
    WHEN 'chidlom'                  THEN 'Pathum Wan'
    WHEN 'chit lom'                 THEN 'Pathum Wan'
    WHEN 'pathum wan'               THEN 'Pathum Wan'
    WHEN 'pathumwan'                THEN 'Pathum Wan'
    WHEN 'silom'                    THEN 'Bang Rak'
    WHEN 'bang rak'                 THEN 'Bang Rak'
    WHEN 'bangrak'                  THEN 'Bang Rak'
    WHEN 'sathorn'                  THEN 'Sathon'
    WHEN 'sathon'                   THEN 'Sathon'
    WHEN 'on nut'                   THEN 'Phra Khanong'
    WHEN 'onnut'                    THEN 'Phra Khanong'
    WHEN 'udom suk'                 THEN 'Phra Khanong'
    WHEN 'udomsuk'                  THEN 'Phra Khanong'
    WHEN 'phra khanong'             THEN 'Phra Khanong'
    WHEN 'bearing'                  THEN 'Phra Khanong'
    WHEN 'samrong'                  THEN 'Phra Khanong'
    WHEN 'ratchada'                 THEN 'Huai Khwang'
    WHEN 'rama 9'                   THEN 'Huai Khwang'
    WHEN 'rama ix'                  THEN 'Huai Khwang'
    WHEN 'thailand cultural centre' THEN 'Huai Khwang'
    WHEN 'cultural centre'          THEN 'Huai Khwang'
    WHEN 'sutthisan'                THEN 'Huai Khwang'
    WHEN 'huai khwang'              THEN 'Huai Khwang'
    WHEN 'huaikhwang'               THEN 'Huai Khwang'
    WHEN 'ari'                      THEN 'Phaya Thai'
    WHEN 'aree'                     THEN 'Phaya Thai'
    WHEN 'saphan khwai'             THEN 'Phaya Thai'
    WHEN 'phaya thai'               THEN 'Phaya Thai'
    WHEN 'phayathai'                THEN 'Phaya Thai'
    WHEN 'victory monument'         THEN 'Ratchathewi'
    WHEN 'ratchathewi'              THEN 'Ratchathewi'
    WHEN 'mo chit'                  THEN 'Chatuchak'
    WHEN 'chatuchak'                THEN 'Chatuchak'
    WHEN 'kaset'                    THEN 'Chatuchak'
    WHEN 'lat phrao'                THEN 'Lat Phrao'
    WHEN 'ladprao'                  THEN 'Lat Phrao'
    WHEN 'bang na'                  THEN 'Bang Na'
    WHEN 'bangna'                   THEN 'Bang Na'
    WHEN 'bang sue'                 THEN 'Bang Sue'
    WHEN 'bangsue'                  THEN 'Bang Sue'
    WHEN 'khlong toei'              THEN 'Khlong Toei'
    WHEN 'khlongtoei'               THEN 'Khlong Toei'
    ELSE NULL
  END;

  SELECT json_agg(row_to_json(q)) INTO v_rows
  FROM (
    SELECT DISTINCT ON (r.name, r.district)
           r.id, r.name,
           r.latitude  AS lat,
           r.longitude AS lng,
           r.price_thb AS price,
           COALESCE(NULLIF(r.neighborhood,''), r.district, r.province, '') AS area_name
    FROM public.rag_properties r
    WHERE
      r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      AND (p_area IS NULL OR
            (v_district_filter IS NOT NULL AND r.district = v_district_filter) OR
            (v_district_filter IS NULL AND (
              r.district     ILIKE '%' || p_area || '%' OR
              r.neighborhood ILIKE '%' || p_area || '%' OR
              r.name         ILIKE '%' || p_area || '%'
            )))
      AND (p_property_types IS NULL OR
           EXISTS (SELECT 1 FROM unnest(p_property_types) pt
                   WHERE r.property_type ILIKE '%' || pt || '%'))
      AND (p_min_price IS NULL OR r.price_thb >= p_min_price)
      AND (p_max_price IS NULL OR r.price_thb <= p_max_price)
      AND (NOT COALESCE(p_near_transit,FALSE) OR
           (r.near_transit IS NOT NULL AND r.near_transit <> ''))
      AND (p_min_year IS NULL OR r.year_built >= p_min_year)
      AND (NOT COALESCE(p_has_yield,FALSE) OR
           (r.rental_yield IS NOT NULL AND r.rental_yield > 0))
    ORDER BY r.name, r.district, r.price_thb ASC NULLS LAST
    LIMIT 500
  ) q;

  RETURN COALESCE(v_rows, '[]'::json);
END;
$function$;
