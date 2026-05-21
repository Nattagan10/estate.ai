"""
Bangkok Bless Asset — Real Estate RAG Chatbot
Data source: Supabase (rag_properties table) — shared with estate.ai
"""

import os
import re
import json
import math
import hashlib
import urllib.request
import urllib.parse
from pathlib import Path

import numpy as np
import pandas as pd
import faiss
from FlagEmbedding import BGEM3FlagModel
import anthropic
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ──────────────────────────────────────────
# Config
# ──────────────────────────────────────────
BASE_DIR             = Path(__file__).parent
INDEX_PATH           = str(BASE_DIR / "real_estate.faiss")
METADATA_PATH        = str(BASE_DIR / "real_estate_meta.json")

TOP_K                = 10
SIMILARITY_THRESHOLD = 0.35
LOCATION_RADIUS_KM   = 20.0
LOCATION_RADIUS_WIDE = 35.0
MAX_HISTORY_TURNS    = 5
HAVERSINE_PREFETCH   = 1.6
SEMANTIC_FALLBACK_MAX_KM = 20.0

EMBED_BATCH_SIZE = 16
EMBED_MAX_LENGTH = 512

CLAUDE_MODEL    = "claude-sonnet-4-6"
LLM_TEMPERATURE = 0.0

AMENITY_COLS = [
    "Elevator", "Parking", "Security", "CCTV", "Pool",
    "Sauna", "Gym", "Garden", "Playground", "Shop", "Restaurant", "Wifi",
]


# ──────────────────────────────────────────
# Supabase client
# ──────────────────────────────────────────
def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
    return create_client(url, key)


# ──────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────
def _docs_hash(docs: list[dict]) -> str:
    h = hashlib.md5()
    h.update(json.dumps([d["id"] for d in docs], sort_keys=True).encode())
    return h.hexdigest()


def _s(x) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return " ".join(str(x).split()).strip()


