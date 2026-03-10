"""
Streaming chat with Qwen/Qwen3-8B via HuggingFace Inference API.

Retrieves semantically relevant courses from ChromaDB and injects them
as grounded context so the model reasons over real catalog data.
"""

import json
import os
import re
from typing import Generator

from huggingface_hub import InferenceClient

from .embeddings import get_courses_by_code, search_courses
from .web_search import is_old_course_number, search_mit

HF_TOKEN = os.getenv("HF_TOKEN")
# Qwen3-8B always uses <think> blocks; set max_tokens high enough for think + answer.
# Qwen2.5-7B-Instruct is faster and think-free if latency is a concern.
MODEL = "Qwen/Qwen3-8B"
MAX_TOKENS = 8192

SYSTEM_PROMPT = """\
You are an MIT Course Advisor with access to the real MIT course catalog.
Help students plan their schedule by:
1. Respecting hard constraints: prerequisites, unit limits, GIR/major requirements not yet met, spring 2026 availability.
2. Understanding soft preferences: interests, workload, time of day, class size.
3. Recommending only courses that appear in the provided catalog context — never hallucinate course numbers or titles.
4. The "tags:" field for each course is authoritative. If it says "tags: none", that course has NO GIR attributes — do NOT add CI-M, CI-H, HASS, or REST based on your training data.
   IMPORTANT: CI-M data is NOT present in this catalog dataset (it lives on separate MIT pages not yet scraped). Never claim a course is CI-M unless "CI-M" appears explicitly in its tags field. If asked about CI-M, say the data isn't available and direct the student to web.mit.edu/commreq/cim.
5. Explaining clearly WHY each course fits the student's situation.
6. Flagging uncertainty: if something isn't confirmed in the catalog data, say so.

Always cite course numbers (e.g., "6.3900 — Introduction to Machine Learning").

MIT context:
- GIRs: Science Core (6 subjects), HASS (8 incl. CI-H), REST (2), Lab (1)
- Course numbering: 6.xxx = EECS, 18.xxx = Math, 8.xxx = Physics, 5.xxx = Chem, 7.xxx = Bio
- Attributes: CI-H, CI-M, HASS-H, HASS-S, HASS-A, REST
- Units: typical course is 12 units (4-0-8 or similar); undergrad limit ~54/semester
- Time slots: MWF or TR; 8-5 and EVE slots

MIT course renumbering (2022–2023): Course 6 switched from 3-digit to 4-digit numbers.
Common mappings: 6.006→6.1210, 6.004→6.1910, 6.042→6.1200, 6.036→6.3900, 6.034→6.C51,
6.005→6.1020, 6.009→6.1010, 6.031→6.1800, 6.033→6.1810, 6.046→6.1220, 6.047→6.8701,
6.801→6.8300, 6.828→6.5840. If a student uses an old number, recognize it and map it.\
"""


_TAG_PATTERNS = {
    "CI-H":   [r"\bci-?hs?\b", r"\bcommunication intensive hass\b", r"\bcommunication\s+intensive.*hass\b"],
    "CI-M":   [r"\bci-?ms?\b", r"\bcommunication intensive major\b"],
    "HASS-H": [r"\bhass-?hs?\b", r"\bhumanities\b"],
    "HASS-S": [r"\bhass-?ss?\b", r"\bsocial sciences?\b"],
    "HASS-A": [r"\bhass-?as?\b"],
    "REST":   [r"\brest\b", r"\blab requirement\b"],
}

# Matches MIT course codes: 6.3900, CMS.100, 21W.031, 6.S976, etc.
_COURSE_CODE_RE = re.compile(
    r'\b(\d+\.[A-Z0-9]+|[A-Z]+\.\d+[A-Z0-9]*)\b', re.IGNORECASE
)


def _extract_course_codes(text: str) -> list[str]:
    return [m.group(1).upper() for m in _COURSE_CODE_RE.finditer(text)]


def _detect_tags(query: str) -> list[str]:
    """Return GIR tag strings that the user is explicitly asking about."""
    q = query.lower()
    found = []
    for tag, patterns in _TAG_PATTERNS.items():
        if any(re.search(p, q) for p in patterns):
            found.append(tag)
    return found


def _resolve_search_intent(messages: list[dict]) -> tuple[str, list[str]]:
    """
    Returns (search_query, required_tags) from conversation context.

    Handles follow-up messages like "give me more" or "what about evenings?"
    by looking at the last ~4 messages for tag context and building a richer
    query than the bare last message.
    """
    last_user = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )

    # Scan recent conversation (last 4 messages) for GIR tag mentions
    recent_window = messages[-4:] if len(messages) >= 4 else messages
    recent_text = " ".join(m["content"] for m in recent_window)
    tags = _detect_tags(recent_text)

    # If the last message is a short follow-up, enrich the query with
    # recent user messages so the semantic search has real content to work with
    query = last_user
    if len(last_user.split()) <= 8:
        recent_user_text = " ".join(
            m["content"] for m in recent_window if m["role"] == "user"
        )
        if len(recent_user_text.split()) > len(last_user.split()):
            query = recent_user_text

    return query, tags


