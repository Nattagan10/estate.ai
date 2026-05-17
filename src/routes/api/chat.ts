import { createFileRoute } from "@tanstack/react-router";
import { searchPropertiesServer, type SearchFilters } from "@/lib/properties.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GoogleGenAI } from "@google/genai";

type Msg = { role: "user" | "assistant"; content: string };
type ReqBody = { messages: Msg[]; filters?: SearchFilters; sessionId?: string | null };

type ExtractionResult = {
  filters: SearchFilters;
  resetRequested: boolean;
  name?: string;
  age?: number;
  purpose?: string;
};

function localExtractFilters(text: string): ExtractionResult {
  const t = text.toLowerCase();
  const next: SearchFilters = {};
  let resetRequested = false;
  let name: string | undefined;
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
    t.match(/(?:under|max|<|ไม่เกิน|งบ|budget)[^\d]*(\d+)[k,]*(\d*)/i) ||
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
  const nameMatch = text.match(/(?:my name is|i am|ฉันชื่อ|ชื่อ|叫)\s+([A-Za-zก-๙]{2,15})\b/i);
  if (nameMatch) name = nameMatch[1];

  return { filters: next, resetRequested, name, age, purpose };
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

          // 3. Two-Pass Query properties
          let { properties, total } = await searchPropertiesServer({ ...newFilters, limit: 12 });
          let didDropFilters = false;

          if (total === 0 && Object.keys(extracted).length > 0 && !resetRequested) {
            // PASS 2: The combined filters yielded 0 results.
            // The user explicitly asked for something new, but the old context dragged it down.
            // We drop the old conflicting filters and search ONLY with the newly extracted ones!
            const fallbackFilters = { ...extracted };
            const fallbackResult = await searchPropertiesServer({ ...fallbackFilters, limit: 12 });

            if (fallbackResult.total > 0) {
              properties = fallbackResult.properties;
              total = fallbackResult.total;
              newFilters = fallbackFilters;
              didDropFilters = true;
            }
          }

          // 4. Log user message and update questionnaire to Supabase
          if (activeSessionId && lastUser) {
            try {
              // Save user log
              await supabaseAdmin.from("chat_logs").insert({
                session_id: activeSessionId,
                role: "user",
                content: userText,
                filters_applied: newFilters as any,
              });

              // Fetch and merge questionnaire
              const { data: sessData } = await supabaseAdmin
                .from("chat_sessions")
                .select("questionnaire")
                .eq("id", activeSessionId)
                .single();
              const currentQ = (sessData?.questionnaire ?? {}) as Record<string, any>;

              const qUpdate: Record<string, any> = { language: detectedLang };
              if (newFilters.area) qUpdate.location = newFilters.area;
              if (newFilters.maxPrice) qUpdate.budget = newFilters.maxPrice;
              if (newFilters.propertyType) qUpdate.property_type = newFilters.propertyType;
              if (newFilters.listingType) qUpdate.payment_type = newFilters.listingType;
              if (extName) qUpdate.customer_name = extName;
              if (extAge) qUpdate.age = extAge;
              if (extPurpose) qUpdate.purpose = extPurpose;

              await supabaseAdmin
                .from("chat_sessions")
                .update({ questionnaire: { ...currentQ, ...qUpdate } as any })
                .eq("id", activeSessionId);
            } catch (e) {
              /* noop */
            }
          }

          // 5. Build Gemini System Prompt
          let filterNote = "";
          if (didDropFilters) {
            filterNote =
              "IMPORTANT: You had to clear their previous filters because there were zero matches. Politely let the user know you've updated the search to match their latest request, ignoring previous constraints.";
          } else if (resetRequested) {
            filterNote =
              "IMPORTANT: The user asked to clear the search or look for something else. Acknowledge that you have reset the map and are starting fresh.";
          }

          const SYSTEM_PROMPT = `You are Estate AI, an elite, professional, and highly knowledgeable real estate consultant in Bangkok.
Your primary role is to assist clients in finding their perfect property for rent or sale.
You MUST maintain a polite, premium, and human-like sales tone at all times.
You MUST automatically detect the user's language and respond in the SAME language (e.g., Thai, English, Chinese, Japanese).
${filterNote}

Below is a list of actual database properties that match the user's search. 
If the list is empty, apologize politely and suggest adjusting their criteria.
If there are properties:
1. Present up to 3 of them beautifully using markdown.
2. For each, state the Name, Area, Bedrooms, Property Type, and Price.
3. Add a short, personalized reason why it fits their lifestyle based on their request.
4. Tell them you have highlighted these on the map, and gently ask if they want to schedule a viewing.

Found Properties (${total} total matches):
${properties.map((p) => `- ${p.name} (Area: ${p.area_name}, Type: ${p.propertyType}, Beds: ${p.bedrooms || "Studio"}, Price: ฿${p.price.toLocaleString()})`).join("\n")}
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
                const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

                // Format history for Gemini
                const history = messages.slice(0, -1).map((m) => ({
                  role: m.role === "assistant" ? "model" : "user",
                  parts: [{ text: m.content }],
                }));

                const responseStream = await ai.models.generateContentStream({
                  model: "gemini-2.5-flash",
                  contents: [...history, { role: "user", parts: [{ text: userText }] }],
                  config: {
                    systemInstruction: SYSTEM_PROMPT,
                    temperature: 0.7,
                  },
                });

                let detectedAiLocation: string | null = null;

                for await (const chunk of responseStream) {
                  const text = chunk.text;
                  if (text) {
                    fullResponse += text;
                    const textEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                    controller.enqueue(enc.encode(textEvent));

                    // On-the-fly AI recommendation detection
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
                console.error("Gemini API Error:", err);
                const errorText =
                  detectedLang === "Thai"
                    ? "ขออภัยครับ ระบบ AI เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง"
                    : "I apologize, but I am currently experiencing connection issues. Please try again later.";
                fullResponse = errorText;
                const textEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: errorText } }] })}\n\n`;
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
