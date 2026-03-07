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

An AI-powered chatbot that helps MIT students navigate the course catalog. Built as a custom Next.js UI with a Claude-backed chat API.

## Quick Start

```bash
cd ui
cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture

```
6.C395-chatbot/
├── ui/                          # Next.js 14 frontend (run this)
│   ├── app/
│   │   ├── page.tsx             # Main dashboard (requirements + schedule + chat)
│   │   ├── layout.tsx           # Root layout, fonts
│   │   ├── globals.css          # Karla font, CSS variables, animations
│   │   ├── types.ts             # Shared TypeScript types
│   │   ├── api/chat/route.ts    # POST /api/chat -> Anthropic Claude
│   │   └── components/
│   │       ├── Sidebar.tsx      # Left nav
│   │       ├── RequirementsPanel.tsx  # Graduation progress bars
│   │       ├── ScheduleGrid.tsx       # Weekly calendar grid
│   │       ├── ChatPanel.tsx          # Conversational interface
│   │       └── FullscreenModal.tsx    # Expand-to-fullscreen overlay
│   ├── package.json
│   └── .env.local.example
│
├── src/chat.py                  # Python chat module (future backend)
├── app.py                       # FastAPI entry point (future backend)
├── requirements.txt             # Python deps for data pipeline
└── example-content/             # Sample CourseRoad files and screenshots
```

---

## Next Steps

### 1. Course Data Pipeline (Python)
Scrape and store the MIT course catalog so the chatbot has ground-truth data instead of relying solely on LLM knowledge.

- **Scraper**: `src/scraper.py` — scrape `student.mit.edu/catalog` using `requests` + `beautifulsoup4`
  - Collect: course number, title, units, prerequisites, corequisites, distribution attributes (CI-H, HASS-S, REST, etc.), offered semesters, instructors, time slots
- **Hydrant data**: pull from `hydrant.mit.edu` API for real-time schedule info (sections, times, enrolled count)
- **Database**: store in SQLite (`src/db.py`) or PostgreSQL with tables: `courses`, `prereqs`, `schedule_sections`, `requirements`

### 2. RAG / Semantic Search
Give the chatbot access to real course data at query time.

- Embed course descriptions using `anthropic` or `sentence-transformers`
- Store embeddings alongside course records
- On each chat message: retrieve top-k relevant courses, inject into context
- This eliminates hallucinated course numbers and outdated info

### 3. FastAPI Backend (`app.py`)
Move the chat logic to Python so it can query the DB before calling Claude.

```python
# app.py
from fastapi import FastAPI
app = FastAPI()

@app.post("/chat")
async def chat(body: ChatRequest):
    context = db.search_courses(body.query)
    response = claude.complete(system + context, body.messages)
    return {"message": response}
```

Update `ui/app/api/chat/route.ts` to proxy to `http://localhost:8000/chat`.

### 4. Requirements Tracking
Auto-update the requirements progress bars from chat.

- Parse LLM responses for JSON course data blocks (structured output via tool use)
- When a course is "added to schedule," update `schedule` state in `page.tsx`
- When CourseRoad is uploaded, parse `selectedSubjects` and map to requirement groups
- Add a `POST /api/requirements` endpoint that accepts a CourseRoad file

### 5. Visual Schedule Editing
Let students build their schedule interactively.

- Drag-and-drop course blocks in `ScheduleGrid.tsx`
- Click a course block to see details / remove it
- "Add course" button that opens a search modal backed by the DB

### 6. CourseRoad Integration
Full two-way sync with CourseRoad.

- Parse `.road` files: extract `selectedSubjects`, `coursesOfStudy`, `progressAssertions`
- Compute requirement progress from the parsed subjects
- Export a modified `.road` file with advisor-suggested additions

### 7. HuggingFace Deployment
Deploy to a HuggingFace Docker Space (free tier).

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY ui/ .
RUN npm ci && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
EXPOSE 3000
CMD ["npm", "start"]
```

Add `ANTHROPIC_API_KEY` as a Space secret.

---

## Design

- **Fonts**: Karla (body), Baskerville (headings)
- **Colors**: Warm off-white background (`#f5f3ef`), MIT red accent (`#A31F34`)
- **Layout**: Fixed left sidebar + split main area (panels left, chat right)
- **Panels**: Requirements progress + weekly schedule, both expandable to fullscreen modal
