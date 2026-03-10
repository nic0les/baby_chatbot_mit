---
title: MIT Course Advisor
emoji: 🎓
colorFrom: red
colorTo: gray
sdk: docker
python_version: "3.11"
pinned: false
---

# MIT Course Advisor

An AI-powered chatbot that helps MIT students navigate the course catalog. Built with a Next.js UI, a FastAPI Python backend, ChromaDB semantic search over the real MIT catalog, and Qwen3-8B via HuggingFace Inference API for the conversational layer.

---

## Quick Start

### Backend (Python — FastAPI + ChromaDB)
```bash
# From project root
pip install -r requirements.txt

# Copy and fill in credentials
cp .env.example .env
# Add HF_TOKEN=hf_... to .env

uvicorn app:app --reload --port 8000
```

On first startup, the server embeds all 5,805 courses with `all-MiniLM-L6-v2` and persists the ChromaDB index to `data/chroma/` (~30 seconds). Subsequent starts are instant.

### Frontend (Next.js)
```bash
cd ui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend proxies `/api/chat` to `localhost:8000`.

### Required environment variables

| File | Variable | Purpose |
|---|---|---|
| `.env` (root) | `HF_TOKEN` | HuggingFace token for Qwen3-8B inference |
| `.env` (root) | `GEMINI_API_KEY` | Optional — Gemini search upgrade (see notes below) |
| `.env` (root) | `USE_GEMINI` | Set `true` to enable Gemini search (off by default) |

---

## Architecture

```
6.C395-chatbot/
├── app.py                        # FastAPI backend (port 8000)
│   ├── GET  /health
│   ├── GET  /query?q=...         # Raw semantic search endpoint
│   └── POST /chat                # Streaming chat (text/plain SSE)
│
├── src/
│   ├── embeddings.py             # ChromaDB + sentence-transformers index
│   ├── chat.py                   # Qwen3-8B streaming + context injection
│   └── web_search.py             # DuckDuckGo fallback search
│
├── mit_course_scraper/
│   ├── scrapers/
│   │   ├── fetch_catalog.py      # Downloads MIT catalog HTML
│   │   ├── fetch_schedule.py     # Downloads Hydrant schedule HTML
│   │   ├── parse_catalog.py      # BeautifulSoup parser → course records
│   │   ├── parse_schedule.py     # Parses meeting times, sections, instructors
│   │   ├── merge.py              # Joins catalog + schedule per course
│   │   ├── db.py                 # Writes to SQLite (courses.db)
│   │   └── utils.py              # ICON_LABELS, shared helpers
│   └── data/
│       ├── raw/catalog/          # Raw HTML from student.mit.edu/catalog
│       ├── raw/schedule/         # Raw HTML from Hydrant schedule index
│       └── processed/
│           ├── catalog.json      # Parsed catalog (~5,900 courses)
│           ├── schedule.json     # Parsed schedule data
│           ├── merged_courses.json  # Catalog + schedule merged (5,915 records)
│           └── courses.db        # SQLite: subjects table (5,805 rows) + offerings
│
├── ui/
│   ├── app/
│   │   ├── page.tsx              # Dashboard: profile, requirements, schedule, chat
│   │   ├── types.ts              # Shared TypeScript types
│   │   ├── api/chat/route.ts     # Thin proxy → FastAPI /chat (streams)
│   │   └── components/
│   │       ├── Sidebar.tsx
│   │       ├── RequirementsPanel.tsx
│   │       ├── ScheduleGrid.tsx
│   │       ├── ChatPanel.tsx     # Markdown-rendered streaming chat UI
│   │       └── FullscreenModal.tsx
│   └── package.json
│
├── data/chroma/                  # Persisted ChromaDB index (gitignored)
├── requirements.txt
└── .env                          # Secrets (gitignored)
```

---

## Data Pipeline

### Scraping
The pipeline (`python -m mit_course_scraper.scrapers`) fetches raw HTML from `student.mit.edu/catalog` and Hydrant's schedule index, then parses and merges them into a unified record per course.

**Re-scrape schedule**: At the start of each new semester. The current snapshot is Spring 2026.

### SQLite schema (`courses.db`)

**`subjects` table** — one row per course, 26 fields including:
- `subject_code`, `title`, `description`, `department`
- `prereq_text`, `coreq_text`, `units`
- `requirement_tags` — JSON array of GIR attributes (see caveats below)
- `offered_spring_2026`, `offered_iap_2026` — boolean flags
- `meeting_times_raw`, `instructors`, `sections_raw`
- `has_final`, `not_offered_flag`, `new_subject_flag`, `can_repeat_flag`

**`offerings` table** — `(subject_code, term, instructor)` tuples scraped from schedule HTML. Only populated for courses that explicitly list term-specific instructors (~2,578 rows). **Use `subjects.instructors` instead** — it's more complete.

### Known data gaps

#### CI-M is entirely absent
The MIT catalog marks CI-H/CI-HW courses with per-course icon images (`cih1.gif`, `cihw.gif`) that the scraper captures. **CI-M is different** — MIT maintains CI-M lists on separate per-department pages (`web.mit.edu/commreq/cim/course6.html`, etc.) with no per-course icons. The current scraper never visits these pages, so **no course in the database has a CI-M tag**. The chatbot is explicitly instructed not to guess CI-M status and will direct users to `web.mit.edu/commreq/cim`.

**Fix needed**: Add a scraper step that fetches each department's CI-M page, extracts the listed course codes, and updates `requirement_tags` and the `ci_m` boolean field in ChromaDB.

#### Old course numbers (pre-2022 renaming)
MIT renumbered all Course 6 subjects in 2022–2023 (e.g., `6.006 → 6.1210`, `6.004 → 6.1910`). The catalog only contains new numbers; the old numbers appear nowhere in the data. The chatbot handles this via:
1. A course number normalization step (`6.390 ↔ 6.3900` short/long form)
2. A hardcoded mapping table in the system prompt for common Course 6 renames
3. Web search fallback when a looked-up code isn't found in ChromaDB

---

## Semantic Search (ChromaDB)

### Index
- **Embedding model**: `sentence-transformers/all-MiniLM-L6-v2` (80 MB, runs locally, free)
- **Documents**: per-course concatenation of `title | description | prereq_text | tags`
- **Persisted to**: `data/chroma/` — built once, loaded on subsequent restarts

### Metadata fields stored per document
Standard fields: `subject_code`, `title`, `department`, `units`, `prereq_text`, `meeting_times_raw`, `course_url`, `offered_spring_2026`, `offered_iap_2026`, `requirement_tags`

Boolean GIR filter fields (for hard filtering, not just ranking):
`ci_h`, `ci_m`, `hass_h`, `hass_s`, `hass_a`, `rest`

Note: `ci_h = 1` for both `CI-H` and `CI-HW` courses (CI-HW satisfies CI-H).

### Query pipeline (`src/chat.py`)

Each chat turn:
1. **Tag detection** — regex-scans the last 4 messages for GIR keywords (`CI-H`, `CIHs`, `HASS-S`, `humanities`, etc.) including plural/variant forms. Detected tags become hard ChromaDB `where` filters.
2. **Course code extraction** — regex finds MIT course codes in recent messages (`6.3900`, `CMS.100`, `6.390`). Direct ChromaDB ID lookups run first (guaranteed to find the course regardless of semantic distance). Code normalization handles `6.390 ↔ 6.3900`.
3. **Conversation continuity** — if the last user message is ≤8 words (e.g., "give me more"), the search query is enriched with the full recent user message history to maintain context.
4. **Semantic search** — top-12 results filtered by tags if applicable.
5. **Web search fallback** — if any explicit course codes were not found in ChromaDB (likely old numbers), DuckDuckGo search fires with a targeted MIT query.
6. **Context injection** — up to 14 courses injected into the system prompt with full metadata including `tags: none` when empty (critical for preventing hallucination).

---

## LLM Integration

### Model
**Qwen/Qwen3-8B** via HuggingFace Inference API (free-tier serverless, rate-limited).

Alternative: `Qwen/Qwen2.5-7B-Instruct` — no thinking mode, faster, slightly lower quality.

### Qwen3-8B thinking mode
Qwen3-8B unconditionally emits `<think>...</think>` reasoning blocks before every response. With a small `max_tokens`, the thinking block can consume the entire token budget, leaving nothing for the actual answer (manifests as "No response received" in the UI).

**Fix applied**: `MAX_TOKENS = 8192` gives room for both the think block and the answer. The stream handler buffers the think block and yields only the content after `</think>`, with a safe end-of-stream flush in case the block hits the token limit.

### Streaming
The FastAPI `/chat` endpoint returns a `StreamingResponse` (plain text). The Next.js API route proxies the stream directly to the browser. The frontend appends tokens as they arrive — the typing indicator disappears on the first received chunk and the message content grows in real-time.

### Context format passed to the model
```
## Relevant courses from MIT catalog (Spring 2026):

