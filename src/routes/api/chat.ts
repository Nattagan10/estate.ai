import { createFileRoute } from "@tanstack/react-router";
import { searchPropertiesServer, type SearchFilters } from "@/functions/properties";
import { rowToProperty, type DbPropertyRow, type Property } from "@/shared/data/properties";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import Anthropic from "@anthropic-ai/sdk";

// ─── BTS / MRT / Landmark coordinate lookup ──────────────────────────────────
// Key = canonical name (English), values = Thai/EN aliases + coords
const STATION_COORDS: { names: string[]; lat: number; lng: number }[] = [
  // BTS Sukhumvit Line
  { names: ["National Stadium","national stadium","สนามกีฬาแห่งชาติ","สนามกีฬา"], lat: 13.7464, lng: 100.5294 },
  { names: ["Siam","สยาม","สยามสแควร์","siam square"], lat: 13.7459, lng: 100.5344 },
  { names: ["Chit Lom","chitlom","chidlom","ชิดลม","เซ็นทรัล ชิดลม"], lat: 13.7430, lng: 100.5405 },
  { names: ["Phloen Chit","phloenchit","เพลินจิต","เพลินจิตต์"], lat: 13.7408, lng: 100.5475 },
  { names: ["Nana","นานา"], lat: 13.7399, lng: 100.5558 },
  { names: ["Asok","asoke","อโศก","อโศก","sukhumvit mrt","สุขุมวิท mrt","terminal 21","เทอร์มินอล 21"], lat: 13.7374, lng: 100.5602 },
  { names: ["Phrom Phong","phromphong","พร้อมพงษ์","emquartier","เอ็มควอเทียร์","emporium","เอ็มโพเรียม"], lat: 13.7307, lng: 100.5694 },
  { names: ["Thong Lo","thonglor","ทองหล่อ"], lat: 13.7253, lng: 100.5780 },
  { names: ["Ekkamai","ekamai","เอกมัย"], lat: 13.7198, lng: 100.5850 },
  { names: ["Phra Khanong","phrakhanong","พระโขนง"], lat: 13.7154, lng: 100.5914 },
  { names: ["On Nut","onnut","อ่อนนุช"], lat: 13.7026, lng: 100.6010 },
  { names: ["Udom Suk","udomsuk","อุดมสุข"], lat: 13.6946, lng: 100.6091 },
  { names: ["Bang Na","bangna","บางนา"], lat: 13.6870, lng: 100.6161 },
  { names: ["Bearing","แบริ่ง"], lat: 13.6741, lng: 100.6227 },
  { names: ["Samrong","สำโรง"], lat: 13.6622, lng: 100.6170 },
  // BTS Silom Line
  { names: ["Ratchadamri","ราชดำริ","เซ็นทรัลเวิลด์","central world","centralworld"], lat: 13.7467, lng: 100.5392 },
  { names: ["Sala Daeng","saladaeng","ศาลาแดง"], lat: 13.7282, lng: 100.5345 },
  { names: ["Chong Nonsi","chongnonsi","ช่องนนทรี"], lat: 13.7228, lng: 100.5231 },
  { names: ["Surasak","สุรศักดิ์"], lat: 13.7237, lng: 100.5197 },
  { names: ["Saphan Taksin","สะพานตากสิน","taksin","ตากสิน"], lat: 13.7185, lng: 100.5136 },
  { names: ["Wongwian Yai","วงเวียนใหญ่"], lat: 13.7218, lng: 100.4966 },
  { names: ["Bang Wa","บางหว้า"], lat: 13.7232, lng: 100.4611 },
  // BTS North
  { names: ["Ratchathewi","ราชเทวี"], lat: 13.7527, lng: 100.5331 },
  { names: ["Phaya Thai","พญาไท","payathai"], lat: 13.7576, lng: 100.5336 },
  { names: ["Ari","อารีย์","aree"], lat: 13.7761, lng: 100.5435 },
  { names: ["Saphan Khwai","สะพานควาย"], lat: 13.7936, lng: 100.5521 },
  { names: ["Mo Chit","หมอชิต","chatuchak park","จตุจักร","จัตุจักร"], lat: 13.8025, lng: 100.5537 },
  // MRT Blue Line
  { names: ["Hua Lamphong","หัวลำโพง"], lat: 13.7388, lng: 100.5161 },
  { names: ["Sam Yan","สามย่าน"], lat: 13.7333, lng: 100.5246 },
  { names: ["Silom","สีลม","silom mrt"], lat: 13.7282, lng: 100.5288 },
  { names: ["Lumphini","ลุมพินี","lumpini"], lat: 13.7245, lng: 100.5412 },
  { names: ["Khlong Toei","khlongtoei","คลองเตย"], lat: 13.7214, lng: 100.5546 },
  { names: ["Queen Sirikit","ศิริกิติ์","queen sirikit"], lat: 13.7232, lng: 100.5590 },
  { names: ["Phetchaburi","เพชรบุรี"], lat: 13.7471, lng: 100.5699 },
  { names: ["Rama 9","พระราม 9","พระรามเก้า","rama9"], lat: 13.7560, lng: 100.5619 },
  { names: ["Thailand Cultural Centre","ศูนย์วัฒนธรรม","cultural centre"], lat: 13.7567, lng: 100.5700 },
  { names: ["Huai Khwang","ห้วยขวาง"], lat: 13.7677, lng: 100.5726 },
  { names: ["Sutthisan","สุทธิสาร"], lat: 13.7775, lng: 100.5726 },
  { names: ["Ratchadaphisek","รัชดาภิเษก","รัชดา"], lat: 13.7945, lng: 100.5692 },
  { names: ["Lat Phrao","ลาดพร้าว","ladprao"], lat: 13.8112, lng: 100.5618 },
  { names: ["Bang Sue","บางซื่อ"], lat: 13.8028, lng: 100.5406 },
  { names: ["Victory Monument","อนุสาวรีย์ชัยสมรภูมิ","อนุสาวรีย์","วิคตอรี่"], lat: 13.7640, lng: 100.5374 },
  { names: ["Chatuchak","จตุจักร","จัตุจักร","JJ market","ตลาดนัดจตุจักร"], lat: 13.7998, lng: 100.5499 },
  // Landmarks
  { names: ["สยาม พารากอน","paragon","siam paragon"], lat: 13.7463, lng: 100.5348 },
  { names: ["สาทร","sathorn","สาทรใต้"], lat: 13.7220, lng: 100.5253 },
  { names: ["ลาดพร้าว 71","ลาดพร้าว71"], lat: 13.7950, lng: 100.5840 },
  { names: ["สุวรรณภูมิ","suvarnabhumi airport","สนามบินสุวรรณภูมิ"], lat: 13.6900, lng: 100.7501 },
  { names: ["ดอนเมือง","don mueang","สนามบินดอนเมือง"], lat: 13.9126, lng: 100.6066 },
];

