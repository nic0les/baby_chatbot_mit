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

from .embeddings import get_courses_by_code, search_courses, _code_variants
from .web_search import is_old_course_number, search_mit

HF_TOKEN = os.getenv("HF_TOKEN")
# Qwen3-8B always uses <think> blocks; set max_tokens high enough for think + answer.
# Qwen2.5-7B-Instruct is faster and think-free if latency is a concern.
MODEL = "Qwen/Qwen3-8B"
MAX_TOKENS = 8192

SYSTEM_PROMPT = """\
You are an MIT Course & Life Advisor. You help students with two complementary goals:

## 1 — Course planning (catalog-grounded)
- Recommend only courses appearing in the provided catalog context. Never invent course numbers or titles.
- Respect hard constraints: prerequisites, unit limits (~54/semester), GIR/major requirements, spring 2026 availability.
- Honor soft preferences: interests, workload, time-of-day, class size, career goals.
- Tags are authoritative: "tags: none" means NO GIR attributes — do not add CI-H/HASS/REST from training data.
  CI-M appears explicitly as "ci-m: <major codes>" — never claim CI-M unless it's in the context.
- CI-Ms are found in the ChromaDB. A course that is a CI-M is labeled with "ci_m=1" and "ci_m_majors=[list of majors]"
- Explain clearly WHY each course fits the student's situation.
- Always cite course numbers (e.g., "6.3900 — Introduction to Machine Learning").
- Flag uncertainty: if something isn't confirmed in the catalog data, say so.
- NEVER recommend a course that appears in the student's "Completed courses" list. They have already taken it.

## 2 — Time management & MIT life (advisory, clearly labeled as general guidance)
When students ask about workload, scheduling, career, research, or MIT life, give practical, honest advice.
Always label this as general guidance — not a guarantee — and encourage verification with their academic advisor.

### Workload & time management
- MIT units map directly to hours: 1 unit ≈ 1 hr/week. A 12-unit course takes ~12 hrs/week.
  Rule of thumb: contact hours (lecture+recitation) + 2–3× for problem sets / projects.
- Signs of overloading: taking >54 units, or stacking multiple "hard" courses (6.1210, 18.701, 8.03 etc.) in the same semester.
- Strategies: front-load easy semesters, use IAP for lighter subjects, take 1 "exploration" course per semester.
- If a student seems overloaded, flag it explicitly and suggest dropping to 4 courses (48 units).

### Career advice (label as general guidance)
- EECS (6-3, 6-4, 6-14) → strong pipelines to SWE, ML/AI, quant finance, hardware, startups.
  Key courses for ML/AI: 6.3900, 6.7960, 6.C51; for systems: 6.1810, 6.5840; for theory: 6.1220, 6.5250.
- Math/CS (18-C, 18-1) → academia, quant, cryptography, theory research.
- Econ (14-1, 14-2, 6-14) → consulting, policy, fintech; 14.32, 14.13, 14.27 valued by employers.
- For industry internships: highlight lab experience (6.UAT, UROP), project courses (6.1800, 6.S977).
- For graduate school: research exposure matters more than GPA alone; aim for UROP by sophomore year.

### Research & projects
- UROP (Undergraduate Research Opportunities Program): available to all undergrads, any semester or summer.
  Students earn credit (6.UR) or pay (~$15/hr). Best started after 2–3 semesters of foundational courses.
  Finding a UROP: email professors whose papers interest you, check urop.mit.edu, attend lab open houses.
- Project-based courses: 6.1800 (Computer Systems), 6.S977, 6.UAT, 6.9630 (MechE capstone).
- SuperUROP (6.UAR): year-long advanced research, usually junior/senior year.

### MIT life & balance
- MIT is intense — it's normal to find courses hard. Office hours, study groups, and tutoring (Student Support Services) are essential.
- Clubs and activities count: they build networks and skills. Joining 1–2 early is better than over-committing.
- Mental health: MindHandHeart resources, S3 (Student Support Services), counseling at MIT Medical.
- Pass/No Record (P/NR): freshmen get P/NR for all courses fall semester — a key time to explore.

---

MIT context:
- GIRs: Science Core (6 subjects), HASS (8 incl. CI-H), REST (2), Lab (1)
- Course numbering: 6.xxx = EECS, 18.xxx = Math, 8.xxx = Physics, 5.xxx = Chem, 7.xxx = Bio, 14.xxx = Economics
- Attributes: CI-H, CI-M, HASS-H, HASS-S, HASS-A, REST
- Units: typical course = 12 units (4-0-8); undergrad limit ~54/semester
- Time slots: MWF or TR; 8 AM–5 PM and evening slots

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

_TIME_PREF_PATTERNS = {
    "morning":   [r"\bmorning\b", r"\bearly\b", r"\b(8|9|10|11)\s*am\b"],
    "afternoon": [r"\bafternoon\b", r"\blunch\b", r"\b(1|2|3|4)\s*pm\b", r"\blate\b"],
    "evening":   [r"\bevening\b", r"\bnight\b", r"\b(5|6|7)\s*pm\b"],
}


def _detect_time_pref(query: str) -> str | None:
    """Return 'morning', 'afternoon', or 'evening' if user expresses a time preference."""
    q = query.lower()
    for pref, patterns in _TIME_PREF_PATTERNS.items():
        if any(re.search(p, q) for p in patterns):
            return pref
    return None


def _primary_time_slot(meeting_times_raw: str) -> float | None:
    """Extract the first numeric time slot from a raw meeting time string.
    MIT convention: 1–7 = PM (1pm–7pm), 8–12 = AM (8am–12pm).
    Returns the slot number, or None if unparseable.
    """
    m = re.search(r"[MTWRF]+(\d+(?:\.\d+)?)", meeting_times_raw or "", re.IGNORECASE)
    if m:
        return float(m.group(1))
    return None


def _time_matches_pref(meeting_times_raw: str, pref: str) -> bool:
    slot = _primary_time_slot(meeting_times_raw)
    if slot is None:
        return False
    if pref == "morning":
        return slot >= 8  # 8am–12pm
    if pref == "afternoon":
        return 1 <= slot <= 4  # 1pm–4pm
    if pref == "evening":
        return 5 <= slot <= 7  # 5pm–7pm
    return False

# Matches MIT course codes: 6.3900, CMS.100, 21W.031, 6.S976, etc.
_COURSE_CODE_RE = re.compile(
    r'\b(\d+\.[A-Z0-9]+|[A-Z]+\.\d+[A-Z0-9]*)\b', re.IGNORECASE
)

# Matches MIT major codes: 6-3, 6-14, 10-ENG, 18-C, 6-P, etc.
# Uses dash (not dot) so it doesn't collide with course codes.
_MAJOR_CODE_RE = re.compile(r'\b(\d{1,2}[A-Za-z]*-(?:\d+[A-Za-z]*|[A-Za-z]+))\b')


def _extract_course_codes(text: str) -> list[str]:
    return [m.group(1).upper() for m in _COURSE_CODE_RE.finditer(text)]


def _extract_major_code(text: str) -> str | None:
    """Return the first MIT major code found in text (e.g. '6-3'), or None."""
    m = _MAJOR_CODE_RE.search(text)
    return m.group(1).upper() if m else None


def _profile_major_code(profile: dict | None) -> str | None:
    """Normalize profile['major'] to a CI-M major code, e.g. '6-3 CS' → '6-3'."""
    if not profile:
        return None
    raw = profile.get("major", "") or ""
    return _extract_major_code(raw)


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


def _build_context(
    messages: list[dict],
    spring_only: bool = True,
    profile: dict | None = None,
    completed_courses: list[str] | None = None,
) -> str:
    query, required_tags = _resolve_search_intent(messages)

    # Determine CI-M major filter: prefer explicit mention in query over profile
    ci_m_major: str | None = None
    if "CI-M" in required_tags:
        last_user = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
        )
        query_major = _extract_major_code(last_user)
        profile_major = _profile_major_code(profile)
        ci_m_major = query_major or profile_major

    # Normalize completed course codes for filtering
    completed_set: set[str] = set()
    for c in (completed_courses or []):
        for variant in _code_variants(c):
            completed_set.add(variant.upper())

    # Direct lookup for any course codes mentioned in the last 6 messages
    recent_text = " ".join(m["content"] for m in messages[-6:])
    explicit_codes = _extract_course_codes(recent_text)
    direct_courses = get_courses_by_code(explicit_codes) if explicit_codes else []

    # Identify codes that weren't found — likely old numbers or typos
    found_codes = {c["subject_code"] for c in direct_courses}
    missing_codes = [c for c in explicit_codes if c not in found_codes]

    # Semantic search (fetch extra so we have room to filter + rerank)
    semantic_courses = search_courses(
        query,
        n_results=18,
        spring_only=spring_only,
        required_tags=required_tags or None,
        ci_m_major=ci_m_major,
    )

    # Merge: direct lookups first (guaranteed relevant), then semantic
    seen: set[str] = {c["subject_code"] for c in direct_courses}
    courses = list(direct_courses)
    for c in semantic_courses:
        if c["subject_code"] not in seen:
            seen.add(c["subject_code"])
            courses.append(c)

    # Remove already-completed courses from recommendations
    # (keep them if explicitly looked up by code — student may be asking about them)
    explicit_upper = {e.upper() for e in explicit_codes}
    courses = [
        c for c in courses
        if c["subject_code"].upper() not in completed_set
        or c["subject_code"].upper() in explicit_upper
    ]

    # Detect time-of-day preference and rerank: matching courses bubble to top
    time_pref = _detect_time_pref(query)
    if time_pref:
        courses.sort(
            key=lambda c: 0 if _time_matches_pref(c.get("meeting_times_raw", ""), time_pref) else 1
        )

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
        header = "## Relevant courses from MIT catalog (Spring 2026):"
        if ci_m_major:
            header += f" (CI-M filtered for major {ci_m_major})"
        lines.append(header + "\n")
        for c in courses:
            tags = json.loads(c.get("requirement_tags", "[]"))
            spring = "✓ Spring 2026" if c.get("offered_spring_2026") else "✗ not offered spring 2026"
            tag_str = ", ".join(tags) if tags else "none"
            parts = [f"**{c['subject_code']}** — {c['title']} | {c['units']} units | {spring}"]
            if c.get("prereq_text"):
                parts.append(f"prereqs: {c['prereq_text']}")
            parts.append(f"tags: {tag_str}")
            if c.get("ci_m_majors"):
                parts.append(f"ci-m: {c['ci_m_majors']}")
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
    preferences: dict | None = None,
) -> Generator[str, None, None]:
    """
    Generator yielding text chunks from Qwen3-8B.
    Retrieves course context from ChromaDB before each call.
    """
    if not HF_TOKEN:
        yield "Error: HF_TOKEN not set. Add it to the root .env file."
        return

    client = InferenceClient(api_key=HF_TOKEN)

    completed_courses: list[str] = (profile or {}).get("completed_courses", [])
    context = _build_context(messages, spring_only=True, profile=profile,
                             completed_courses=completed_courses)

    # Build profile preamble
    profile_parts = []
    if profile:
        for key in ("name", "year", "major"):
            if profile.get(key):
                profile_parts.append(f"{key.capitalize()}: {profile[key]}")
    if completed_courses:
        # Summarize completed courses so LLM knows what prereqs are satisfied
        profile_parts.append(f"Completed courses ({len(completed_courses)}): {', '.join(completed_courses[:40])}")
    liked = (profile or {}).get("liked_courses", [])
    disliked = (profile or {}).get("disliked_courses", [])
    if liked:
        profile_parts.append(f"Liked courses (recommend similar): {', '.join(liked)}")
    if disliked:
        profile_parts.append(f"Disliked courses (avoid similar): {', '.join(disliked)}")

    system_sections = [SYSTEM_PROMPT]
    if profile_parts:
        system_sections.append("## Student profile\n" + " | ".join(profile_parts))
    if preferences:
        pref_parts = []
        if preferences.get("prioritize"):
            pref_parts.append("Prioritize: " + ", ".join(preferences["prioritize"]))
        if preferences.get("avoid"):
            pref_parts.append("Avoid: " + ", ".join(preferences["avoid"]))
        if pref_parts:
            system_sections.append("## Student preferences\n" + "\n".join(pref_parts))
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
