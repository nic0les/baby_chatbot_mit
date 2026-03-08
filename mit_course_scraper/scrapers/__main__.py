"""
MIT Course Scraper - Main Pipeline Orchestrator

Runs the full pipeline:
  1. Fetch raw catalog HTML pages
  2. Fetch schedule index (supplementary)
  3. Parse catalog data from raw HTML
  4. Parse schedule data from raw HTML
  5. Merge catalog + schedule by subject code
  6. Build SQLite database

Usage:
  python -m scrapers              # run full pipeline
  python -m scrapers --skip-fetch  # skip fetching, parse existing HTML
  python -m scrapers --fetch-only  # fetch only, don't parse
"""

import sys
import time

from .fetch_catalog import fetch_all_catalog_pages
from .fetch_schedule import fetch_schedule_index, verify_catalog_files
from .parse_catalog import parse_all_catalog
from .parse_schedule import parse_all_schedule
from .merge import merge_and_save
from .db import build_db
from .utils import ensure_dirs


def main():
    args = sys.argv[1:]
    skip_fetch = "--skip-fetch" in args
    fetch_only = "--fetch-only" in args

    ensure_dirs()
    start_time = time.time()

    print("=" * 60)
    print("  MIT Course Scraper Pipeline")
    print("  IAP/Spring 2026 Course Data")
    print("=" * 60)
    print()

    # --- Step 1: Fetch ---
    if not skip_fetch:
        print("STEP 1/6: Fetching catalog pages...")
        print("-" * 40)
        saved_pages = fetch_all_catalog_pages()
        print()

        print("STEP 2/6: Fetching schedule index...")
        print("-" * 40)
        departments = fetch_schedule_index()
        catalog_files = verify_catalog_files()
        print()
    else:
        print("STEP 1-2: Skipping fetch (--skip-fetch)")
        print()

    if fetch_only:
        print("Done (--fetch-only mode)")
        return

    # --- Step 2: Parse ---
    print("STEP 3/6: Parsing catalog data...")
    print("-" * 40)
    catalog_records = parse_all_catalog()
    print()

    print("STEP 4/6: Parsing schedule data...")
    print("-" * 40)
    schedule_records = parse_all_schedule()
    print()

    # --- Step 3: Merge ---
    print("STEP 5/6: Merging catalog + schedule...")
    print("-" * 40)
    merged = merge_and_save(catalog_records, schedule_records)
    print()

    # --- Step 4: SQLite ---
    print("STEP 6/6: Building SQLite database...")
    print("-" * 40)
    build_db(merged)
    print()

    # --- Done ---
    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"  Pipeline complete in {elapsed:.1f}s")
    print(f"  Total subjects: {len(merged)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