- **6.3900** — Introduction to Machine Learning | 4-0-8 units | ✓ Spring 2026 |
  prereqs: ( 6.1010 or 6.1210 ) and ( 18.03 , 18.06 , 18.700 , or 18.C06 ) |
  tags: none | times: Lecture: M3-4.30 ( 10-250 ) ...

- **CMS.100** — Introduction to Media Studies | 3-0-9 units | ✓ Spring 2026 |
  prereqs: none | tags: HASS-H, CI-H | times: ...
```

The `tags: none` field is always present — omitting it when empty caused the model to hallucinate GIR attributes from its training data.

---

## Web Search Fallback

`src/web_search.py` wraps DuckDuckGo search (`ddgs` package, no API key, free). Triggers when:
- An explicit course code in the user's message isn't found in ChromaDB (e.g., old number like `6.006`)
- No semantic results match at all

### Upgrading to Gemini Search
Set `USE_GEMINI=true` and `GEMINI_API_KEY=...` in `.env`. Uses `gemini-2.0-flash` with native Google Search grounding (higher quality).

**⚠️ Billing warning**: The Gemini API free tier has `limit: 0` if your Google Cloud project has billing enabled. Verify at `console.cloud.google.com → Billing` before enabling. If billing is active, each call will be charged (~$0.00015/1K tokens). DuckDuckGo is the safe default.

---

## UI

### Tech stack
Next.js 15, React 19, TypeScript, Tailwind CSS

### Chat panel
- Streaming responses rendered with `react-markdown` + `remark-gfm` (headings, lists, bold, code, tables, horizontal rules)
- User messages rendered as plain text
- Typing indicator (animated dots) shows until first stream chunk arrives
- Student profile (name, year, major) injected into every chat request

### CourseRoad upload
Parses `.road` JSON files. Extracts `selectedSubjects` array and sends as a natural-language summary to the chat to inform recommendations.

### Design tokens
- **Fonts**: Karla (body, Google Fonts), Baskerville (headings, system serif)
- **Colors**: `#f5f3ef` background, `#fff` surface, `#e5e2dc` border, `#A31F34` MIT red
- **Layout**: Fixed 200px sidebar + left panels (requirements + schedule) + right chat (380px)

