"""
Python data pipeline entry point (future).

This file will become the FastAPI backend for:
- Course catalog scraping (student.mit.edu/catalog)
- Hydrant schedule data ingestion
- CourseRoad file parsing
- SQLite / PostgreSQL course database
- Semantic search over courses

See README.md for the full architecture plan.

To run the future backend:
    uvicorn app:app --reload --port 8000

The Next.js frontend lives in ui/ and handles:
- UI rendering
- Chat via Anthropic API (ui/app/api/chat/route.ts)
"""