# ──────────────────────────────────────────
# Load docs from Supabase
# ──────────────────────────────────────────
def load_docs_from_supabase(sb: Client) -> list[dict]:
    """Fetch all rows from rag_properties and build doc dicts."""
    print("[RAG] Loading properties from Supabase...")
    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        resp = (
            sb.table("rag_properties")
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = resp.data or []
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size

    docs: list[dict] = []
    for row in all_rows:
        amenities = row.get("amenities") or []
        if isinstance(amenities, str):
            try:
                amenities = json.loads(amenities)
            except Exception:
                amenities = []

        amenity_th = " ".join(amenities) if amenities else "ไม่ระบุ"
        amenity_en = ", ".join(amenities) if amenities else "none listed"
        nm = _s(row.get("name"))
        pt = _s(row.get("property_type")) or "Condo"
        pr = _s(row.get("province"))
        di = _s(row.get("district"))
        nb = _s(row.get("neighborhood"))
        dv = _s(row.get("developer"))
        pm = int(row.get("price_thb") or 0)
        ps = int(row.get("price_per_sqm") or 0)
        yb = int(row.get("year_built") or 0)
        nf = int(row.get("nbr_floors") or 0)
        ry = row.get("rental_yield")
        tr = _s(row.get("near_transit"))
        la = row.get("latitude")
        lo = row.get("longitude")
        ca = bool(row.get("coord_accurate"))

        text_content = row.get("text_content")
        if not text_content:
            th = (
                f"โครงการ {nm} ประเภท {pt} ย่าน {nb} เขต {di} จังหวัด {pr} "
                f"ราคาเริ่มต้น {pm:,} บาท ราคาเฉลี่ย {ps:,} บาท/ตร.ม. "
                f"สร้างปี {yb} จำนวน {nf} ชั้น สิ่งอำนวยความสะดวก: {amenity_th}"
                + (f" ใกล้รถไฟฟ้า {tr}" if tr else "")
                + (f" ผลตอบแทนเช่า {ry}%" if ry else "")
                + (f" โดย {dv}" if dv else "")
            )
            en = (
                f"{pt} project {nm} in {nb}, {di}, {pr}, "
                f"from {pm:,} THB, avg {ps:,} THB/sqm, built {yb}, {nf} floors, "
                f"amenities: {amenity_en}"
                + (f" near {tr}" if tr else "")
                + (f" rental yield {ry}%" if ry else "")
                + (f" by {dv}" if dv else "")
            )
            text_content = f"TH: {th} | EN: {en}"

        docs.append({
            "id":            row.get("id", f"DB-{len(docs)}"),
            "name":          nm,
            "type":          pt,
            "province":      pr,
            "district":      di,
            "neighborhood":  nb,
            "developer":     dv,
            "price_thb":     pm or ps,
            "price_per_sqm": ps,
            "year_built":    yb,
            "nbr_floors":    nf,
            "rental_yield":  ry,
            "near_transit":  tr or None,
            "amenities":     amenities,
            "url":           _s(row.get("url")),
            "latitude":      la,
            "longitude":     lo,
            "coord_accurate": ca,
            "text":          text_content,
        })

    print(f"[RAG] Loaded {len(docs):,} docs from Supabase")
    return docs


# ──────────────────────────────────────────
# Embed & Index (FAISS)
# ──────────────────────────────────────────
def _normalize(vecs: np.ndarray) -> np.ndarray:
    vecs = np.ascontiguousarray(vecs, dtype=np.float32)
    faiss.normalize_L2(vecs)
    return vecs


def build_index(model: BGEM3FlagModel, docs: list[dict], docs_hash: str) -> faiss.Index:
    print(f"[RAG-R] Embedding {len(docs):,} docs with BGE-M3...")
    texts      = [d["text"] for d in docs]
    embeddings = model.encode(
        texts, batch_size=EMBED_BATCH_SIZE, max_length=EMBED_MAX_LENGTH,
    )["dense_vecs"]
    embeddings = _normalize(np.asarray(embeddings))

    dim = embeddings.shape[1]
    idx = faiss.IndexFlatIP(dim)
    idx.add(embeddings)

    faiss.write_index(idx, INDEX_PATH)
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump({"docs_hash": docs_hash, "docs": docs}, f, ensure_ascii=False)
    print(f"[RAG-R] FAISS index saved ({len(docs):,} vectors, dim={dim})")
    return idx


def load_or_build_index(model: BGEM3FlagModel, docs: list[dict]) -> faiss.Index:
    docs_hash = _docs_hash(docs)

    if Path(INDEX_PATH).exists() and Path(METADATA_PATH).exists():
        with open(METADATA_PATH, encoding="utf-8") as f:
            saved = json.load(f)
        if saved.get("docs_hash") == docs_hash:
            print("[RAG-R] Loading cached FAISS index (data unchanged)...")
            return faiss.read_index(INDEX_PATH)

    print("[RAG-R] Data changed or index missing — rebuilding...")
    return build_index(model, docs, docs_hash)


# ──────────────────────────────────────────
# Semantic Retrieval
# ──────────────────────────────────────────
def retrieve_semantic(
    query: str,
    model: BGEM3FlagModel,
    idx: faiss.Index,
    docs: list[dict],
) -> list[tuple[dict, float]]:
    vec = model.encode([query], max_length=EMBED_MAX_LENGTH)["dense_vecs"]
    vec = _normalize(np.asarray(vec))
    scores, indices = idx.search(vec, k=TOP_K)
    results = [
        (docs[int(i)], float(s))
        for s, i in zip(scores[0], indices[0])
        if i != -1 and float(s) >= SIMILARITY_THRESHOLD
    ]
    results.sort(key=lambda x: x[0].get("price_thb") or float("inf"))
    return results


# ──────────────────────────────────────────
# Location-based Retrieval
# ──────────────────────────────────────────
_TH_LAT_MIN, _TH_LAT_MAX = 5.5, 20.5
_TH_LON_MIN, _TH_LON_MAX = 97.5, 105.7
_OSM_TYPE_SCORE = {"node": 2.0, "way": 1.0, "relation": 0.0}
_geocode_cache: dict[str, tuple | None] = {}

_NO_PLACE_RE = re.compile(
    r"^(?:"
    r"ขอบคุณ|โอเค|ได้เลย|ok|okay|thanks|thank you|"
    r"บอกอีก(?:ที)?|แสดงอีก|ดูอีก|show more|"
    r"อธิบาย(?:เพิ่มเติม)?|explain|tell me more|"
    r"ราคาเท่าไหร่|price\??|how much\??|"
    r"มีอะไรอีก|anything else|"
    r"ใช่|ไม่ใช่|yes|no|nope|yep"
    r")[\s?!.]*$",
    re.IGNORECASE,
)


def _in_thailand(lat: float, lon: float) -> bool:
    return _TH_LAT_MIN <= lat <= _TH_LAT_MAX and _TH_LON_MIN <= lon <= _TH_LON_MAX


def geocode_place(text: str) -> tuple[float, float, str, str] | None:
    if text in _geocode_cache:
        return _geocode_cache[text]

    lower = text.lower()
    queries = [text]
    if not any(x in lower for x in ["เชียงใหม่", "ภูเก็ต", "phuket", "chiang mai"]):
        queries.append(f"กรุงเทพมหานคร {text}")

    all_candidates: list[tuple[float, float, float, str, str]] = []
    for q in queries:
        params = urllib.parse.urlencode({
            "q": q, "format": "json", "limit": 10,
            "countrycodes": "th", "addressdetails": 0,
        })
        req = urllib.request.Request(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={"User-Agent": "BangkokBlessAsset-Chatbot/1.0", "Accept-Language": "th,en;q=0.9"},
        )
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read())
            for hit in data:
                lat = float(hit["lat"])
                lon = float(hit["lon"])
                if not _in_thailand(lat, lon):
                    continue
                osm_type   = hit.get("osm_type", "")
                importance = float(hit.get("importance", 0))
                score      = importance + _OSM_TYPE_SCORE.get(osm_type, 0.0)
                all_candidates.append((score, lat, lon, hit.get("display_name", ""), osm_type))
        except Exception:
            pass
        if all_candidates:
            break

    if not all_candidates:
        _geocode_cache[text] = None
        return None

    all_candidates.sort(key=lambda x: -x[0])
    _, lat, lon, display, osm_type = all_candidates[0]
    result = (lat, lon, display, osm_type)
    _geocode_cache[text] = result
    return result


