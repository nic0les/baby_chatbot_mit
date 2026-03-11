"""
Semantic search over MIT courses using ChromaDB + sentence-transformers.

Index is built on first run from merged_courses.json and persisted to data/chroma/
so subsequent server starts are instant (~0.5s).
"""

import json
import os
import re
import sqlite3

import chromadb
from chromadb.utils import embedding_functions

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DIR = os.path.join(BASE_DIR, "data", "chroma")
MERGED_JSON = os.path.join(
    BASE_DIR, "mit_course_scraper", "data", "processed", "merged_courses.json"
)
COURSES_DB = os.path.join(
    BASE_DIR, "mit_course_scraper", "data", "processed", "courses.db"
)
COLLECTION_NAME = "mit_courses"

_collection = None


def _get_ef():
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )


def get_collection():
    global _collection
    if _collection is not None:
        return _collection

    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    ef = _get_ef()

    try:
        col = client.get_collection(COLLECTION_NAME, embedding_function=ef)
        if col.count() > 0:
            print(f"  Loaded ChromaDB: {col.count()} courses indexed")
            _backfill_ci_m(col)
            _collection = col
            return _collection
    except Exception:
        pass

    print("  Building ChromaDB index (first run, ~2-3 min)...")
    col = client.get_or_create_collection(
        COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    _build_index(col)
    _collection = col
    return _collection


def _load_ci_m_from_db() -> dict[str, str]:
    """Return {subject_code: ci_m_text} for all courses with CI-M data from SQLite."""
    if not os.path.exists(COURSES_DB):
        return {}
    try:
        conn = sqlite3.connect(COURSES_DB)
        cur = conn.cursor()
        cur.execute(
            "SELECT subject_code, ci_m FROM subjects WHERE ci_m IS NOT NULL AND ci_m != ''"
        )
        result = {row[0]: row[1] for row in cur.fetchall()}
        conn.close()
        return result
    except Exception as e:
        print(f"  Warning: could not load CI-M from DB: {e}")
        return {}


def _backfill_ci_m(col) -> None:
    """Update CI-M metadata in an existing ChromaDB collection from SQLite."""
    ci_m_map = _load_ci_m_from_db()
    if not ci_m_map:
        return

    # Skip if already backfilled (any entry has ci_m=1)
    try:
        sample = col.get(limit=1, where={"ci_m": 1}, include=["metadatas"])
        if sample and sample.get("ids"):
            return
    except Exception:
        pass

    print(f"  Backfilling CI-M data for {len(ci_m_map)} courses...")
    updated = 0
    for code, ci_m_text in ci_m_map.items():
        for variant in _code_variants(code):
            try:
                results = col.get(ids=[variant], include=["metadatas"])
                if results["ids"]:
                    meta = results["metadatas"][0]
                    col.update(
                        ids=[variant],
                        metadatas=[{**meta, "ci_m": 1, "ci_m_majors": ci_m_text}],
                    )
                    updated += 1
                    break
            except Exception:
                continue
    print(f"  Backfilled CI-M: {updated}/{len(ci_m_map)} courses updated")


def _parse_tags(raw) -> list[str]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return []
    return []


def _build_index(col):
    with open(MERGED_JSON, encoding="utf-8") as f:
        courses = json.load(f)

    ci_m_map = _load_ci_m_from_db()

    documents, metadatas, ids = [], [], []
    seen_ids: set[str] = set()

    for course in courses:
        code = course.get("subject_code", "").strip()
        if not code or code in seen_ids:
            continue
        seen_ids.add(code)

        tags = _parse_tags(course.get("requirement_tags", []))
        prereq = course.get("prereq_text", "") or ""
        description = course.get("description", "") or ""
        title = course.get("title", "") or ""

        # CI-M: look up by exact code and common variants
        ci_m_text = ""
        for variant in _code_variants(code):
            ci_m_text = ci_m_map.get(variant, "")
            if ci_m_text:
                break

        # Text to embed: rich concat for semantic coverage
        ci_m_embed = f"CI-M {ci_m_text}" if ci_m_text else ""
        text = " | ".join(
            p for p in [title, description, prereq, " ".join(tags), ci_m_embed] if p
        ).strip()
        if not text:
            continue

        documents.append(text)
        metadatas.append({
            "subject_code": code,
            "title": title,
            "department": course.get("department", "") or "",
            "units": course.get("units", "") or "",
            "prereq_text": prereq,
            "offered_spring_2026": int(bool(course.get("offered_spring_2026"))),
            "offered_iap_2026": int(bool(course.get("offered_iap_2026"))),
            "requirement_tags": json.dumps(tags),
            "meeting_times_raw": course.get("meeting_times_raw", "") or "",
            "course_url": course.get("course_url", "") or "",
            # Boolean fields for GIR attribute filtering (exact match)
            "ci_h":      int(any(t.upper() in ("CI-H", "CI-HW") for t in tags)),
            "ci_m":      int(bool(ci_m_text)),
            "ci_m_majors": ci_m_text,
            "hass_h":    int(any(t.upper() == "HASS-H" for t in tags)),
            "hass_s":    int(any(t.upper() == "HASS-S" for t in tags)),
            "hass_a":    int(any(t.upper() == "HASS-A" for t in tags)),
            "rest":      int(any(t.upper() == "REST"   for t in tags)),
        })
        ids.append(code)

    # Upsert in batches
    batch = 500
    for i in range(0, len(documents), batch):
        col.upsert(
            documents=documents[i : i + batch],
            metadatas=metadatas[i : i + batch],
            ids=ids[i : i + batch],
        )
        done = min(i + batch, len(documents))
        print(f"  Indexed {done}/{len(documents)} courses...")

    print(f"  ChromaDB index built: {col.count()} courses")


_TAG_FIELD_MAP = {
    "CI-H":   "ci_h",
    "CI-M":   "ci_m",
    "HASS-H": "hass_h",
    "HASS-S": "hass_s",
    "HASS-A": "hass_a",
    "REST":   "rest",
}


def _code_variants(code: str) -> list[str]:
    """
    Generate lookup variants for a course code.
    Handles short/long forms: 6.390 ↔ 6.3900, 21W.73 ↔ 21W.735, etc.
    """
    variants = [code.upper()]
    parts = code.split(".", 1)
    if len(parts) == 2:
        dept, num = parts[0].upper(), parts[1].upper()
        m = re.match(r"^(\d+)([A-Z]*)$", num)
        if m:
            digits, suffix = m.groups()
            if len(digits) == 3:
                variants.append(f"{dept}.{digits}0{suffix}")   # 6.390 → 6.3900
            elif len(digits) == 4 and digits.endswith("0"):
                variants.append(f"{dept}.{digits[:-1]}{suffix}")  # 6.3900 → 6.390
    return list(dict.fromkeys(variants))  # deduplicate, preserve order


def get_courses_by_code(codes: list[str]) -> list[dict]:
    """Fetch specific courses by subject_code, trying normalized variants."""
    col = get_collection()
    found: list[dict] = []
    seen: set[str] = set()

    for code in codes:
        for variant in _code_variants(code):
            if variant in seen:
                continue
            try:
                results = col.get(ids=[variant], include=["metadatas"])
                metas = [m for m in (results.get("metadatas") or []) if m]
                for m in metas:
                    sc = m.get("subject_code", "")
                    if sc and sc not in seen:
                        seen.add(sc)
                        found.append(m)
                if metas:
                    break  # found a hit for this code, skip remaining variants
            except Exception:
                continue

    return found


def _ci_m_major_matches(ci_m_majors: str, major_code: str) -> bool:
    """True if major_code appears as a token in the comma-separated ci_m_majors string."""
    tokens = [t.strip() for t in ci_m_majors.split(",")]
    return major_code.upper() in (t.upper() for t in tokens)


def search_courses(
    query: str,
    n_results: int = 12,
    spring_only: bool = False,
    required_tags: list[str] | None = None,
    ci_m_major: str | None = None,
) -> list[dict]:
    """Return top-n semantically similar courses for a natural-language query.

    required_tags: list of GIR attribute strings to hard-filter by,
                   e.g. ["CI-H"] or ["HASS-H"].
    ci_m_major: if set, post-filter CI-M results to only those matching this
                major code (e.g. "6-3"). Fetches extra candidates first.
    """
    col = get_collection()

    conditions = []
    if spring_only:
        conditions.append({"offered_spring_2026": 1})
    if required_tags:
        for tag in required_tags:
            field = _TAG_FIELD_MAP.get(tag.upper())
            if field:
                conditions.append({field: 1})

    where = None
    if len(conditions) == 1:
        where = conditions[0]
    elif len(conditions) > 1:
        where = {"$and": conditions}

    # When filtering by CI-M major, fetch more candidates so post-filter has enough to work with
    fetch_n = n_results * 4 if ci_m_major else n_results

    results = col.query(
        query_texts=[query],
        n_results=min(fetch_n, col.count()),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    out = []
    for meta, dist in zip(results["metadatas"][0], results["distances"][0]):
        out.append({**meta, "similarity": round(1 - dist, 3)})

    if ci_m_major:
        out = [
            c for c in out
            if _ci_m_major_matches(c.get("ci_m_majors", ""), ci_m_major)
        ]

    return out[:n_results]
