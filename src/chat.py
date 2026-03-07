"""
MIT Course Advisor — Python chat module (future backend use).

This module will be used by the FastAPI backend to:
- Build context from the course database before calling the LLM
- Parse LLM responses for structured course data (JSON blocks)
- Maintain session state server-side if needed

For now, chat is handled directly in the Next.js API route:
    ui/app/api/chat/route.ts
"""