function lookupStation(query: string): { lat: number; lng: number; name: string } | null {
  const q = query.toLowerCase().trim();
  for (const s of STATION_COORDS) {
    if (s.names.some((n) => q.includes(n.toLowerCase()) || n.toLowerCase().includes(q))) {
      return { lat: s.lat, lng: s.lng, name: s.names[0] };
    }
  }
  return null;
}

/** Haversine distance in meters between two lat/lng points */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)));
}

function fmtDist(m: number): string {
  return m < 1000 ? `${m} เมตร` : `${(m / 1000).toFixed(1)} กิโลเมตร`;
}

async function geocodePlace(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  // 1. Try hardcoded station/landmark table first (fast + free)
  const station = lookupStation(query);
  if (station) return station;

  // 2. Fall back to Google Maps Geocoding API
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + " Bangkok Thailand")}&key=${apiKey}&language=th&region=th`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const loc = data?.results?.[0]?.geometry?.location;
    const formattedName = data?.results?.[0]?.formatted_address ?? query;
    if (loc && loc.lat && loc.lng) {
      // Sanity check: must be in Thailand
      if (loc.lat >= 5 && loc.lat <= 21 && loc.lng >= 97 && loc.lng <= 106) {
        return { lat: loc.lat, lng: loc.lng, name: formattedName };
      }
    }
  } catch { /* noop */ }
  return null;
}

type RagResult = {
  properties: Property[];
  total: number;
  mode: string;
  answer?: string;  // Ready-made Claude answer from Python service (includes distance info)
};

async function searchWithRAG(
  query: string,
  history: Msg[],
): Promise<RagResult | null> {
  const base = process.env.RAG_SERVICE_URL;
  if (!base) return null;
  try {
    // Call POST /chat — the real endpoint in app.py
    const resp = await fetch(`${base}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal: AbortSignal.timeout(20000), // geocoding + Claude can take up to 15s
    });
    if (!resp.ok) return null;

    const data = await resp.json() as {
      answer: string;
      mode: string;
      sources: Array<{
        name?: string;
        type?: string;
        district?: string;
        province?: string;
        price_thb?: number;
        latitude?: number;
        longitude?: number;
        distance_km?: number;
        url?: string;
      }>;
    };

    // Convert RAG sources → full Property shape for the map
    const ts = Date.now();
    const properties: Property[] = (data.sources ?? []).map((s, i) => {
      const district = s.district ?? "";
      const province = s.province ?? "";
      return {
        id: `rag-${i}-${ts}`,
        name: s.name ?? "",
        description: "",
        price: s.price_thb ?? 0,
        listingType: "sale" as const,
        propertyType: (["condo","house","townhouse","commercial"].includes(
          (s.type ?? "").toLowerCase()
        ) ? (s.type ?? "condo").toLowerCase() : "condo") as Property["propertyType"],
        bedrooms: 0,
        bathrooms: 0,
        area: 0,
        area_name: [district, province].filter(Boolean).join(", "),
        lat: s.latitude ?? 13.7563,
        lng: s.longitude ?? 100.5018,
        address: [district, province].filter(Boolean).join(", "),
        image: "",
        availability: "available" as const,
        nearby: [],
        tags: [],
        province,
        district,
        neighborhood: "",
        developer: "",
        price_per_sqm: 0,
        year_built: 0,
        nbr_floors: 0,
        rental_yield: null,
        near_transit: null,
        url: s.url ?? "",
        distance_m: s.distance_km != null ? Math.round(s.distance_km * 1000) : null,
      };
    });

    return {
      properties,
      total: properties.length,
      mode: data.mode ?? "semantic",
      answer: data.answer,
    };
  } catch {
    return null;
  }
}

type Msg = { role: "user" | "assistant"; content: string };
type ReqBody = { messages: Msg[]; filters?: SearchFilters; sessionId?: string | null };

type ExtractionResult = {
  filters: SearchFilters;
  resetRequested: boolean;
  name?: string;
  phone?: string;
  age?: number;
  purpose?: string;
};

const THAI_DIGITS: Record<string, number> = {
  หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5,
  หก: 6, เจ็ด: 7, แปด: 8, เก้า: 9, สิบ: 10,
  ยี่สิบ: 20, สามสิบ: 30, สี่สิบ: 40, ห้าสิบ: 50,
};

function parseBudget(text: string): number | null {
  const t = text.toLowerCase();
  const dw = Object.keys(THAI_DIGITS).join("|");

  // 1. Numeric M/m suffix: "1.5M", "3m", "2.5 M"
  const mNum = t.match(/\b(\d+(?:\.\d+)?)\s*m\b/i);
  if (mNum) return parseFloat(mNum[1]) * 1_000_000;

  // 2. Thai million patterns: สองล้าน, ล้านครึ่ง, สองล้านห้า, สามล้านห้าแสน
  const lRx = new RegExp(
    `(${dw}|\\d+(?:\\.\\d+)?)?\\s*ล้าน(ครึ่ง|(${dw}|\\d+(?:\\.\\d+)?)\\s*(แสน|หมื่น|พัน)?)?`
  );
  const lMatch = t.match(lRx);
  if (lMatch) {
    const whole = lMatch[1] ? (THAI_DIGITS[lMatch[1]] ?? parseFloat(lMatch[1]) ?? 1) : 1;
    let frac = 0;
    if (lMatch[2] === "ครึ่ง") {
      frac = 500_000;
    } else if (lMatch[3]) {
      const n = THAI_DIGITS[lMatch[3]] ?? parseFloat(lMatch[3]) ?? 0;
      const unit = lMatch[4];
      frac = n * (unit === "แสน" ? 100_000 : unit === "หมื่น" ? 10_000 : unit === "พัน" ? 1_000 : 100_000);
    }
    return whole * 1_000_000 + frac;
  }

  // 3. Thai แสน patterns: ห้าแสน=500k, สามแสน=300k
  const sRx = new RegExp(`(${dw}|\\d+)\\s*แสน`);
  const sMatch = t.match(sRx);
  if (sMatch) {
    const n = THAI_DIGITS[sMatch[1]] ?? parseFloat(sMatch[1]) ?? 0;
    return n * 100_000;
  }

  // 4. Thai หมื่น patterns: ห้าหมื่น=50k
  const hmRx = new RegExp(`(${dw}|\\d+)\\s*หมื่น`);
  const hmMatch = t.match(hmRx);
  if (hmMatch) {
    const n = THAI_DIGITS[hmMatch[1]] ?? parseFloat(hmMatch[1]) ?? 0;
    return n * 10_000;
  }

  // 5. Legacy numeric patterns
  const numMatch =
    t.match(/(?:under|max|<|ไม่เกิน|งบ|budget|ราคา)[\s:=]*([\d,]+)[k,]*(\d*)/i) ||
    t.match(/\b(\d{1,3}(?:,\d{3})+)\b/) ||
    t.match(/\b(\d{2,})k\b/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*万/);
  if (numMatch) {
    let valStr = numMatch[1];
    if (numMatch[2]) valStr += numMatch[2];
    valStr = valStr.replace(/,/g, "");
    let val = parseFloat(valStr);
    if (t.includes(valStr + "k") || val < 1000) val *= 1000;
    if (t.includes("万")) val *= 10_000;
    if (val > 0) return val;
  }

  return null;
}

