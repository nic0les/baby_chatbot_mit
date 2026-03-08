"""
Fetch schedule/offering data.

NOTE ON DATA SOURCES:
The MIT catalog pages (student.mit.edu/catalog/m*.html) embed schedule data
(meeting times, locations, instructors, term offerings) directly inline with
the catalog descriptions. There is no separate publicly accessible schedule
endpoint that provides better structured data.

This module provides a secondary approach: fetching the catalog index page
to extract department metadata, and noting that the raw schedule data
lives inside the same HTML files downloaded by fetch_catalog.py.

The parse_schedule.py module extracts schedule-specific fields from those
same raw catalog HTML files stored in data/raw/catalog/.
"""

import os
import re
from bs4 import BeautifulSoup
from .utils import (
    CATALOG_BASE_URL,
    RAW_CATALOG_DIR,
    RAW_SCHEDULE_DIR,
    fetch_url,
    ensure_dirs,
)


def fetch_schedule_index():
    """
    Fetch the catalog index page to extract department names and metadata.
    This supplements the catalog data with department-level info.

    Saves the index page to data/raw/schedule/index.html.
    Returns a dict mapping department start page -> department name.
    """
    ensure_dirs()

    url = CATALOG_BASE_URL + "index.cgi"
    print("=== Fetching schedule index ===")
    print(f"  Fetching {url}...")
    html = fetch_url(url)
    if html is None:
        print("  WARNING: Could not fetch catalog index")
        return {}

    filepath = os.path.join(RAW_SCHEDULE_DIR, "index.html")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)

    # Parse department names from the index
    soup = BeautifulSoup(html, "html.parser")
    departments = {}

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if re.match(r"m[A-Za-z0-9]+a\.html$", href):
            dept_name = link.get_text(strip=True)
            if dept_name:
                departments[href] = dept_name

    print(f"  Found {len(departments)} departments in index")
    for page, name in sorted(departments.items()):
        print(f"    {page}: {name}")

    return departments


def verify_catalog_files():
    """
    Check that catalog HTML files exist (fetched by fetch_catalog.py).
    Schedule parsing depends on these files.

    Returns list of available catalog HTML files.
    """
    if not os.path.exists(RAW_CATALOG_DIR):
        print("  WARNING: No catalog files found. Run fetch_catalog first.")
        return []

    files = sorted(f for f in os.listdir(RAW_CATALOG_DIR) if f.endswith(".html"))
    print(f"  Found {len(files)} catalog HTML files for schedule parsing")
    return files


if __name__ == "__main__":
    fetch_schedule_index()
    verify_catalog_files()