def road_distance_batch(
    origin_lat: float, origin_lon: float,
    destinations: list[tuple[float, float]],
) -> list[float | None]:
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        return [None] * len(destinations)

    results: list[float | None] = []
    for i in range(0, len(destinations), 25):
        batch = destinations[i:i + 25]
        dest_str = "|".join(f"{lat},{lon}" for lat, lon in batch)
        params = urllib.parse.urlencode({
            "origins": f"{origin_lat},{origin_lon}",
            "destinations": dest_str,
            "mode": "driving",
            "key": api_key,
        })
        req = urllib.request.Request(
            f"https://maps.googleapis.com/maps/api/distancematrix/json?{params}",
            headers={"User-Agent": "BangkokBlessAsset-Chatbot/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            elements = data.get("rows", [{}])[0].get("elements", [])
            for elem in elements:
                if elem.get("status") == "OK":
                    results.append(elem["distance"]["value"] / 1000.0)
                else:
                    results.append(None)
        except Exception:
            results.extend([None] * len(batch))
    return results


def extract_place_name(query: str, llm: anthropic.Anthropic) -> str:
    if _NO_PLACE_RE.match(query.strip()):
        return ""
    resp = llm.messages.create(
        model=CLAUDE_MODEL, max_tokens=40, temperature=0,
        system=(
            "Extract ONLY the place name, landmark, BTS/MRT station, "
            "shopping mall, hospital, district, or area from the user message. "
            "Return ONLY the place name in its original language (Thai or English). "
            "If no specific place is mentioned, return empty string."
        ),
        messages=[{"role": "user", "content": query}],
    )
    return resp.content[0].text.strip()


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R    = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a    = (math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def retrieve_by_location(
    place_name: str, docs: list[dict], radius_km: float = LOCATION_RADIUS_KM,
) -> tuple[list[tuple[dict, float]], str | None, str, tuple[float, float] | None]:
    if not place_name:
        return [], None, "เส้นตรง", None
    result = geocode_place(place_name)
    if not result:
        return [], None, "เส้นตรง", None
    lat, lon, display_name, osm_type = result

    accuracy_note = {
        "node": "precise point", "way": "building centroid (±100–300 m)",
        "relation": "area centroid (±500 m–2 km)",
    }.get(osm_type, "unknown accuracy")

    prefetch_r = radius_km * HAVERSINE_PREFETCH
    candidates = []
    for doc in docs:
        if not doc.get("coord_accurate"):
            continue
        dlat, dlon = doc.get("latitude"), doc.get("longitude")
        if dlat is None or dlon is None:
            continue
        if not _in_thailand(dlat, dlon):
            continue
        if haversine(lat, lon, dlat, dlon) <= prefetch_r:
            candidates.append((doc, dlat, dlon))

    api_key   = os.getenv("GOOGLE_MAPS_API_KEY", "")
    use_road  = bool(api_key and api_key != "your_key_here")
    dist_label = "ถนน" if use_road else "เส้นตรง"

    if use_road and candidates:
        dests      = [(dlat, dlon) for _, dlat, dlon in candidates]
        road_dists = road_distance_batch(lat, lon, dests)
    else:
        road_dists = [None] * len(candidates)

    nearby: list[tuple[dict, float]] = []
    for (doc, dlat, dlon), road_d in zip(candidates, road_dists):
        dist = road_d if road_d is not None else haversine(lat, lon, dlat, dlon)
        if dist <= radius_km:
            nearby.append((doc, dist))

    nearby.sort(key=lambda x: (x[0].get("price_thb") or float("inf"), x[1]))
    context_note = (
        f"Geocoded '{place_name}' as: {display_name[:120]}"
        f" | geometry={osm_type} ({accuracy_note})"
        f" | ref_point=({lat:.6f}, {lon:.6f}) | radius={radius_km} km"
    )
    return nearby, context_note, dist_label, (lat, lon)


# ──────────────────────────────────────────
# System Prompt
# ──────────────────────────────────────────
SYSTEM_PROMPT = """\
You are a bilingual (Thai/English) real estate assistant for Bangkok Bless Asset.

Rules:
1. Detect the user's language — reply in the same language.
2. Use ONLY the provided listing context. Never fabricate data.
3. Present listings sorted cheapest → most expensive (top 10).
4. LOCATION SEARCH: When the user mentions any place name, the system geocodes it and
   finds listings within a 20 km radius (or 35 km fallback).
   • State the reference point at the top: "📍 จุดอ้างอิง: [place] (lat=X, lon=Y)"
   • Show distances as "X.XX km (ถนน)" or "X.XX km (เส้นตรง)"
   • If context has HINT_EXTRA, mention extra listings exist but don't show details.
5. SEMANTIC SEARCH: When no place name detected, use BGE-M3 vector similarity.
6. For every listing show: Name & type, Location, Price, Transit, Amenities,
   Coordinates 📍 lat=X lon=Y (MANDATORY), Distance (location mode only).
7. If nothing matches, suggest refining the search.
8. If user says reference point is wrong, ask for the full place name before retrying.

คุณคือผู้ช่วยอสังหาฯ ของ Bangkok Bless Asset พูดได้ทั้งไทย-อังกฤษ ตอบด้วยภาษาเดียวกับลูกค้า
"""


def _format_listing(rank: int, doc: dict, value: float, mode: str, dist_label: str = "เส้นตรง") -> str:
    tag   = f"{value:.2f} km ({dist_label})" if mode == "location" else f"score={value:.3f}"
    price = f"฿{doc['price_thb']:,}" if doc.get("price_thb") else "-"
    sqm   = f"฿{doc['price_per_sqm']:,}/sqm" if doc.get("price_per_sqm") else ""
    loc   = ", ".join(x for x in [doc.get("neighborhood"), doc.get("district"), doc.get("province")] if x)
    parts = [
        f"[{rank}] {doc.get('name') or '-'} ({tag})",
        f"type={doc.get('type', '-')}",
        f"loc={loc}" if loc else "",
        f"price={price}", sqm,
        f"built={doc['year_built']}" if doc.get("year_built") else "",
        f"near {doc['near_transit']}" if doc.get("near_transit") else "",
        f"amenities={','.join(doc['amenities'])}" if doc.get("amenities") else "",
        f"yield={doc['rental_yield']}%" if doc.get("rental_yield") else "",
        f"by {doc['developer']}" if doc.get("developer") else "",
        f"url={doc['url']}" if doc.get("url") else "",
        (f"coords=({doc['latitude']:.6f}, {doc['longitude']:.6f})"
         if doc.get("latitude") is not None and doc.get("longitude") is not None else ""),
    ]
    return " | ".join(p for p in parts if p)


def build_rag_context(results: list[tuple], mode: str, geocoded_place: str | None = None, dist_label: str = "เส้นตรง") -> str:
    if not results:
        return "No matching listings found. / ไม่พบรายการที่ตรงกับเงื่อนไข"
    header = geocoded_place or ""
    rows   = "\n".join(_format_listing(i, d, v, mode, dist_label) for i, (d, v) in enumerate(results, 1))
    parts  = [p for p in [header, rows] if p]
    return "\n".join(parts)


# ──────────────────────────────────────────
# RAG Chat
# ──────────────────────────────────────────
def rag_chat(
    user_query: str,
    history: list[dict],
    embed_model: BGEM3FlagModel,
    idx: faiss.Index,
    docs: list[dict],
    llm: anthropic.Anthropic,
) -> tuple[str, list[tuple], str]:
    place_name = extract_place_name(user_query, llm)
    location_results, geocoded_place, dist_label, ref_point = retrieve_by_location(place_name, docs)

    extra_count = 0
    if place_name and location_results:
        wide_all, _, _, _ = retrieve_by_location(place_name, docs, radius_km=LOCATION_RADIUS_WIDE)
        extra_count = max(0, len(wide_all) - len(location_results))
        if extra_count > 0 and geocoded_place:
            geocoded_place += f" | HINT_EXTRA: มีอีก {extra_count} โครงการในรัศมี {LOCATION_RADIUS_WIDE} กม."

    if location_results:
        results = location_results[:TOP_K]
        mode    = "location"
    else:
        semantic_results = retrieve_semantic(user_query, embed_model, idx, docs)
        api_key  = os.getenv("GOOGLE_MAPS_API_KEY", "")
        use_road = bool(api_key and api_key != "your_key_here")

        if ref_point and semantic_results:
            ref_lat, ref_lon = ref_point
            dist_label = "ถนน" if use_road else "เส้นตรง"
            with_coords = [(doc, s) for doc, s in semantic_results if doc.get("latitude") and doc.get("longitude")]
            if use_road and with_coords:
                dests     = [(doc["latitude"], doc["longitude"]) for doc, _ in with_coords]
                road_dsts = road_distance_batch(ref_lat, ref_lon, dests)
                results   = []
                for (doc, _), rd in zip(with_coords, road_dsts):
                    dist = rd if rd is not None else haversine(ref_lat, ref_lon, doc["latitude"], doc["longitude"])
                    if dist <= SEMANTIC_FALLBACK_MAX_KM:
                        results.append((doc, dist))
            else:
                results = [
                    (doc, haversine(ref_lat, ref_lon, doc["latitude"], doc["longitude"]))
                    for doc, _ in with_coords
                    if haversine(ref_lat, ref_lon, doc["latitude"], doc["longitude"]) <= SEMANTIC_FALLBACK_MAX_KM
                ]
            results = results[:TOP_K]
            mode    = "location"
        else:
            results        = semantic_results
            mode           = "semantic"
            geocoded_place = None
            dist_label     = "เส้นตรง"

    context = build_rag_context(results, mode, geocoded_place, dist_label)
    claude_history = [
        {"role": msg["role"], "content": msg["content"]}
        for msg in history[-(MAX_HISTORY_TURNS * 2):]
    ]
    resp = llm.messages.create(
        model=CLAUDE_MODEL, max_tokens=4096, temperature=LLM_TEMPERATURE,
        system=SYSTEM_PROMPT + f"\n\n[RAG context — {mode}]\n{context}",
        messages=[*claude_history, {"role": "user", "content": user_query}],
    )
    return resp.content[0].text, results, mode


# ──────────────────────────────────────────
# Pipeline initialiser
# ──────────────────────────────────────────
def init_pipeline() -> dict:
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise EnvironmentError("Set ANTHROPIC_API_KEY in .env")

    sb = get_supabase()
    docs = load_docs_from_supabase(sb)
    if not docs:
        raise RuntimeError("No data found in rag_properties table. Run import_to_supabase.py first.")

    print("Loading BGE-M3... (first run downloads ~2.3 GB)")
    embed_model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)
    faiss_index = load_or_build_index(embed_model, docs)
    llm_client  = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    return {"embed_model": embed_model, "idx": faiss_index, "docs": docs, "llm": llm_client}
