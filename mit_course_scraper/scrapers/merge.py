"""
Merge catalog and schedule parsed data by subject_code.

Catalog data provides: description, prereqs, units, requirement tags, etc.
Schedule data provides: meeting times, instructors, locations, term offerings.

The merged output combines both into a single record per subject.
"""

import os
import json
from .utils import PROCESSED_DIR


def merge_records(catalog_records, schedule_records):
    """
    Merge catalog and schedule records by subject_code.

    Returns a list of merged record dicts.
    """
    # Index schedule records by subject_code
    schedule_by_code = {}
    for rec in schedule_records:
        code = rec.get("subject_code", "")
        if code:
            schedule_by_code[code] = rec

    merged = []

    for cat in catalog_records:
        code = cat.get("subject_code", "")
        sched = schedule_by_code.get(code, {})

        # Build the merged record
        record = {
            # From catalog
            "subject_code": code,
            "title": cat.get("title", ""),
            "description": cat.get("description", ""),
            "department": cat.get("department", ""),
            "prereq_text": cat.get("prereq_text", ""),
            "coreq_text": cat.get("coreq_text", ""),
            "units": cat.get("units", ""),
            "subject_level_raw": cat.get("subject_level_raw", ""),
            "requirement_tags": cat.get("requirement_tags", []),
            "cross_listings": cat.get("cross_listings", ""),
            "credit_exclusions": cat.get("credit_exclusions", ""),
            "course_url": cat.get("course_url", ""),
            "not_offered_flag": cat.get("not_offered_flag", False),
            "new_subject_flag": cat.get("new_subject_flag", False),
            "can_repeat_flag": cat.get("can_repeat_flag", False),
            "notes_raw": cat.get("notes_raw", ""),
            "source_url": cat.get("source_url", ""),

            # From schedule
            "meeting_times_raw": sched.get("meeting_times_raw", ""),
            "instructors": sched.get("instructors", []),
            "instructor_by_term": sched.get("instructor_by_term", {}),
            "locations_raw": sched.get("locations_raw", []),
            "has_final": sched.get("has_final", False),
            "format_raw": sched.get("format_raw", []),
            "sections_raw": sched.get("sections_raw", ""),
            "offered_spring_2026": sched.get("offered_spring_2026", False),
            "offered_iap_2026": sched.get("offered_iap_2026", False),

            # Derived convenience fields
            "terms_offered": cat.get("terms_offered", []),
            "term": "IAP/Spring 2026",  # the catalog is for this term
        }

        merged.append(record)

    # Check for schedule records with no catalog match (unlikely but possible)
    catalog_codes = {r["subject_code"] for r in catalog_records}
    orphan_count = 0
    for code, sched in schedule_by_code.items():
        if code not in catalog_codes:
            orphan_count += 1

    if orphan_count > 0:
        print(f"  NOTE: {orphan_count} schedule records had no catalog match")

    return merged


def merge_and_save(catalog_records=None, schedule_records=None):
    """
    Merge catalog + schedule data and save to merged_courses.json.

    If records aren't passed directly, loads from the processed JSON files.
    """
    # Load from files if not provided
    if catalog_records is None:
        catalog_path = os.path.join(PROCESSED_DIR, "catalog.json")
        if not os.path.exists(catalog_path):
            print("ERROR: catalog.json not found. Run parse_catalog first.")
            return []
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog_records = json.load(f)

    if schedule_records is None:
        schedule_path = os.path.join(PROCESSED_DIR, "schedule.json")
        if not os.path.exists(schedule_path):
            print("ERROR: schedule.json not found. Run parse_schedule first.")
            return []
        with open(schedule_path, "r", encoding="utf-8") as f:
            schedule_records = json.load(f)

    print(f"=== Merging {len(catalog_records)} catalog + {len(schedule_records)} schedule records ===")
    merged = merge_records(catalog_records, schedule_records)
    print(f"  Merged into {len(merged)} records")

    # Save
    output_path = os.path.join(PROCESSED_DIR, "merged_courses.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)
    print(f"  Saved to {output_path}")

    # Print some stats
    offered_spring = sum(1 for r in merged if r["offered_spring_2026"])
    offered_iap = sum(1 for r in merged if r["offered_iap_2026"])
    with_desc = sum(1 for r in merged if r["description"])
    with_times = sum(1 for r in merged if r["meeting_times_raw"])
    with_instructors = sum(1 for r in merged if r["instructors"])
    not_offered = sum(1 for r in merged if r["not_offered_flag"])

    print(f"\n  Stats:")
    print(f"    Offered Spring 2026: {offered_spring}")
    print(f"    Offered IAP 2026:    {offered_iap}")
    print(f"    Not offered:         {not_offered}")
    print(f"    With descriptions:   {with_desc}")
    print(f"    With meeting times:  {with_times}")
    print(f"    With instructors:    {with_instructors}")

    return merged


if __name__ == "__main__":
    merge_and_save()
