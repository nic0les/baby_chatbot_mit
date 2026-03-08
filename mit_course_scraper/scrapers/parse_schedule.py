"""
Parse schedule/offering data from the same raw MIT catalog HTML files.

The MIT catalog pages embed schedule data inline:
  - Meeting times: <b>Lecture:</b> <i>MW3-4.30</i> (<a>34-101</a>)
  - Instructors:   Fall: <I>A. Wang</I>  or  Spring: <I>J. Doe</I>
  - Locations:     linked via whereis.mit.edu
  - Final exam:    <b>+final</b>

This module extracts schedule-specific fields from data/raw/catalog/ HTML.
"""

import os
import re
import json
from bs4 import BeautifulSoup
from .utils import RAW_CATALOG_DIR, PROCESSED_DIR, CATALOG_BASE_URL, ICON_LABELS


def extract_schedule_from_entry(entry_html, subject_code):
    """
    Extract schedule-specific fields from a single course entry HTML chunk.
    Uses regex on raw HTML for reliable extraction.
    """
    record = {
        "subject_code": subject_code,
        "meeting_times_raw": "",
        "instructors": [],
        "locations_raw": [],
        "has_final": False,
        "sections_raw": "",
        "format_raw": [],
        "offered_spring_2026": False,
        "offered_iap_2026": False,
        "instructor_by_term": {},
    }

    # --- Check term icons ---
    for match in re.finditer(r'<img[^>]*src="/icns/([^"]+)"', entry_html, re.IGNORECASE):
        icon = match.group(1)
        if icon == "spring.gif":
            record["offered_spring_2026"] = True
        elif icon == "iap.gif":
            record["offered_iap_2026"] = True

    # --- Check for +final ---
    if re.search(r"\+final", entry_html, re.IGNORECASE):
        record["has_final"] = True

    # --- Extract meeting times from raw HTML ---
    # Schedule lines look like:
    #   <b>Lecture:</b> <i>MW3-4.30</i> (<a href="...">34-101</a>)
    #   <b>Recitation:</b> <i>F10</i> (...) or <i>F11</i> (...)
    # They appear between the metadata lines and <!--s--> or the second hr.gif

    # Find the schedule section: starts with first <b>Lecture/Recitation/Lab/etc:</b>
    # and ends with <!--s--> comment or <br><img hr.gif>
    schedule_match = re.search(
        r'(<b>(?:Lecture|Recitation|Lab|Seminar|Design|Lecture/Seminar):?</b>.*?)(?:<!--s-->|<br>\s*<img[^>]*hr\.gif)',
        entry_html, re.DOTALL | re.IGNORECASE
    )

    if schedule_match:
        sched_html = schedule_match.group(1)

        # Extract format types
        for fmt_match in re.finditer(r"<b>(Lecture|Recitation|Lab|Seminar|Design|Lecture/Seminar):?</b>",
                                     sched_html, re.IGNORECASE):
            record["format_raw"].append(fmt_match.group(1))

        # Convert to readable text
        sched_soup = BeautifulSoup(sched_html, "html.parser")
        record["meeting_times_raw"] = sched_soup.get_text(separator=" ", strip=True)
        record["meeting_times_raw"] = re.sub(r"\s+", " ", record["meeting_times_raw"]).strip()
        # Remove +final from meeting times text
        record["meeting_times_raw"] = re.sub(r"\s*\+final\s*", " ", record["meeting_times_raw"]).strip()

    # --- Extract locations ---
    locations = []
    for loc_match in re.finditer(r'<a[^>]*href="[^"]*whereis\.mit\.edu[^"]*"[^>]*>([^<]+)</a>',
                                  entry_html, re.IGNORECASE):
        loc = loc_match.group(1).strip()
        if loc and loc not in locations:
            locations.append(loc)
    record["locations_raw"] = locations

    # --- Extract instructors ---
    # Instructors appear after the description section (after the second hr.gif)
    # Pattern: <br>Fall: <I>A. Wang</I><br>Spring: <I>J. Doe</I>
    # Or just: <br><I>Staff</I> or <br>Staff<br>

    # Find the description section (after second hr.gif, before </p>)
    # Split on hr.gif images, take the last section
    hr_pattern = r'<img[^>]*src="/icns/hr\.gif"[^>]*>'
    parts = re.split(hr_pattern, entry_html)

    instructor_by_term = {}
    all_instructors = set()

    if len(parts) >= 2:
        # The last part after the final hr.gif contains description + instructors
        desc_section = parts[-1]

        # Find term-specific instructor patterns
        for term_match in re.finditer(
            r'<br>\s*(Fall|Spring|IAP|Summer):\s*<[Ii]>([^<]+)</[Ii]>',
            desc_section, re.IGNORECASE
        ):
            term = term_match.group(1)
            name = term_match.group(2).strip()
            # Clean up HTML entities
            name = name.replace("&nbsp;", "").replace("&amp;", "&").strip()
            instructor_by_term[term] = name
            for n in re.split(r",\s*", name):
                n = n.strip()
                if n:
                    all_instructors.add(n)

        # Find standalone instructor (no term prefix)
        # Pattern: after description text, <br><I>Name</I><br> without "Fall:/Spring:" prefix
        # This is for subjects with a single instructor not tagged by term
        if not instructor_by_term:
            # Look for <I>Name</I> at the end of the section
            standalone_matches = re.findall(
                r'<br>\s*<[Ii]>([^<]+)</[Ii]>\s*(?:<br>|$)',
                desc_section, re.IGNORECASE
            )
            for name in standalone_matches:
                name = name.replace("&nbsp;", "").replace("&amp;", "&").strip()
                # Filter out time patterns (MW3-4.30 etc)
                if re.match(r'^[MTWRF]', name) and re.search(r'\d', name):
                    continue
                if name == "TBA":
                    continue
                if name == "+final":
                    continue
                if name:
                    all_instructors.add(name)

        # Check for "Staff" without italic
        if re.search(r'<br>\s*Staff\s*<br>', desc_section, re.IGNORECASE):
            all_instructors.add("Staff")

    record["instructors"] = sorted(all_instructors)
    record["instructor_by_term"] = instructor_by_term

    # --- Build sections_raw summary ---
    parts_list = []
    if record["format_raw"]:
        parts_list.append("Format: " + ", ".join(record["format_raw"]))
    if record["meeting_times_raw"]:
        parts_list.append(record["meeting_times_raw"])
    record["sections_raw"] = "; ".join(parts_list) if parts_list else ""

    return record


