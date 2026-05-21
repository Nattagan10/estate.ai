import { createFileRoute } from "@tanstack/react-router";
import { searchPropertiesServer, type SearchFilters } from "@/lib/properties.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import Anthropic from "@anthropic-ai/sdk";

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
    Asok: ["asok", "asoke", "อโศก", "阿索克", "アソーク"],
    Thonglor: ["thonglor", "thong lo", "ทองหล่อ", "通罗", "トンロー"],
    "Phrom Phong": ["phrom phong", "phromphong", "พร้อมพงษ์", "澎蓬", "プロンポン"],
    Ekkamai: ["ekkamai", "ekamai", "เอกมัย", "伊卡迈", "エカマイ"],
    "Bang Na": ["bang na", "bangna", "บางนา", "曼谷", "バンナー"],
    Silom: ["silom", "สีลม", "是隆", "シーロム"],
    Sathorn: ["sathorn", "sathon", "สาทร", "沙吞", "サトーン"],
    Siam: ["siam", "สยาม", "暹罗", "サイアム"],
    Chidlom: ["chidlom", "chit lom", "ชิดลม", "奇隆", "チットロム"],
    Ari: ["ari", "aree", "อารีย์", "阿里", "アーリー"],
    Kaset: ["kaset", "เกษตร"],
    "Lat Phrao": ["lat phrao", "ladprao", "ลาดพร้าว", "拉普绕", "ラップラーオ"],
    Ratchada: ["ratchada", "รัชดา", "拉差达", "ラチャダー"],
    "Huai Khwang": ["huai khwang", "huaikhwang", "ห้วยขวาง", "辉煌", "フワイクワーン"],
    "Bang Sue": ["bang sue", "bangsue", "บางซื่อ", "挽赐", "バンスー"],
    Chatuchak: ["chatuchak", "จตุจักร", "乍都节", "チャトゥチャック"],
    Ramkhamhaeng: ["ramkhamhaeng", "รามคำแหง", "蓝康恒", "ラムカムヘン"],
    "Bang Kapi": ["bang kapi", "bangkapi", "บางกะปิ", "邦卡皮", "バンカピ"],
    "On Nut": ["on nut", "onnut", "อ่อนนุช", "安努", "オンヌット"],
    "Udom Suk": ["udom suk", "udomsuk", "อุดมสุข", "乌东素", "ウドムスック"],
    "Phaya Thai": ["phaya thai", "phayathai", "พญาไท", "帕亚泰", "パヤタイ"],
    Ratchathewi: ["ratchathewi", "ราชเทวี", "拉差贴威", "ラチャテーウィー"],
    Nana: ["nana", "นานา", "娜娜", "ナナ"],
    "Phloen Chit": ["phloen chit", "phloenchit", "เพลินจิต", "奔集", "プルンチット"],
    "Phra Khanong": ["phra khanong", "พระโขนง", "帕卡农", "プラカノン"],
    Bearing: ["bearing", "แบริ่ง", "白岭", "ベーリング"],
    Samrong: ["samrong", "สำโรง", "三榕", "サムロン"],
    "Rama 9": ["rama 9", "rama ix", "พระราม 9", "พระรามเก้า", "拉玛九", "ラマ9"],
    "Thailand Cultural Centre": ["cultural centre", "ศูนย์วัฒนธรรม", "文化中心"],
    Sutthisan: ["sutthisan", "สุทธิสาร", "素提讪", "スティサン"],
    "Saphan Khwai": ["saphan khwai", "สะพานควาย", "水牛桥", "サパーンクワーイ"],
    "Mo Chit": ["mo chit", "หมอชิต", "蒙奇", "モーチット"],
    "Victory Monument": [
      "victory monument",
      "อนุสาวรีย์",
      "ชัยสมรภูมิ",
      "胜利纪念碑",
      "戦勝記念塔",
    ],
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

  if (t.match(/\b(rent|rental|lease|เช่า|租|賃貸)\b/i) || t.includes("เช่า"))
    next.listingType = "rent";
  if (
    t.match(/\b(sale|buy|purchase|ซื้อ|ขาย|买|購入)\b/i) ||
    t.includes("ขาย") ||
    t.includes("ซื้อ")
  )
    next.listingType = "sale";

  const maxPriceMatch =
    t.match(/(?:under|max|<|ไม่เกิน|งบ|budget|ราคา)[\s:=]*([\d,]+)[k,]*(\d*)/i) ||
    t.match(/\b(\d{1,3}(?:,\d{3})+)\b/) ||
    t.match(/\b(\d{2,})k\b/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*万/);
  if (maxPriceMatch) {
    let valStr = maxPriceMatch[1];
    if (maxPriceMatch[2]) valStr += maxPriceMatch[2];
    valStr = valStr.replace(/,/g, "");
    let val = parseFloat(valStr);

    if (t.includes(valStr + "k") || val < 1000) val *= 1000;
    if (t.includes("万")) val *= 10000;

    if (val > 0) next.maxPrice = val;
  }

  const bedMatch =
    t.match(/(\d+)\s*bed/i) ||
    t.match(/(\d+)\s*ห้องนอน/) ||
    t.match(/(\d+)\s*居室/) ||
    t.match(/(\d+)\s*LDK/i);
  if (bedMatch) {
    next.bedrooms = parseInt(bedMatch[1], 10);
  }

  if (t.match(/\b(bts|mrt|transit|train|รถไฟฟ้า|地铁|駅)\b/i) || t.includes("รถไฟ"))
    next.nearTransit = true;
  if (t.match(/\b(university|chula|kaset|มหาลัย|มหาวิทยาลัย|大学)\b/i)) next.nearUniversity = true;
  if (t.match(/\b(mall|shopping|paragon|iconsiam|ห้าง|商场|ショッピング)\b/i)) next.nearMall = true;

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
          if (newFilters.listingType) {
            mergeProfileField(currentQ, "payment_type", newFilters.listingType, 1.0, "directly_stated");
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
                  const fieldsToMerge = [
                    "customer_name",
                    "phone",
                    "age",
                    "language",
                    "purpose",
                    "budget",
                    "location",
                    "property_type",
                    "payment_type",
                  ];
                  for (const f of fieldsToMerge) {
                    if (oldQ[f] && (!currentQ[f] || currentQ[f] === "")) {
                      currentQ[f] = oldQ[f];
                      if (oldQ.metadata?.[f]) {
                        if (!currentQ.metadata) currentQ.metadata = {};
                        currentQ.metadata[f] = oldQ.metadata[f];
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.warn("Cross-session deduplication error:", e);
            }
          }

          // 4. Two-Pass Query properties
          let { properties, total } = await searchPropertiesServer({ ...newFilters, limit: 12 });
          let didDropFilters = false;
          let nearbyFallback = false;

          if (total === 0 && Object.keys(extracted).length > 0 && !resetRequested) {
            // PASS 2: Try to find something nearby instead of just dropping
            let fallbackFilters = { ...newFilters };
            delete fallbackFilters.area; // Broaden the area
            delete fallbackFilters.propertyType; // Broaden the type
            
            const fallbackResult = await searchPropertiesServer({ ...fallbackFilters, limit: 12 });
            if (fallbackResult.total > 0) {
              properties = fallbackResult.properties;
              total = fallbackResult.total;
              newFilters = fallbackFilters;
              nearbyFallback = true;
            } else {
               // Complete reset
               const rawFallback = await searchPropertiesServer({ ...extracted, limit: 12 });
               if (rawFallback.total > 0) {
                 properties = rawFallback.properties;
                 total = rawFallback.total;
                 newFilters = extracted;
                 didDropFilters = true;
               }
            }
          }

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

          const SYSTEM_PROMPT = `คุณคือ Estate AI ที่ปรึกษาอสังหาริมทรัพย์ในกรุงเทพฯ มืออาชีพ
ลักษณะการพูด: ใช้ "ค่ะ" ทุกครั้ง สุภาพ อบอุ่น กระชับ เป็นธรรมชาติ
ตอบสั้น ๆ ได้ใจความ ไม่พูดยืดยาว ไม่ใช้ bullet point ซ้อนกันหลายชั้น
ตรวจจับภาษาของผู้ใช้แล้วตอบเป็นภาษาเดียวกันเสมอ (ไทย อังกฤษ จีน ญี่ปุ่น) หากภาษาอื่นให้ใช้ "ka" แทน "ค่ะ"
${filterNote}

${missingPrompt}

รายการ property ที่พบในระบบ (${total} รายการ):
${properties.map((p) => `- ${p.name} (ทำเล: ${p.area_name}, ประเภท: ${p.propertyType}, ห้องนอน: ${p.bedrooms || "Studio"}, ราคา: ฿${p.price.toLocaleString()})`).join("\n")}

ถ้ามี property: แนะนำไม่เกิน 3 รายการ บอกชื่อ ทำเล ห้องนอน ราคา แล้วบอกเหตุผลสั้น ๆ 1 ประโยคว่าเหมาะกับลูกค้าอย่างไร
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
                const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

                // Format history for Claude (user/assistant alternating)
                const history: Anthropic.MessageParam[] = messages.slice(0, -1).map((m) => ({
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
                  messages: [...history, { role: "user", content: userText }],
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
            },
          });

          return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
        } catch (e) {
          console.error("Local chat handler error", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }),
            { status: 500 },
          );
        }
      },
    },
  },
});
