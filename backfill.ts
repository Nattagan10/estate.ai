import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const env = fs.readFileSync(".env", "utf-8");
const urlMatch = env.match(/SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY="(.*?)"/);
const geminiKeyMatch = env.match(/GOOGLE_AI_API_KEY="(.*?)"/);

async function backfill() {
  console.log("Starting backfill for old sessions...");
  const sb = createClient(urlMatch![1], keyMatch![1]);
  const ai = new GoogleGenAI({ apiKey: geminiKeyMatch![1] });
  
  const { data: sessions, error: sErr } = await sb.from("chat_sessions").select("id, questionnaire");
  if (sErr) {
    console.error("Failed to fetch sessions", sErr);
    return;
  }
  
  if (!sessions) return;
  console.log(`Found ${sessions.length} sessions.`);
  
  for (const session of sessions) {
    const { data: logs } = await sb.from("chat_logs").select("role, content").eq("session_id", session.id).order('created_at', { ascending: true });
    if (!logs || logs.length === 0) continue;
    
    const chatCtx = logs.map(m => `${m.role}: ${m.content}`).join("\n");
    
        let success = false;
        let attempts = 0;
        while (!success && attempts < 3) {
            try {
                const exResult = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: `Extract user profile data from the conversation.
                    Conversation context:
                    ${chatCtx}
                    
                    Return ONLY a JSON object with newly found data. Keys allowed:
                    - "customer_name" (string)
                    - "phone" (string)
                    - "age" (number)
                    - "purpose" ("living" or "investment")
                    - "location" (string)
                    - "budget" (number)
                    - "property_type" (string)
                    - "payment_type" (string)
                    If nothing is found, return {}.`,
                    config: { responseMimeType: "application/json", temperature: 0.1 }
                });
                
                if (exResult.text) {
                     const extracted = JSON.parse(exResult.text);
                     if (Object.keys(extracted).length > 0) {
                        const merged = { ...(session.questionnaire || {}), ...extracted };
                        await sb.from("chat_sessions").update({ questionnaire: merged }).eq("id", session.id);
                        console.log(`Updated session ${session.id.slice(0, 8)}:`, Object.keys(extracted).join(", "));
                     }
                }
                success = true;
            } catch (e: any) {
                if (e.status === 429) {
                    console.log(`Rate limited on session ${session.id}. Waiting 60 seconds...`);
                    await new Promise(r => setTimeout(r, 60000));
                    attempts++;
                } else {
                    console.error("Failed for session", session.id, e);
                    break;
                }
            }
        }
  }
  console.log("Backfill complete.");
}

backfill();
