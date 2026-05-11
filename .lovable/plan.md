# Plan: Bangkok Real Estate Platform Expansion

## 1. Database Schema (Lovable Cloud)

Create migration with these tables:

- **properties** — id, name, description, property_type (condo/house/commercial/townhouse), listing_type (rent/sale), price, bedrooms, bathrooms, area_sqm, area_name (district), lat, lng, address, image_url, tags (text[]), nearby (jsonb), availability_status (available/reserved/sold), created_at, updated_at
- **profiles** — id, user_id (FK auth.users), display_name, created_at
- **user_roles** — id, user_id, role (enum: admin, user) — separate table per security rules, with `has_role()` SECURITY DEFINER function
- **chat_sessions** — id, user_id (nullable for anon), questionnaire jsonb (budget, area, type, bedrooms, lifestyle), created_at
- **chat_logs** — id, session_id, role, content, filters_applied jsonb, created_at

RLS:
- properties: public SELECT; admin-only INSERT/UPDATE/DELETE
- profiles: user can read/update own; admins can read all
- user_roles: user can read own; admin can manage
- chat_sessions / chat_logs: insertable by anyone (anon allowed for demo); admin SELECT all; users SELECT own

## 2. Seed Data (500 Bangkok Properties)

Script/migration to insert 500 properties distributed across ~20 Bangkok districts:
Sukhumvit (Asok, Thonglor, Phrom Phong, Ekkamai, Bang Na), Silom/Sathorn, Siam/Ratchathewi, Chidlom/Ploenchit, Ari/Phaholyothin, **Kaset (Kasetsart)**, Lat Phrao, Ratchada, Huai Khwang, Bang Sue, Chatuchak, Ramkhamhaeng, Bang Kapi, Thonburi, Bang Rak, Pinklao, On Nut, Udom Suk, Rangsit.

For each district: random lat/lng jittered around district center, mix of condo/house/commercial, realistic price distribution (rent 8k-150k THB/mo; sale 2M-80M THB), 1-5 bedrooms, nearby BTS/MRT/Mall/University metadata where relevant. Keep `src/data/properties.ts` as fallback but switch UI to DB.

## 3. MCP Server for Progressive Filtering

Add a TanStack server route `/api/mcp` using `mcp-tanstack-start` exposing tools the LLM calls:

- `searchProperties({ area?, propertyType?, listingType?, minPrice?, maxPrice?, bedrooms?, nearTransit?, availability? })` — queries Supabase, returns count + first 20 matches
- `getPropertyDetails({ id })`
- `getAreaList()` — distinct districts

Update `/api/chat` to use Vercel AI SDK with `streamText` + `tools` calling these MCP tools (or call them directly as in-process tools — simpler & equivalent for the LLM context goal). Each turn:
1. LLM extracts criteria from user message
2. Tool call narrows DB query → returns small filtered set
3. LLM responds + UI receives filter state via tool-result events to update map/cards

Front-end `ChatPanel` switches to AI SDK `useChat` so it can render tool parts and surface filter updates back to `index.tsx`.

## 4. Admin Dashboard

- Add auth (email/password + Google) with `/login` page
- Create `_authenticated` layout guard + `_authenticated/_admin` guard using `has_role`
- `/admin` route with tabs:
  - **Properties**: table with CRUD (create/edit dialog, delete, search/filter)
  - **Sessions**: list of chat sessions + questionnaire data
  - **Logs**: chat message log viewer with applied filters
  - **Analytics**: simple counts (sessions/day, popular areas, avg budget, top property types) using Recharts

## 5. Pre-chat Questionnaire

Lightweight modal on first visit collecting: intent (rent/buy), budget range, preferred area, bedrooms, lifestyle tags. Stored in `chat_sessions.questionnaire` and used to pre-seed chat filters.

## 6. Files to Create/Edit

**New:**
- `supabase/migrations/<ts>_realestate_schema.sql`
- `src/lib/mcp/tools/properties.ts`
- `src/routes/api/mcp.ts`
- `src/routes/login.tsx`, `src/routes/_authenticated.tsx`, `src/routes/_authenticated/_admin.tsx`
- `src/routes/_authenticated/_admin/admin.tsx` (dashboard with tabs)
- `src/components/Questionnaire.tsx`
- `src/components/admin/PropertiesTable.tsx`, `SessionsTable.tsx`, `AnalyticsPanel.tsx`
- `src/lib/properties.functions.ts` (server fns: list/get/create/update/delete)
- `src/hooks/use-auth.ts`

**Edit:**
- `src/routes/index.tsx` — load properties from DB, integrate questionnaire, add header link to /admin
- `src/components/ChatPanel.tsx` — switch to AI SDK useChat, render tool calls, surface filter state
- `src/routes/api/chat.ts` — migrate to AI SDK `streamText` with tools
- `src/styles.css` — minor admin UI tokens

## 7. Technical Notes

- Use Lovable AI Gateway (`google/gemini-3-flash-preview`) via `@ai-sdk/openai-compatible`
- Tools execute server-side with `supabaseAdmin` (read-only filtered queries)
- LLM context only ever sees filtered tool results, not 500 rows
- Map / property grid driven by latest tool-result filter state piped from chat
- Multilingual prompt preserved
- Map pin / typing indicator behavior preserved

## 8. Out of Scope (this iteration)

- Real CRM export
- Real payments
- Image uploads (use Unsplash placeholder URLs)
- Booking/contact form (kept simple)

Approve to proceed.