function localExtractFilters(text: string): ExtractionResult {
  const t = text.toLowerCase();
  const next: SearchFilters = {};
  let resetRequested = false;
  let name: string | undefined;
  let phone: string | undefined;
  let age: number | undefined;
  let purpose: string | undefined;

  if (
    t.match(/\b(clear|reset|any)\b/i) ||
    t.includes("ล้าง") ||
    t.includes("清除") ||
    t.includes("クリア") ||
    t.includes("show me something else") ||
    t.includes("หาแบบอื่น") ||
    t.includes("ขอดูที่อื่น") ||
    t.includes("ที่อื่น") ||
    t.includes("เอาแบบอื่น") ||
    t.includes("ไม่เอา") ||
    t.includes("เปลี่ยน")
  ) {
    resetRequested = true;
  }

  const areaMapping: Record<string, string[]> = {
    // ---- BTS/MRT corridors ----
    Asok: ["asok", "asoke", "อโศก", "สุขุมวิท", "sukhumvit", "阿索克", "アソーク"],
    Thonglor: ["thonglor", "thong lo", "ทองหล่อ", "通罗", "トンロー"],
    "Phrom Phong": ["phrom phong", "phromphong", "พร้อมพงษ์", "澎蓬", "プロンポン"],
    Ekkamai: ["ekkamai", "ekamai", "เอกมัย", "伊卡迈", "エカマイ"],
    Silom: ["silom", "สีลม", "是隆", "シーロム"],
    Sathorn: ["sathorn", "sathon", "สาทร", "沙吞", "サトーン"],
    Siam: ["siam", "สยาม", "暹罗", "サイアム"],
    Chidlom: ["chidlom", "chit lom", "ชิดลม", "奇隆", "チットロム"],
    Ari: ["ari", "aree", "อารีย์", "阿里", "アーリー"],
    Kaset: ["kaset", "เกษตร"],
    Ratchada: ["ratchada", "รัชดา", "拉差达", "ラチャダー"],
    Ramkhamhaeng: ["ramkhamhaeng", "รามคำแหง", "蓝康恒", "ラムカムヘン"],
    "On Nut": ["on nut", "onnut", "อ่อนนุช", "安努", "オンヌット"],
    "Udom Suk": ["udom suk", "udomsuk", "อุดมสุข", "乌东素", "ウドムスック"],
    "Phaya Thai": ["phaya thai", "phayathai", "พญาไท", "帕亚泰", "パヤタイ"],
    Ratchathewi: ["ratchathewi", "ราชเทวี", "拉差贴威", "ラチャテーウィー"],
    Nana: ["nana", "นานา", "娜娜", "ナナ"],
    "Phloen Chit": ["phloen chit", "phloenchit", "เพลินจิต", "奔集", "プルンチット"],
    Bearing: ["bearing", "แบริ่ง", "白岭", "ベーリング"],
    Samrong: ["samrong", "สำโรง", "三榕", "サムロン"],
    "Rama 9": ["rama 9", "rama ix", "พระราม 9", "พระรามเก้า", "拉玛九", "ラマ9"],
    "Thailand Cultural Centre": ["cultural centre", "ศูนย์วัฒนธรรม", "文化中心"],
    Sutthisan: ["sutthisan", "สุทธิสาร", "素提讪", "スティサン"],
    "Saphan Khwai": ["saphan khwai", "สะพานควาย", "水牛桥", "サパーンクワーイ"],
    "Mo Chit": ["mo chit", "หมอชิต", "蒙奇", "モーチット"],
    "Victory Monument": ["victory monument", "อนุสาวรีย์", "ชัยสมรภูมิ", "胜利纪念碑", "戦勝記念塔"],

    // ---- Bangkok districts (often no BTS) ----
    "Bang Na": ["bang na", "bangna", "บางนา", "バンナー"],
    "Lat Phrao": ["lat phrao", "ladprao", "ลาดพร้าว", "拉普绕", "ラップラーオ"],
    "Huai Khwang": ["huai khwang", "huaikhwang", "ห้วยขวาง", "フワイクワーン"],
    "Bang Sue": ["bang sue", "bangsue", "บางซื่อ", "バンスー"],
    Chatuchak: ["chatuchak", "จตุจักร", "乍都节", "チャトゥチャック"],
    "Bang Kapi": ["bang kapi", "bangkapi", "บางกะปิ", "バンカピ"],
    "Phra Khanong": ["phra khanong", "พระโขนง", "プラカノン"],
    "Bang Khae": ["bang khae", "bangkhae", "บางแค", "ซีคอน", "seacon", "ซีคอนบางแค", "seacon bangkhae"],
    Prawet: ["prawet", "ประเวศ"],
    "Bang Khen": ["bang khen", "bangkhen", "บางเขน"],
    "Sai Mai": ["sai mai", "saimai", "สายไหม"],
    "Lak Si": ["lak si", "laksi", "หลักสี่"],
    "Don Mueang": ["don mueang", "donmueang", "ดอนเมือง"],
    "Min Buri": ["min buri", "minburi", "มีนบุรี"],
    "Lat Krabang": ["lat krabang", "latkrabang", "ลาดกระบัง"],
    "Bueng Kum": ["bueng kum", "buengkum", "บึงกุ่ม"],
    "Khlong Sam Wa": ["khlong sam wa", "khlongsamwa", "คลองสามวา"],
    Thonburi: ["thonburi", "ธนบุรี"],
    "Bangkok Noi": ["bangkok noi", "bangkoknoi", "บางกอกน้อย"],
    "Taling Chan": ["taling chan", "talingchan", "ตลิ่งชัน"],
    "Yan Nawa": ["yan nawa", "yannawa", "ยานนาวา"],
    "Bang Rak": ["bang rak", "bangrak", "บางรัก"],
    "Khlong Toei": ["khlong toei", "khlongtoei", "คลองเตย"],
    "Bang Bon": ["bang bon", "bangbon", "บางบอน"],
    "Rat Burana": ["rat burana", "ratburana", "ราษฎร์บูรณะ"],
    "Chom Thong": ["chom thong", "chomthong", "จอมทอง"],
    "Wang Thong Lang": ["wang thong lang", "วังทองหลาง"],
    "Khan Na Yao": ["khan na yao", "คันนายาว"],
    Dusit: ["dusit", "ดุสิต"],
    "Pathum Wan": ["pathum wan", "pathumwan", "ปทุมวัน"],
    "Pom Prap": ["pom prap", "phra nakhon", "ป้อมปราบ", "พระนคร"],

    // ---- Greater Bangkok / provinces ----
    "Bang Lamung": ["bang lamung", "banglamung", "บางละมุง", "pattaya", "พัทยา", "พัทยา"],
    "Si Racha": ["si racha", "sriracha", "ศรีราชา"],
    "Mueang Chon Buri": ["chon buri", "chonburi", "ชลบุรี", "เมืองชลบุรี"],
    "Mueang Nonthaburi": ["nonthaburi", "นนทบุรี", "เมืองนนทบุรี"],
    "Mueang Chiang Mai": ["chiang mai", "chiangmai", "เชียงใหม่", "เมืองเชียงใหม่"],
    "Mueang Phuket": ["phuket", "ภูเก็ต", "เมืองภูเก็ต"],
    "Pak Kret": ["pak kret", "pakret", "ปากเกร็ด"],
    "Bang Bua Thong": ["bang bua thong", "bangbuathong", "บางบัวทอง"],
    "Lam Luk Ka": ["lam luk ka", "lamлукka", "ลำลูกกา"],
    "Bang Phli": ["bang phli", "bangphli", "บางพลี"],
    "Bang Kruai": ["bang kruai", "bangkruai", "บางกรวย"],
    "Khlong Luang": ["khlong luang", "khlongluang", "คลองหลวง"],
    "Hat Yai": ["hat yai", "hatyai", "หาดใหญ่"],
    "Hua Hin": ["hua hin", "huahin", "หัวหิน"],
    "Mueang Rayong": ["rayong", "ระยอง", "เมืองระยอง"],
    Thanyaburi: ["thanyaburi", "thanya buri", "ธัญบุรี"],
    "Bang Yai": ["bang yai", "bangyai", "บางใหญ่"],
    "Mueang Samut Prakan": ["samut prakan", "สมุทรปราการ", "เมืองสมุทรปราการ"],
    "Mueang Khon Kaen": ["khon kaen", "ขอนแก่น", "เมืองขอนแก่น"],
    "Mueang Nakhon Ratchasima": ["nakhon ratchasima", "korat", "โคราช", "นครราชสีมา", "เมืองนครราชสีมา"],
    Thalang: ["thalang", "ถลาง"],
    "San Sai": ["san sai", "sansai", "สันทราย"],
    "Mueang Samut Sakhon": ["samut sakhon", "สมุทรสาคร", "เมืองสมุทรสาคร"],
    "Mueang Pathum Thani": ["pathum thani", "ปทุมธานี", "เมืองปทุมธานี"],
    Rangsit: ["rangsit", "รังสิต"],
  };

  for (const [canonicalArea, keywords] of Object.entries(areaMapping)) {
    if (keywords.some((k) => t.includes(k))) {
      next.area = canonicalArea;
      break;
    }
  }

  if (
    t.includes("condo") ||
    t.includes("apartment") ||
    t.includes("คอนโด") ||
    t.includes("公寓") ||
    t.includes("マンション") ||
    t.includes("コンドミニアム")
  )
    next.propertyType = "condo";
  else if (
    t.includes("house") ||
    t.includes("home") ||
    t.includes("บ้าน") ||
    t.includes("别墅") ||
    t.includes("一軒家")
  )
    next.propertyType = "house";
  else if (
    t.includes("townhouse") ||
    t.includes("ทาวน์เฮ้าส์") ||
    t.includes("联排") ||
    t.includes("タウンハウス")
  )
    next.propertyType = "townhouse";
  else if (
    t.includes("commercial") ||
    t.includes("พาณิชย์") ||
    t.includes("商业") ||
    t.includes("商業")
  )
    next.propertyType = "commercial";

  const budget = parseBudget(text);
  if (budget !== null && budget > 0) next.maxPrice = budget;

  if (t.match(/\b(bts|mrt|transit|train|รถไฟฟ้า|地铁|駅)\b/i) || t.includes("รถไฟ"))
    next.nearTransit = true;

  // Age
  const ageMatch =
    t.match(/\b(?:อายุ|age)[\s:]*(\d{1,2})\b/) ||
    t.match(/\b(\d{1,2})\s*(?:ขวบ|ปี|years old|yo|岁)\b/);
  if (ageMatch) age = parseInt(ageMatch[2] || ageMatch[1], 10);

  // Purpose
  if (t.match(/\b(invest|investment|ลงทุน|เก็งกำไร|投资)\b/i)) purpose = "investment";
  else if (t.match(/\b(live|living|อยู่เอง|พักอาศัย|自住)\b/i)) purpose = "living";

  // Name (Very basic heuristic)
  const nameMatch = text.match(/(?:my name is|i am|ฉันชื่อ|ชื่อ|เรียก|叫)[\s]*([A-Za-zก-๙]{2,15})\b/i);
  if (nameMatch) name = nameMatch[1];

  // Phone
  const phoneMatch = text.match(/(?:0|\+66)\s?\d{2,3}[-\s]?\d{3}[-\s]?\d{3,4}/);
  if (phoneMatch) phone = phoneMatch[0];

  // Lat/Lng — patterns: (13.xxxx, 100.xxxx) or 13.xxxx, 100.xxxx or lat=13.x lng=100.x
  const coordMatch = text.match(/\(?\s*([0-9]{1,2}\.[0-9]{3,8})\s*[,،]\s*([0-9]{2,3}\.[0-9]{3,8})\s*\)?/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    // Basic sanity check for Thailand range
    if (lat >= 5 && lat <= 21 && lng >= 97 && lng <= 106) {
      next.lat = lat;
      next.lng = lng;
    }
  }

  // Max distance — patterns: ไม่เกิน 500ม, ไม่เกิน 1km, รัศมี 2 กิโล, within 500m
  const distMatch =
    t.match(/(?:ไม่เกิน|รัศมี|ใกล้ใน|within|radius|ระยะ)\s*(\d+(?:\.\d+)?)\s*(km|กิโล|กิโลเมตร|k|m|เมตร|ม\.?)\b/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*(km|กิโล|กิโลเมตร)\b/i);
  if (distMatch) {
    const num = parseFloat(distMatch[1]);
    const unit = distMatch[2].toLowerCase();
    const meters = unit.startsWith("k") || unit.includes("กิโล") ? num * 1000 : num;
    if (meters > 0 && meters <= 50000) next.maxDistanceM = Math.round(meters);
  }

  return { filters: next, resetRequested, name, phone, age, purpose };
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/[^0-9]/g, "");
  return digits.length >= 9 && digits.length <= 15;
}