def parse_schedule_file(filepath, filename):
    """Parse schedule data from a single catalog HTML file."""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()

    records = []
    entries = re.split(r"<!--end-->", html)

    for entry_html in entries:
        anchor_match = re.search(r'<a\s+name="([^"]+)"', entry_html, re.IGNORECASE)
        if not anchor_match:
            continue

        subject_code = anchor_match.group(1)
        record = extract_schedule_from_entry(entry_html, subject_code)
        if record:
            records.append(record)

    return records


def parse_all_schedule():
    """
    Parse schedule data from all saved catalog HTML files.
    Returns a list of all schedule records and saves to schedule.json.
    """
    if not os.path.exists(RAW_CATALOG_DIR):
        print("ERROR: No raw catalog data found. Run fetch_catalog first.")
        return []

    files = sorted(f for f in os.listdir(RAW_CATALOG_DIR) if f.endswith(".html"))
    if not files:
        print("ERROR: No HTML files found.")
        return []

    print(f"=== Parsing schedule data from {len(files)} catalog files ===")
    all_records = []

    for filename in files:
        filepath = os.path.join(RAW_CATALOG_DIR, filename)
        print(f"  Parsing schedule from {filename}...")
        records = parse_schedule_file(filepath, filename)
        print(f"    Found {len(records)} schedule entries")
        all_records.extend(records)

    print(f"\nTotal schedule records: {len(all_records)}")

    output_path = os.path.join(PROCESSED_DIR, "schedule.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    print(f"Saved schedule data to {output_path}")

    return all_records


if __name__ == "__main__":
    parse_all_schedule()