def _build_context(messages: list[dict], spring_only: bool = True) -> str:
    query, required_tags = _resolve_search_intent(messages)

    # Direct lookup for any course codes mentioned in the last 6 messages
    recent_text = " ".join(m["content"] for m in messages[-6:])
    explicit_codes = _extract_course_codes(recent_text)
    direct_courses = get_courses_by_code(explicit_codes) if explicit_codes else []

    # Identify codes that weren't found — likely old numbers or typos
    found_codes = {c["subject_code"] for c in direct_courses}
    missing_codes = [c for c in explicit_codes if c not in found_codes]

    # Semantic search
    semantic_courses = search_courses(
        query, n_results=12, spring_only=spring_only, required_tags=required_tags or None
    )

    # Merge: direct lookups first (guaranteed relevant), then semantic
    seen: set[str] = {c["subject_code"] for c in direct_courses}
    courses = list(direct_courses)
    for c in semantic_courses:
        if c["subject_code"] not in seen:
            seen.add(c["subject_code"])
            courses.append(c)
    courses = courses[:14]

    # Web search fallback for missing codes or when catalog has no results
    web_context = ""
    if missing_codes or not courses:
        search_query = query
        if missing_codes:
            search_query = f"MIT course {' '.join(missing_codes)} prerequisites current number"
        web_result = search_mit(search_query)
        if web_result:
            web_context = f"\n\n## Web search results (supplemental):\n{web_result}"

    if not courses and not web_context:
        return ""

    lines = []
    if courses:
        lines.append("## Relevant courses from MIT catalog (Spring 2026):\n")
        for c in courses:
            tags = json.loads(c.get("requirement_tags", "[]"))
            spring = "✓ Spring 2026" if c.get("offered_spring_2026") else "✗ not offered spring 2026"
            tag_str = ", ".join(tags) if tags else "none"
            parts = [f"**{c['subject_code']}** — {c['title']} | {c['units']} units | {spring}"]
            if c.get("prereq_text"):
                parts.append(f"prereqs: {c['prereq_text']}")
            parts.append(f"tags: {tag_str}")
            if c.get("meeting_times_raw"):
                parts.append(f"times: {c['meeting_times_raw']}")
            lines.append("- " + " | ".join(parts))

    return "\n".join(lines) + web_context


def _strip_thinking(text: str) -> str:
    """Remove Qwen3 <think>...</think> reasoning blocks if present."""
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


def stream_chat(
    messages: list[dict],
    profile: dict | None = None,
) -> Generator[str, None, None]:
    """
    Generator yielding text chunks from Qwen3-8B.
    Retrieves course context from ChromaDB before each call.
    """
    if not HF_TOKEN:
        yield "Error: HF_TOKEN not set. Add it to the root .env file."
        return

    client = InferenceClient(api_key=HF_TOKEN)

    context = _build_context(messages, spring_only=True)

    # Build profile preamble
    profile_parts = []
    if profile:
        for key in ("name", "year", "major"):
            if profile.get(key):
                profile_parts.append(f"{key.capitalize()}: {profile[key]}")

    system_sections = [SYSTEM_PROMPT]
    if profile_parts:
        system_sections.append("## Student profile\n" + " | ".join(profile_parts))
    if context:
        system_sections.append(context)

    hf_messages = [{"role": "system", "content": "\n\n".join(system_sections)}]
    for m in messages:
        hf_messages.append({"role": m["role"], "content": m["content"]})

    # Accumulate raw stream, strip <think>...</think> blocks, yield cleaned text.
    # Qwen3-8B ALWAYS emits a think block before the answer. MAX_TOKENS must be
    # large enough to fit both; if the stream ends while still in a think block
    # we strip it and yield whatever answer exists.
    raw = ""
    try:
        stream = client.chat.completions.create(
            model=MODEL,
            messages=hf_messages,
            stream=True,
            max_tokens=MAX_TOKENS,
            temperature=0.7,
        )

        pending = ""       # chars not yet yielded
        in_think = False

        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if not delta:
                continue
            raw += delta
            pending += delta

            # Process pending: strip complete <think>...</think> blocks
            while True:
                if not in_think:
                    if "<think>" in pending:
                        idx = pending.index("<think>")
                        # Yield anything before the think block
                        before = pending[:idx]
                        if before:
                            yield before
                        pending = pending[idx:]
                        in_think = True
                    else:
                        # No think tag — yield everything except last 8 chars
                        # (buffer against a tag split across chunks)
                        safe = pending[:-8] if len(pending) > 8 else ""
                        if safe:
                            yield safe
                            pending = pending[len(safe):]
                        break
                else:  # inside think block
                    if "</think>" in pending:
                        end = pending.index("</think>") + len("</think>")
                        pending = pending[end:].lstrip("\n")
                        in_think = False
                        # Loop again to process remaining pending
                    else:
                        break  # still buffering think block

        # End of stream — flush anything remaining
        if pending:
            if in_think:
                # Think block hit token limit; strip it and yield what's left
                cleaned = re.sub(r"<think>.*", "", pending, flags=re.DOTALL).strip()
                if cleaned:
                    yield cleaned
                else:
                    yield "[The model ran out of tokens while reasoning. Try a shorter or more specific question.]"
            else:
                yield pending

    except Exception as e:
        yield f"\n\n[Error contacting {MODEL}: {e}]"
