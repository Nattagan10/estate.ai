/**
 * watch-logs.mjs — Real-time API log monitor for estate.ai
 * Run: node watch-logs.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://pewmizweveqqswutshii.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld21pendldmVxcXN3dXRzaGlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgyODQwNSwiZXhwIjoyMDk0NDA0NDA1fQ.6JOYnJGDJravFTrLYI20MlK9ybvTzR2Z-E8Pri7ZV0E";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ANSI colors
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

function color(text, ...codes) {
  return codes.join("") + text + C.reset;
}

function langBadge(lang) {
  const map = {
    Thai: C.yellow,
    English: C.cyan,
    Chinese: C.red,
    Japanese: C.magenta,
  };
  const c = map[lang] ?? C.gray;
  return color(` ${lang ?? "?"} `, c, C.bold);
}

function modeBadge(mode) {
  if (mode === "semantic") return color(" semantic ", C.magenta, C.bold);
  if (mode === "sql") return color(" sql ", C.green, C.bold);
  return color(` ${mode ?? "?"} `, C.gray);
}

function printLog(log) {
  const time = new Date(log.created_at).toLocaleTimeString("th-TH", { hour12: false });
  const filters = log.merged_filters ?? {};
  const local = log.local_filters ?? {};
  const aiP = log.ai_profile ?? {};
  const sample = log.properties_sample ?? [];
  const hasError = !!log.error;

  const sep = color("━".repeat(70), C.gray);

  console.log(sep);

  // Header line
  const header = [
    color(time, C.bold, C.white),
    langBadge(log.detected_lang),
    modeBadge(log.search_mode),
    color(`${log.properties_total ?? 0} props`, C.green, C.bold),
    color(`${log.duration_ms ?? "?"}ms`, C.gray),
    log.session_id ? color(log.session_id.slice(0, 8) + "…", C.dim) : "",
  ]
    .filter(Boolean)
    .join("  ");

  console.log(header);

  if (hasError) {
    console.log(color("  ✖ ERROR: " + log.error, C.red, C.bold));
  }

  // User message
  if (log.user_message) {
    console.log(color("  ▶ ", C.blue) + color(log.user_message, C.white));
  }

  // Merged filters
  const fEntries = Object.entries(filters).filter(
    ([, v]) => v !== null && v !== undefined && v !== false
  );
  if (fEntries.length > 0) {
    const pills = fEntries
      .map(([k, v]) => color(`${k}=${v}`, C.cyan))
      .join(color("  ", C.reset));
    console.log(color("  Filter: ", C.gray) + pills);
  }

  // Local regex extraction (non-empty, non-false)
  const lEntries = Object.entries(local).filter(
    ([k, v]) => v !== null && v !== undefined && v !== false && v !== "{}" && k !== "resetRequested"
  );
  if (local.resetRequested) {
    console.log(color("  ↺ Reset requested", C.yellow));
  }
  if (lEntries.length > 0) {
    const pills = lEntries
      .map(([k, v]) => color(`${k}=${JSON.stringify(v)}`, C.yellow))
      .join("  ");
    console.log(color("  Regex: ", C.gray) + pills);
  }

  // AI profile extraction
  const aEntries = Object.entries(aiP).filter(([, v]) => v && typeof v === "object" && v.v != null);
  if (aEntries.length > 0) {
    const pills = aEntries
      .map(([k, v]) => color(`${k}=${v.v}(${Math.round((v.c ?? 0) * 100)}%)`, C.magenta))
      .join("  ");
    console.log(color("  AI:    ", C.gray) + pills);
  }

  // Properties sample
  if (sample.length > 0) {
    console.log(color("  Props: ", C.gray));
    sample.forEach((p, i) => {
      const priceStr = p.price ? `฿${Number(p.price).toLocaleString()}` : "";
      console.log(
        color(`    ${i + 1}. `, C.gray) +
          color(p.name ?? "?", C.white, C.bold) +
          color(` — ${p.area ?? ""} ${p.type ?? ""} ${priceStr}`, C.gray)
      );
    });
  }

  // Response size
  if (log.response_length) {
    console.log(color(`  Reply: ${log.response_length} chars`, C.dim));
  }
}

// ── Main polling loop ─────────────────────────────────────
let lastSeen = new Date().toISOString();
let isFirst = true;

console.log(color("\n  🏠 Estate AI — API Log Monitor", C.bold, C.cyan));
console.log(color("  Watching api_request_logs (refresh every 2s)…\n", C.gray));

async function poll() {
  try {
    const { data, error } = await db
      .from("api_request_logs")
      .select("*")
      .gt("created_at", lastSeen)
      .order("created_at", { ascending: true })
      .limit(20);

    if (error) {
      console.error(color("DB error: " + error.message, C.red));
      return;
    }

    if (data && data.length > 0) {
      if (isFirst) {
        // On first run, show last 5 existing logs instead
        isFirst = false;
      }
      for (const log of data) {
        printLog(log);
        lastSeen = log.created_at;
      }
    } else if (isFirst) {
      // On first run show last 5 logs
      isFirst = false;
      const { data: recent } = await db
        .from("api_request_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (recent && recent.length > 0) {
        console.log(color("  — Last 5 logs —\n", C.dim));
        recent.reverse().forEach(printLog);
        lastSeen = recent[0].created_at;
      } else {
        console.log(color("  (no logs yet — send a chat message to see data)\n", C.dim));
      }
    }
  } catch (e) {
    console.error(color("Poll error: " + e.message, C.red));
  }

  setTimeout(poll, 2000);
}

poll();
