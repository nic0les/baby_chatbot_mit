# evaluation/test.py
import sys
import os

_TAG_FIELD_MAP = {
    "CI-H":   "ci_h",
    "CI-M":   "ci_m",
    "HASS-H": "hass_h",
    "HASS-S": "hass_s",
    "HASS-A": "hass_a",
    "REST":   "rest",
}
# add src to Python path so we can import embeddings
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # baby_chatbot_mit
SRC_DIR = os.path.join(BASE_DIR, "src")
sys.path.append(SRC_DIR)

from embeddings import _load_ci_m_from_db, get_collection, _ci_m_major_matches

# verify what CI-M data is in courses.db
ci_m_data = _load_ci_m_from_db()
print("CI-M data loaded from courses.db:")
for code, majors in ci_m_data.items():
    print(f"{code}: {majors}")

# check which courses in ChromaDB actually have CI-M populated
col = get_collection()
print("\nCI-M info in ChromaDB (sample 20 courses):")
count = 0
for code in ci_m_data.keys():
    try:
        results = col.get(ids=[code], include=["metadatas"])
        for m in results.get("metadatas", []):
            ci_m_flag = m.get("ci_m", 0)
            ci_m_majors = m.get("ci_m_majors", "")
            print(f"{code} → ci_m={ci_m_flag}, ci_m_majors={ci_m_majors}")
            count += 1
            if count >= 20:
                break
        if count >= 20:
            break
    except Exception as e:
        print(f"{code}: error {e}")

def search_courses_debug(
    query: str,
    n_results: int = 12,
    spring_only: bool = False,
    required_tags: list[str] | None = None,
    ci_m_major: str | None = None,
) -> list[dict]:
    """
    Debug version of search_courses.
    Prints all candidates considered, their ci_m info, and filtering steps.
    """
    col = get_collection()

    # Build filtering conditions
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

    fetch_n = n_results * 4 if ci_m_major else n_results

    # Perform semantic search
    results = col.query(
        query_texts=[query],
        n_results=min(fetch_n, col.count()),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    print(f"\n=== Semantic search results for query: '{query}' ===")
    candidates = []
    for i, (meta, dist) in enumerate(zip(results["metadatas"][0], results["distances"][0])):
        similarity = round(1 - dist, 3)
        meta_info = {**meta, "similarity": similarity}
        candidates.append(meta_info)
        print(f"{i+1}. {meta['subject_code']}: ci_m={meta['ci_m']}, ci_m_majors={meta.get('ci_m_majors')}, similarity={similarity}")

    # Post-filter by ci_m_major if requested
    if ci_m_major:
        print(f"\nFiltering by CI-M major: {ci_m_major}")
        filtered = []
        for c in candidates:
            match = _ci_m_major_matches(c.get("ci_m_majors", ""), ci_m_major)
            print(f"  {c['subject_code']} → match={match}")
            if match:
                filtered.append(c)
        candidates = filtered

    # Limit to n_results
    print(f"\nReturning top {n_results} courses:")
    for c in candidates[:n_results]:
        print(f"  {c['subject_code']}: ci_m={c['ci_m']}, ci_m_majors={c.get('ci_m_majors')}, similarity={c['similarity']}")

    return candidates[:n_results]

print('Testing')
print(search_courses_debug(
    "machine learning",
    n_results=10,
    ci_m_major="6-3"
))