function validateAge(age: number): boolean {
  return age >= 1 && age <= 120;
}

function validateBudget(budget: number): boolean {
  return budget >= 1000;
}

function mergeProfileField(
  currentQ: Record<string, any>,
  field: string,
  newValue: any,
  confidence: number,
  source: "directly_stated" | "inferred"
) {
  if (newValue === undefined || newValue === null) return;

  // Strict Validation Rules
  if (field === "phone") {
    if (typeof newValue !== "string" || !validatePhone(newValue)) return;
  } else if (field === "age") {
    const parsedAge = Number(newValue);
    if (isNaN(parsedAge) || !validateAge(parsedAge)) return;
    newValue = parsedAge;
  } else if (field === "budget") {
    const parsedBudget = Number(newValue);
    if (isNaN(parsedBudget) || !validateBudget(parsedBudget)) return;
    newValue = parsedBudget;
  } else if (field === "property_type") {
    if (!["condo", "house", "townhouse", "commercial"].includes(newValue)) return;
  } else if (field === "payment_type") {
    if (!["rent", "sale"].includes(newValue)) return;
  } else if (field === "purpose") {
    if (!["living", "investment"].includes(newValue)) return;
  }

  // Confidence Guard (Discard if under 0.6)
  const CONFIDENCE_THRESHOLD = 0.6;
  if (confidence < CONFIDENCE_THRESHOLD) return;

  if (!currentQ.metadata) {
    currentQ.metadata = {};
  }

  const existingMeta = currentQ.metadata[field];
  const existingConfidence = existingMeta?.confidence ?? 0;

  // Overwrite if field is blank OR new confidence is higher
  if (
    currentQ[field] === undefined ||
    currentQ[field] === null ||
    currentQ[field] === "" ||
    confidence > existingConfidence
  ) {
    currentQ[field] = newValue;
    currentQ.metadata[field] = { confidence, source };
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const _reqStart = Date.now();
        try {
          const body = (await request.json()) as ReqBody;
          const messages = body.messages ?? [];
          const prevFilters: SearchFilters = body.filters ?? {};
          const sessionId = body.sessionId ?? null;

          // 1. Maintain chat session in Supabase (if keys allow it)
          let activeSessionId = sessionId;
          if (!activeSessionId) {
            try {
              const { data: created } = await supabaseAdmin
                .from("chat_sessions")
                .insert({ questionnaire: {} })
                .select("id")
                .single();
              activeSessionId = created?.id ?? null;
            } catch (e) {
              console.warn(
                "Could not create chat session (RLS or Key error). Continuing without DB logs.",
              );
            }
          }

          // 2. Extract new filters using local rules
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const userText = lastUser?.content ?? "";
          const {
            filters: extracted,
            resetRequested,
            name: extName,
            phone: extPhone,
            age: extAge,
            purpose: extPurpose,
          } = localExtractFilters(userText);

          let newFilters = resetRequested ? { ...extracted } : { ...prevFilters, ...extracted };

          // ── Place-name geocoding ──────────────────────────────────────────
          // Detect "ใกล้X" / "near X" / "แถวX" patterns and geocode to coordinates.
          // NOTE: Thai text has NO spaces between words, so use \s* not \s+.
          let geocodedPlaceName: string | null = null;
          if (!newFilters.lat && !newFilters.lng) {
            const placeRx =
              /(?:ใกล้(?:กับ|เคียง|ๆ)?|near|close to|ติด(?:กับ)?|ห่าง(?:จาก|ออกไป)?|แถว(?:ๆ)?|บริเวณ(?:ใกล้เคียง)?|proximity(?:\s+to)?)\s*([^\s,.!?(){}]{2,}(?:\s+[^\s,.!?(){}]{1,}){0,4})(?:\s+(?:ไม่เกิน|รัศมี|within|ประมาณ|\d)|[,.!?\n]|$)/iu;
            const m = userText.match(placeRx);
            if (m) {
              // Clean up: remove trailing Thai particles (นะ ค่ะ ครับ มั้ย หน่อย)
              const rawPlace = m[1].trim();
              const placeName = rawPlace
                .replace(/\s*(bts|mrt|สถานี)\s*/gi, " $1 ")
                .replace(/\s*(นะ|ค่ะ|ครับ|มั้ย|หน่อย|ด้วย|ได้มั้ย)$/i, "")
                .trim();
              if (placeName.length >= 2) {
                const geo = await geocodePlace(placeName);
                if (geo) {
                  newFilters = { ...newFilters, lat: geo.lat, lng: geo.lng };
                  geocodedPlaceName = geo.name;
                  // Default 2km radius if user said "ใกล้" without specifying distance
                  if (!newFilters.maxDistanceM) newFilters.maxDistanceM = 2000;
                }
              }
            }

            // ── Auto-geocode from area mapping ───────────────────────────
            // If area was matched via keyword but no lat/lng set yet,
            // look up the coordinates from STATION_COORDS so distance_m is computed.
            if (!newFilters.lat && newFilters.area) {
              const areaGeo = lookupStation(newFilters.area);
              if (areaGeo) {
                newFilters = { ...newFilters, lat: areaGeo.lat, lng: areaGeo.lng };
                geocodedPlaceName = areaGeo.name;
                if (!newFilters.maxDistanceM) newFilters.maxDistanceM = 3000; // 3km default for area search
              }
            }
          }

          // ── Distance Q&A ─────────────────────────────────────────────────
          // Detect "X ถึง Y กี่เมตร?" / "ระยะจาก X ไป Y" patterns
          // and answer immediately without doing a property search.
          const distQARx =
            /(?:ระยะ(?:ห่าง)?(?:จาก)?|จาก|from|distance(?:\s+from)?)\s+(.{2,30}?)\s+(?:ถึง|ไป(?:ยัง)?|to|->|→)\s+(.{2,30})(?:\s|$|[?!.,])/iu;
          const distQAm = userText.match(distQARx) ||
            userText.match(/(.{2,30}?)\s+(?:ถึง|to)\s+(.{2,30}?)\s+(?:กี่เมตร|กี่กิโล|ห่างกัน|ระยะ|distance)/iu);

          let distanceAnswerNote = "";
          if (distQAm) {
            const [geoA, geoB] = await Promise.all([
              geocodePlace(distQAm[1].trim()),
              geocodePlace(distQAm[2].trim()),
            ]);
            if (geoA && geoB) {
              const meters = haversineM(geoA.lat, geoA.lng, geoB.lat, geoB.lng);
              distanceAnswerNote =
                `\n[ข้อมูลระยะทาง] ${geoA.name} ➜ ${geoB.name} = ${fmtDist(meters)} (เส้นตรง Haversine)` +
                `\nใช้ข้อมูลนี้ตอบคำถามระยะทาง อย่าคาดเดา`;
            }
          }

          // Language Detection
          const isChinese = /[\u4e00-\u9fa5]/.test(userText);
          const isJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(userText);
          const isThai = /[ก-๙]/.test(userText);
          const detectedLang = isChinese
            ? "Chinese"
            : isJapanese
              ? "Japanese"
              : isThai
                ? "Thai"
                : "English";

          // 3. Fetch Questionnaire (early) to inform AI
          let currentQ: Record<string, any> = {};
          if (activeSessionId) {
            try {
              const { data: sessData } = await supabaseAdmin
                .from("chat_sessions")
                .select("questionnaire")
                .eq("id", activeSessionId)
                .single();
              if (sessData?.questionnaire) currentQ = sessData.questionnaire as Record<string, any>;
            } catch (e) { /* noop */ }
          }

          // 3.5 Use AI to extract difficult profile details from context
          let aiExtractedProfile: Record<string, any> = {};
          if (activeSessionId && userText.length > 0) {
            try {
              const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
              const chatCtx = messages.map(m => `${m.role}: ${m.content}`).join("\n");

              const exResult = await anthropic.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 512,
                temperature: 0.1,
                system: `You are a precise real estate CRM data extractor.
Analyze the entire conversation context to extract customer profile details.

CRITICAL SEMANTIC MATCHING FOR NAMES:
If the assistant asks for the user's name and the user responds with a single word or name (e.g., "นัท", "John", "Nattagan"), extract that as "customer_name" with high confidence.

CRITICAL PRIVACY RULE:
Do not extract passwords, bank accounts, credit cards, or health records.

Return ONLY a valid JSON object. Each field must be an object with keys "v" (value), "c" (confidence 0.0–1.0), and "s" ("directly_stated" or "inferred").
Allowed fields: customer_name (string), phone (string), age (number), language (string), purpose ("living"|"investment"), budget (number THB), location (string), property_type ("condo"|"house"|"townhouse"|"commercial"), payment_type ("rent"|"sale").
If nothing found, return {}.`,
                messages: [{ role: "user", content: `CONVERSATION HISTORY:\n${chatCtx}` }],
              });

              const rawText = exResult.content[0]?.type === "text" ? exResult.content[0].text : "";
              if (rawText) {
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) aiExtractedProfile = JSON.parse(jsonMatch[0]);
              }
            } catch(e) {
              console.error("AI Profile Extraction Error:", e);
            }
          }

          // 3.6 Merge UI Explicit Interactions (Confidence: 1.0, Source: directly_stated)
          if (newFilters.area) {
            mergeProfileField(currentQ, "location", newFilters.area, 1.0, "directly_stated");
          }
          if (newFilters.maxPrice) {
            mergeProfileField(currentQ, "budget", newFilters.maxPrice, 1.0, "directly_stated");
          }
          if (newFilters.propertyType) {
            mergeProfileField(currentQ, "property_type", newFilters.propertyType, 1.0, "directly_stated");
          }
          mergeProfileField(currentQ, "language", detectedLang, 1.0, "inferred");

          // 3.7 Merge Local Regex Heuristics (Confidence: 0.8, Source: directly_stated)
          if (extName) mergeProfileField(currentQ, "customer_name", extName, 0.8, "directly_stated");
          if (extPhone) mergeProfileField(currentQ, "phone", extPhone, 0.8, "directly_stated");
          if (extAge) mergeProfileField(currentQ, "age", extAge, 0.8, "directly_stated");
          if (extPurpose) mergeProfileField(currentQ, "purpose", extPurpose, 0.8, "directly_stated");

          // 3.8 Merge Smart AI Profile Extractions
          const aiKeys = [
            "customer_name",
            "phone",
            "age",
            "language",
            "purpose",
            "budget",
            "location",
            "property_type",
            "payment_type",
          ] as const;

          for (const key of aiKeys) {
            const aiField = aiExtractedProfile[key];
            if (aiField && aiField.v !== undefined && aiField.v !== null) {
              const confidence = typeof aiField.c === "number" ? aiField.c : 0.7;
              const source = aiField.s === "directly_stated" ? "directly_stated" : "inferred";
              mergeProfileField(currentQ, key, aiField.v, confidence, source);
            }
          }

          // 3.9 Cross-Session Deduplication using Phone Number
          if (currentQ.phone) {
            try {
              const { data: matchedSessions } = await supabaseAdmin
                .from("chat_sessions")
                .select("questionnaire")
                .eq("questionnaire->>phone", currentQ.phone)
                .neq("id", activeSessionId ?? "")
                .limit(1);

              if (matchedSessions && matchedSessions.length > 0) {
                const matched = matchedSessions[0];
                if (matched && matched.questionnaire) {
                  const oldQ = matched.questionnaire as Record<string, any>;
                  // Only carry over the name — preferences (age, budget, purpose etc.)
                  // are session-specific and must not bleed across sessions or users
                  // who share a phone number (e.g. family members).
                  if (oldQ.customer_name && !currentQ.customer_name) {
                    currentQ.customer_name = oldQ.customer_name;
                    if (oldQ.metadata?.customer_name) {
                      if (!currentQ.metadata) currentQ.metadata = {};
                      currentQ.metadata.customer_name = oldQ.metadata.customer_name;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Cross-session deduplication error:", e);
            }
          }

          // 4. Search properties — bot_reccomend (Python RAG) first, SQL fallback
          let didDropFilters = false;
          let nearbyFallback = false;
          let searchMode = "sql";

          // Try bot_reccomend Python service first (handles geocoding + distance + Claude)
          const ragResult = await searchWithRAG(userText, messages.slice(0, -1));
          let properties = ragResult?.properties ?? [];
          let total = ragResult?.total ?? 0;
          let ragAnswer: string | undefined = ragResult?.answer; // Ready-made answer with distance info
          if (ragResult) searchMode = ragResult.mode;

          // Fall back to SQL if RAG unavailable or returned nothing
          if (!ragResult || total === 0) {
            ragAnswer = undefined; // Don't use RAG answer if no results
            const sqlResult = await searchPropertiesServer({ ...newFilters, limit: 12 });
            properties = sqlResult.properties;
            total = sqlResult.total;
            searchMode = "sql";

            if (total === 0 && Object.keys(extracted).length > 0 && !resetRequested) {
              let fallbackFilters = { ...newFilters };
              delete fallbackFilters.area;
              delete fallbackFilters.propertyType;
              const fallbackResult = await searchPropertiesServer({ ...fallbackFilters, limit: 12 });
              if (fallbackResult.total > 0) {
                properties = fallbackResult.properties;
                total = fallbackResult.total;
                newFilters = fallbackFilters;
                nearbyFallback = true;
              } else {
                const rawFallback = await searchPropertiesServer({ ...extracted, limit: 12 });
                if (rawFallback.total > 0) {
                  properties = rawFallback.properties;
                  total = rawFallback.total;
                  newFilters = extracted;
                  didDropFilters = true;
                }
              }
            }
          }

          if (process.env.NODE_ENV === "development") console.log(`[Dev] Search mode: ${searchMode}, results: ${total}`);

          // 5. Log user message and update questionnaire to Supabase
          if (activeSessionId && lastUser) {
            try {
              // Save user log
              await supabaseAdmin.from("chat_logs").insert({
                session_id: activeSessionId,
                role: "user",
                content: userText,
                filters_applied: newFilters as any,
              });

              // Push questionnaire update
              await supabaseAdmin
                .from("chat_sessions")
                .update({ questionnaire: currentQ as any })
                .eq("id", activeSessionId);
            } catch (e) {
              /* noop */
            }
          }

          // 6. Build Claude System Prompt
          let filterNote = "";
          if (nearbyFallback) {
            filterNote = "IMPORTANT: You couldn't find an exact match in their requested area/type, so you are recommending similar or nearby properties instead. Politely explain this.";
          } else if (didDropFilters) {
            filterNote =
              "IMPORTANT: You had to clear their previous filters because there were zero matches. Politely let the user know you've updated the search to match their latest request, ignoring previous constraints.";
          } else if (resetRequested) {
            filterNote =
              "IMPORTANT: The user asked to clear the search or look for something else. Acknowledge that you have reset the map and are starting fresh.";
          }

          // Determine missing fields
          const requiredFields = {
            "Customer Name": currentQ.customer_name,
            "Phone Number": currentQ.phone,
            "Age": currentQ.age,
            "Purpose (Living vs Investment)": currentQ.purpose,
            "Budget": currentQ.budget,
            "Location Preference": currentQ.location,
            "Property Type (House/Condo)": currentQ.property_type,
            "Payment Type (Rent/Sale)": currentQ.payment_type,
          };
          const missingFields = Object.entries(requiredFields)
            .filter(([_, val]) => !val)
            .map(([key]) => key);

          // Priority order for collecting missing fields — ask one at a time
          const fieldPriority: [string, string, any][] = [
            ["customer_name", "ขอทราบชื่อของคุณลูกค้าด้วยนะคะ?", currentQ.customer_name],
            ["purpose", "ซื้อไว้อยู่เองหรือลงทุนคะ?", currentQ.purpose],
            ["property_type", "สนใจคอนโด บ้าน หรือทาวน์เฮ้าส์คะ?", currentQ.property_type],
            ["payment_type", "ต้องการซื้อหรือเช่าคะ?", currentQ.payment_type],
            ["location", "ต้องการทำเลแถวไหนคะ?", currentQ.location],
            ["budget", "งบประมาณอยู่ที่เท่าไหร่คะ?", currentQ.budget],
            ["age", "ขอทราบอายุของคุณลูกค้าด้วยนะคะ?", currentQ.age],
            ["phone", "ขอเบอร์โทรศัพท์เพื่อให้ทีมงานติดต่อกลับได้เลยคะ?", currentQ.phone],
          ];
          const nextMissingField = fieldPriority.find(([, , val]) => !val);
          const nextQuestion = nextMissingField ? nextMissingField[1] : null;

          const missingPrompt = nextQuestion
            ? `หลังจากตอบเรื่อง property แล้ว ให้ถามคำถามนี้ 1 ข้อเท่านั้น (ห้ามถามหลายข้อพร้อมกัน): "${nextQuestion}"`
            : `ได้ข้อมูลครบแล้ว เน้นแนะนำ property และนัดดูห้องค่ะ`;

          const SYSTEM_PROMPT = `คุณคือ Estate AI ที่ปรึกษาอสังหาริมทรัพย์ในกรุงเทพฯ มืออาชีพ${distanceAnswerNote}
ลักษณะการพูด: ใช้ "ค่ะ" ทุกครั้ง สุภาพ อบอุ่น กระชับ เป็นธรรมชาติ
ตอบสั้น ๆ ได้ใจความ ไม่พูดยืดยาว ไม่ใช้ bullet point ซ้อนกันหลายชั้น ห้ามใช้ emoji ทุกชนิดในทุกคำตอบ
ตรวจจับภาษาของผู้ใช้แล้วตอบเป็นภาษาเดียวกันเสมอ (ไทย อังกฤษ จีน ญี่ปุ่น) หากภาษาอื่นให้ใช้ "ka" แทน "ค่ะ"
${filterNote}

${missingPrompt}

รายการ property ที่พบในระบบ (${total} รายการ, วิธีค้นหา: ${searchMode === "sql" ? "keyword filter" : searchMode === "location" ? "geocoding+distance" : "semantic search"}${geocodedPlaceName ? `, จุดอ้างอิง: ${geocodedPlaceName}` : newFilters.lat ? `, anchor: ${newFilters.lat?.toFixed(4)},${newFilters.lng?.toFixed(4)}` : ""}):
${properties.map((p) => `- ${p.name} (ทำเล: ${p.area_name}, ประเภท: ${p.propertyType}, ห้องนอน: ${p.bedrooms || "Studio"}, ราคา: ฿${p.price.toLocaleString()}${p.distance_m != null ? `, ระยะ: ${p.distance_m < 1000 ? p.distance_m + "m" : (p.distance_m / 1000).toFixed(1) + "km"}` : ""})`).join("\n")}

ถ้ามี property: แนะนำไม่เกิน 3 รายการ บอกชื่อ ทำเล ห้องนอน ราคา${newFilters.lat ? ` และระยะทาง (ใช้คำว่า 'ห่าง X เมตร/กิโลเมตรจาก${geocodedPlaceName ?? "จุดที่คุณระบุ"}')` : ""} แล้วบอกเหตุผลสั้น ๆ 1 ประโยคว่าเหมาะกับลูกค้าอย่างไร
ถ้าไม่มี property: แจ้งสั้น ๆ และแนะนำให้ปรับเงื่อนไข
`;

          // 6. Return standard SSE Stream
          const filtersEvent = `event: filters\ndata: ${JSON.stringify({ filters: newFilters, total, sessionId: activeSessionId })}\n\n`;

          const stream = new ReadableStream({
            async start(controller) {
              const enc = new TextEncoder();
              // Send the filters immediately
              controller.enqueue(enc.encode(filtersEvent));

              let fullResponse = "";
              try {
                // ── If bot_reccomend answered, stream it directly ──────────
                if (ragAnswer) {
                  if (process.env.NODE_ENV === "development") {
                    console.log(`[Dev] Using bot_reccomend answer (mode: ${searchMode})`);
                  }
                  fullResponse = ragAnswer;
                  // Stream in chunks of ~80 chars so the UI feels live
                  const CHUNK = 80;
                  for (let i = 0; i < ragAnswer.length; i += CHUNK) {
                    const chunk = ragAnswer.slice(i, i + CHUNK);
                    const textEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`;
                    controller.enqueue(enc.encode(textEvent));
                  }
                } else {
                  // ── Fallback: ask Claude directly ─────────────────────────
                  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

                  const MAX_HISTORY = 20;
                  const chatHistory: Anthropic.MessageParam[] = messages
                    .slice(0, -1)
                    .slice(-MAX_HISTORY)
                    .map((m) => ({
                      role: m.role as "user" | "assistant",
                      content: m.content,
                    }));

                  if (process.env.NODE_ENV === "development") {
                    console.log(`[Dev] Claude request started for session: ${activeSessionId}`);
                    console.log(`[Dev] Extracted Filters:`, newFilters);
                  }

                  let detectedAiLocation: string | null = null;

                  const claudeStream = anthropic.messages.stream({
                    model: "claude-sonnet-4-6",
                    max_tokens: 1024,
                    system: SYSTEM_PROMPT,
                    messages: [...chatHistory, { role: "user", content: userText }],
                  });

                  for await (const event of claudeStream) {
                    if (
                      event.type === "content_block_delta" &&
                      event.delta.type === "text_delta"
                    ) {
                      const text = event.delta.text;
                      fullResponse += text;
                      const textEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                      controller.enqueue(enc.encode(textEvent));

                      // On-the-fly location detection
                      if (!newFilters.area && !detectedAiLocation) {
                        const aiExtracted = localExtractFilters(fullResponse);
                        if (aiExtracted.filters.area) {
                          detectedAiLocation = aiExtracted.filters.area;
                          const filterEvent = `event: filters\ndata: ${JSON.stringify({ filters: { ...newFilters, area: detectedAiLocation }, total, sessionId: activeSessionId })}\n\n`;
                          controller.enqueue(enc.encode(filterEvent));
                        }
                      }
                    }
                  }
                }
              } catch (err: any) {
                console.warn("Claude unavailable, using rule-based fallback:", (err as any)?.status);

                // Build rule-based response — never show error to customer
                const top3 = properties.slice(0, 3);
                let fallback = "";

                if (detectedLang === "Thai") {
                  if (nearbyFallback) {
                    fallback += "ไม่พบ property ตรงทำเลที่ต้องการค่ะ แต่มีตัวเลือกใกล้เคียงที่น่าสนใจค่ะ\n\n";
                  } else if (total === 0) {
                    fallback += "ขออภัยค่ะ ยังไม่พบ property ที่ตรงกับเงื่อนไขนี้ ลองปรับงบหรือทำเลดูนะคะ";
                  } else {
                    fallback += `พบ ${total} รายการค่ะ ขอแนะนำตัวเลือกน่าสนใจดังนี้ค่ะ\n\n`;
                    top3.forEach((p) => {
                      fallback += `**${p.name}**\n`;
                      fallback += `ทำเล: ${p.area_name} · ${p.propertyType} · ${p.bedrooms || "Studio"} ห้องนอน · ฿${p.price.toLocaleString()}\n\n`;
                    });
                  }
                  if (nextQuestion && total > 0) fallback += nextQuestion;
                } else {
                  if (nearbyFallback) {
                    fallback += "No exact match found, but here are some nearby options:\n\n";
                  } else if (total === 0) {
                    fallback += "No properties found matching your criteria. Try adjusting your budget or location.";
                  } else {
                    fallback += `Found ${total} properties. Here are top picks:\n\n`;
                    top3.forEach((p) => {
                      fallback += `**${p.name}**\n`;
                      fallback += `${p.area_name} · ${p.propertyType} · ${p.bedrooms || "Studio"} bed · ฿${p.price.toLocaleString()}\n\n`;
                    });
                  }
                  if (nextQuestion && total > 0) fallback += nextQuestion.replace("คะ?", "?");
                }

                fullResponse = fallback;
                const textEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: fallback } }] })}\n\n`;
                controller.enqueue(enc.encode(textEvent));
              }

              controller.enqueue(enc.encode("data: [DONE]\n\n"));
              controller.close();

              // Log assistant message
              if (activeSessionId && fullResponse) {
                try {
                  await supabaseAdmin.from("chat_logs").insert({
                    session_id: activeSessionId,
                    role: "assistant",
                    content: fullResponse,
                    filters_applied: newFilters as any,
                  });
                } catch (e) {
                  /* noop */
                }
              }

              // Log detailed API request/response for admin monitoring
              try {
                await supabaseAdmin.from("api_request_logs").insert({
                  session_id: activeSessionId ?? null,
                  user_message: userText,
                  detected_lang: detectedLang,
                  local_filters: { ...extracted, resetRequested } as any,
                  ai_profile: aiExtractedProfile as any,
                  merged_filters: newFilters as any,
                  search_mode: searchMode,
                  properties_total: total,
                  properties_sample: properties.slice(0, 5).map((p) => ({
                    id: p.id,
                    name: p.name,
                    area: p.area_name,
                    type: p.propertyType,
                    price: p.price,
                  })) as any,
                  response_length: fullResponse.length,
                  duration_ms: Date.now() - _reqStart,
                });
              } catch (e) {
                /* noop */
              }
            },
          });

          return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
        } catch (e) {
          console.error("Local chat handler error", e);
          // Log error to api_request_logs
          try {
            await supabaseAdmin.from("api_request_logs").insert({
              error: e instanceof Error ? e.message : String(e),
              duration_ms: Date.now() - _reqStart,
            });
          } catch (_) { /* noop */ }
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
            { status: 500 },
          );
        }
      },
    },
  },
});