---

## Deployment (HuggingFace Docker Space)

The README YAML front matter (`sdk: docker`) targets a HuggingFace Space. Deployment requires:

1. A multi-stage `Dockerfile` building both the Next.js app and the Python backend
2. A process manager (e.g. `supervisord`) to run `uvicorn` (port 8000) and `next start` (port 3000) simultaneously
3. An nginx reverse proxy routing `HF_SPACE_PORT` (7860) to the frontend
4. The pre-built `data/chroma/` index committed via Git LFS (or rebuilt at container startup — adds ~30s)
5. `HF_TOKEN` set as a Space secret (never baked into the image)

The system prompts, business logic, and ChromaDB index all live in the codebase — nothing model-specific needs to be "uploaded" to HuggingFace beyond the application container itself.

---

## Next Steps

- [ ] **CI-M scraper**: fetch `web.mit.edu/commreq/cim/course{N}.html` for each department and backfill `ci_m` tags in ChromaDB
- [ ] **Requirements auto-update**: use Claude/Qwen tool use to emit structured JSON when a student adds a course, updating the requirements progress bars in real time
- [ ] **Schedule editing**: drag-and-drop in `ScheduleGrid.tsx`, backed by real Hydrant section data
- [ ] **Prerequisite graph**: build a graph from `prereq_text` and highlight unsatisfied prerequisites given a student's completed courses
- [ ] **Docker deployment**: write `Dockerfile` + `supervisord.conf` for HuggingFace Space
- [ ] **Gemini search**: enable once billing is confirmed off, for better old-course-number resolution
- [ ] **Hydrant live data**: pull real-time enrollment counts and section availability from `hydrant.mit.edu`
