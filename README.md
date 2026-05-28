# Estate AI

AI-powered Bangkok property search assistant. Chat naturally in Thai, English, Chinese, or Japanese to find condos, houses, and townhouses from 53,000+ listings.

## Features

- **AI chat consultant** — ask in any language, get property recommendations
- **Progressive results** — results load as the chat collects your preferences
- **Location search** — mention any BTS/MRT station or Bangkok district
- **Interactive map** — Google Maps with property pins
- **Favorites** — save listings locally
- **Admin dashboard** — chat session history and property management

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TanStack Start/Router, Tailwind CSS |
| Backend | TanStack Start server functions |
| Database | Supabase PostgreSQL (53,466 listings) |
| AI Chat | Anthropic Claude Sonnet |
| Semantic Search | BGE-M3 embeddings + FAISS (Python service) |
| Maps | Google Maps (`@vis.gl/react-google-maps`) |

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema below
- Anthropic API key
- (Optional) Google Maps API key
- (Optional) Python 3.10+ with GPU/CPU for the RAG service

---

## Installation

### 1. Clone and install

```bash
git clone https://github.com/Nattagan10/estate.ai.git
cd estate.ai
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon key |
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | For map display |
| `RAG_SERVICE_URL` | Optional | URL of the Python RAG service |

### 3. Set up Supabase

Run the migrations in order from `supabase/migrations/`:

```bash
npx supabase db push
```

Or apply manually in the Supabase SQL editor starting with `20260521090938_create_rag_properties.sql`.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

---

## RAG Service (Optional)

The Python `bot_reccomend` service provides semantic property search using BGE-M3 embeddings and FAISS. Without it, the chat falls back to SQL keyword search.

### Setup

```bash
# Create a virtual environment (Python 3.10+)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

`requirements.txt`:
```
fastapi
uvicorn[standard]
anthropic
python-dotenv
numpy
pandas
faiss-cpu
FlagEmbedding
```

> For GPU support replace `faiss-cpu` with `faiss-gpu` and install the matching CUDA torch version.

### Configure

Create `bot_reccomend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_MAPS_API_KEY=  ← leave blank; enabling this causes 400+ API calls per request
```

### Run

```bash
cd bot_reccomend
uvicorn app:app --host 0.0.0.0 --port 8000
```

First run downloads the BGE-M3 model (~2.3 GB). Subsequent starts use the cache.

Health check: `GET http://localhost:8000/health` → `{"status":"ok"}`

Then set `RAG_SERVICE_URL=http://localhost:8000` in `.env` and restart the dev server.

---

## Project Structure

```
estate.ai/
├── src/
│   ├── routes/
│   │   ├── index.tsx          # Main page — filters, map, results, chat
│   │   ├── admin.tsx          # Admin dashboard
│   │   └── api/
│   │       ├── chat.ts        # Chat API — Claude streaming + filter extraction
│   │       └── rag-chat.ts    # Proxy to Python RAG service
│   ├── functions/
│   │   ├── properties.ts      # searchProperties, fetchMapPins server functions
│   │   └── admin.functions.ts # Admin CRUD server functions
│   ├── client/components/
│   │   ├── ChatPanel.tsx      # Chat UI
│   │   ├── PropertyCard.tsx   # Property listing card
│   │   └── PropertyMap.tsx    # Google Maps component
│   └── shared/
│       ├── data/properties.ts # Property type and row mapper
│       └── lib/filterProperties.ts # Filters type
├── supabase/migrations/       # Database schema and RPC functions
├── bot_reccomend/             # Python RAG service (optional)
│   ├── app.py                 # FastAPI server
│   ├── house_rec.py           # BGE-M3 + FAISS + Claude pipeline
│   └── requirements.txt
└── .env.example
```

---

## Database Schema

Main table: `rag_properties`

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Project name |
| `property_type` | text | condo / house / townhouse / commercial |
| `district` | text | Bangkok district (Thai or English) |
| `district_canonical` | text | Canonical English district name |
| `neighborhood` | text | Sub-district / area |
| `province` | text | Province |
| `price_thb` | numeric | Price in Thai Baht |
| `price_per_sqm` | numeric | Price per sq.m. |
| `year_built` | int | Year built |
| `near_transit` | text | BTS/MRT info |
| `rental_yield` | numeric | Yield % |
| `latitude` | float | Building latitude |
| `longitude` | float | Building longitude |
| `url` | text | Listing URL |

### RPC Functions

- `rpc_search_properties(...)` — paginated search with optional distance filter
- `rpc_fetch_map_pins(...)` — lightweight pin data for the map (max 2,000 pins)

---

## Chat Questionnaire Flow

The AI collects information in this order, asking one question per turn:

1. Location (ทำเล)
2. Property type — only if user doesn't mention it
3. Budget (งบประมาณ)
4. Purpose (อยู่เอง / ลงทุน)
5. Buy or rent (ซื้อ / เช่า)
6. Name, age, phone — asked after user is satisfied with results

---

## Admin Dashboard

Access at `/admin`. Password: `1111` (change in `src/functions/admin.functions.ts`).

Features: chat session viewer, property CRUD.

---

## Scripts

```bash
npm run dev      # Start dev server (port 8080)
npm run build    # Production build
npm run lint     # ESLint
npm run format   # Prettier
```

---

## License

MIT
