"""
Fetch all MIT catalog pages and save raw HTML locally.

Strategy:
1. Start from the known department start pages (e.g. m6a.html).
2. For each start page, discover sub-pages from the navigation bar
   (e.g. m6b.html, m6c.html, ...).
3. Download every discovered page and save to data/raw/catalog/.

The catalog pages contain BOTH catalog metadata (descriptions, prereqs, units)
AND schedule/offering data (meeting times, locations, instructors) inline.
"""

import os
import re
from bs4 import BeautifulSoup
from .utils import (
    CATALOG_BASE_URL,
    DEPARTMENT_START_PAGES,
    RAW_CATALOG_DIR,
    fetch_url,
    ensure_dirs,
)


def discover_subpages(html, start_page):
    """
    Given the HTML of a department start page, find all sub-page links
    in the navigation bar (e.g. m6b.html, m6c.html).

    The navigation bar is a <table> near the top with links like:
      <a href="m6b.html">6.20/6.60</a>

    Returns a list of page filenames including the start page itself.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Extract the department prefix pattern from the start page filename.
    # e.g. "m6a.html" -> prefix "m6", "m21Ha.html" -> prefix "m21H"
    match = re.match(r"(m[^a-z]*[A-Z]*)a\.html", start_page)
    if not match:
        # Fallback: just return the start page
        return [start_page]

    prefix = match.group(1)
    pages = {start_page}

    # Find all links that match the same department prefix pattern
    for link in soup.find_all("a", href=True):
        href = link["href"]
        # Match links like m6b.html, m6c.html, etc.
        if re.match(re.escape(prefix) + r"[a-z]\.html$", href):
            pages.add(href)

    return sorted(pages)


def fetch_all_catalog_pages():
    """
    Discover and download all catalog pages for all departments.
    Saves raw HTML to data/raw/catalog/<filename>.

    Returns a list of (filename, filepath) tuples for successfully saved pages.
    """
    ensure_dirs()

    all_pages = set()

    # Phase 1: discover all sub-pages for each department
    print("=== Phase 1: Discovering catalog pages ===")
    for start_page in DEPARTMENT_START_PAGES:
        url = CATALOG_BASE_URL + start_page
        filepath = os.path.join(RAW_CATALOG_DIR, start_page)

        # If we already downloaded this page (shared sub-page), skip discovery
        if start_page in all_pages:
            continue

        print(f"  Discovering pages from {start_page}...")
        html = fetch_url(url)
        if html is None:
            print(f"  WARNING: Could not fetch {start_page}, skipping department")
            continue

        # Save the start page
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        all_pages.add(start_page)

        # Discover sub-pages
        subpages = discover_subpages(html, start_page)
        for page in subpages:
            if page not in all_pages:
                all_pages.add(page)

    # Phase 2: download any sub-pages we haven't fetched yet
    print(f"\n=== Phase 2: Downloading {len(all_pages)} total catalog pages ===")
    saved = []
    for page in sorted(all_pages):
        filepath = os.path.join(RAW_CATALOG_DIR, page)

        if os.path.exists(filepath):
            # Already saved during discovery
            print(f"  [cached] {page}")
            saved.append((page, filepath))
            continue

        url = CATALOG_BASE_URL + page
        print(f"  Fetching {page}...")
        html = fetch_url(url)
        if html is None:
            continue

        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)
        saved.append((page, filepath))

    print(f"\nSaved {len(saved)} catalog pages to {RAW_CATALOG_DIR}")
    return saved


if __name__ == "__main__":
    fetch_all_catalog_pages()
