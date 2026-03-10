"""
Web search fallback for MIT course queries.

Uses DuckDuckGo (free, no API key) to look up information that isn't in the
local catalog — primarily old course numbers, instructor info, and anything
that post-dates the scraped snapshot.

To upgrade to Gemini Search (higher quality, requires billing confirmation):
  Set GEMINI_API_KEY in .env and set USE_GEMINI=true in .env.
  DO NOT enable until you've verified billing is not active on your GCP project.
"""

import os
import re
from typing import Optional

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
USE_GEMINI = os.getenv("USE_GEMINI", "false").lower() == "true"


def _ddg_search(query: str, max_results: int = 4) -> str:
    """Search with DuckDuckGo. Returns a short synthesized context string."""
    try:
        from ddgs import DDGS
    except ImportError:
        return ""

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
    except Exception:
        return ""

    if not results:
        return ""

    lines = []
    for r in results:
        title = r.get("title", "")
        body = r.get("body", "")[:200].strip()
        if title or body:
            lines.append(f"- {title}: {body}")

    return "\n".join(lines)


def _gemini_search(query: str) -> str:
    """Search with Gemini 2.0 Flash + Google Search grounding (costs money if billing enabled)."""
    if not GEMINI_API_KEY:
        return ""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                system_instruction=(
                    "You are helping answer MIT course catalog questions. "
                    "Be concise. Focus on current course numbers, prerequisites, and availability."
                ),
            ),
        )
        return resp.text or ""
    except Exception as e:
        return f"[Gemini search error: {e}]"


def search_mit(query: str) -> Optional[str]:
    """
    Look up MIT course information not in the local catalog.
    Returns a context string to inject into the LLM prompt, or None if no results.
    """
    if USE_GEMINI and GEMINI_API_KEY:
        result = _gemini_search(query)
    else:
        # Bias DDG toward MIT sources
        mit_query = f"MIT {query} site:mit.edu OR site:student.mit.edu"
        result = _ddg_search(mit_query)
        if not result:
            result = _ddg_search(f"MIT course {query}")

    return result.strip() or None


def is_old_course_number(code: str) -> bool:
    """
    Heuristic: old MIT EECS numbers were 3-digit (6.006, 6.004, etc.).
    New numbers are 4-digit (6.1210, 6.1910, etc.).
    """
    parts = code.split(".", 1)
    if len(parts) == 2:
        dept, num = parts
        digits = re.match(r"^(\d+)", num)
        if digits and dept.isdigit() and int(dept) == 6:
            return len(digits.group(1)) == 3
    return False
