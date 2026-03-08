# MIT Course Scraper

Scrapes, parses, and stores MIT course catalog data for **IAP/Spring 2026**, producing structured JSON and SQLite outputs suitable for building a course-advising chatbot.

## What it collects

The pipeline scrapes the MIT Registrar's online catalog at `student.mit.edu/catalog/` — the same pages students use to browse subjects. It covers **all departments and programs** listed in the catalog index (47+ department start pages, often with multiple sub-pages each).

For each subject it extracts:

| Field | Source | Example |
|---|---|---|
| `subject_code` | Catalog | `6.1010` |
| `title` | Catalog | `Fundamentals of Programming` |
| `description` | Catalog | Full paragraph description |
| `department` | Catalog | `Course 6: Electrical Engineering and Computer Science` |
| `units` | Catalog | `2-4-6` |
| `prereq_text` | Catalog | `6.1000 or (6.100A and (6.100B or 16.C20))` |
| `coreq_text` | Catalog | `18.03` |
| `subject_level_raw` | Catalog icons | `Undergraduate` or `Graduate` |
| `requirement_tags` | Catalog icons | `["REST"]`, `["HASS-H", "CI-H"]` |
| `terms_offered` | Catalog icons | `["Fall", "Spring"]` |
| `meeting_times_raw` | Catalog inline | `Lecture: MW9 (32-124) or MW2 (4-163) ...` |
| `instructors` | Catalog inline | `["A. Hartz"]` |
| `instructor_by_term` | Catalog inline | `{"Fall": "M. Goldman", "Spring": "A. Hartz"}` |
| `locations_raw` | Catalog inline | `["32-124", "4-163"]` |
| `format_raw` | Catalog inline | `["Lecture", "Lab"]` |
| `has_final` | Catalog inline | `true` / `false` |
| `cross_listings` | Catalog | `(Subject meets with 6.5081)` |
| `credit_exclusions` | Catalog | `Credit cannot also be received for ...` |
| `course_url` | Catalog | `https://py.mit.edu/` |
| `not_offered_flag` | Catalog icons | Whether marked not offered this year |
| `offered_spring_2026` | Catalog icons | `true` if Spring icon present |
| `offered_iap_2026` | Catalog icons | `true` if IAP icon present |
| `notes_raw` | Catalog | Catch-all for other metadata |

## Installation

```bash
cd mit_course_scraper
pip install -r requirements.txt
```

Requires Python 3.8+.

## Usage

Run the full pipeline:

```bash
cd mit_course_scraper
python -m scrapers
```

Options:

```bash
python -m scrapers --skip-fetch   # parse existing HTML, skip downloading
python -m scrapers --fetch-only   # download only, skip parsing
```

The pipeline takes ~2-3 minutes (dominated by polite 1-second delays between HTTP requests).

## Project structure

```
mit_course_scraper/
├── scrapers/
│   ├── __init__.py
│   ├── __main__.py          # Pipeline orchestrator
│   ├── fetch_catalog.py     # Download all catalog HTML pages
│   ├── fetch_schedule.py    # Download schedule index + verify files
│   ├── parse_catalog.py     # Parse subject metadata from HTML
│   ├── parse_schedule.py    # Parse schedule/offering data from HTML
│   ├── merge.py             # Merge catalog + schedule by subject code
│   ├── db.py                # Build SQLite database
│   └── utils.py             # Shared constants and helpers
├── data/
│   ├── raw/
│   │   ├── catalog/         # Raw HTML files (m1a.html, m6a.html, ...)
│   │   └── schedule/        # Index page
│   └── processed/
│       ├── catalog.json     # Parsed catalog records
│       ├── schedule.json    # Parsed schedule records
│       ├── merged_courses.json  # Merged output
│       └── courses.db       # SQLite database
├── README.md
└── requirements.txt
```

## Where data is stored

| Artifact | Path | Format |
|---|---|---|
| Raw HTML | `data/raw/catalog/*.html` | HTML |
| Catalog index | `data/raw/schedule/index.html` | HTML |
| Parsed catalog | `data/processed/catalog.json` | JSON array |
| Parsed schedule | `data/processed/schedule.json` | JSON array |
| Merged output | `data/processed/merged_courses.json` | JSON array |
| SQLite database | `data/processed/courses.db` | SQLite |

## SQLite schema

### `subjects` table

All course data in a flat table. List/dict fields are stored as JSON strings.

```sql
SELECT subject_code, title, instructors, meeting_times_raw
FROM subjects
WHERE offered_spring_2026 = 1
  AND subject_code LIKE '6.%'
ORDER BY subject_code;
```

### `offerings` table

Per-term instructor assignments (one row per subject-term pair):

```sql
SELECT * FROM offerings WHERE term = 'Spring';
```

## Assumptions and limitations

### Data source

- **Single source**: The MIT catalog at `student.mit.edu/catalog/` is the sole data source. It embeds both catalog metadata and schedule information inline. There is no separate structured schedule API.
- **Term**: The catalog is published for **IAP/Spring 2026**. Historical or future term data is not captured.

### Parsing assumptions

- **Entry boundaries**: Course entries are delimited by `<!--end-->` HTML comments. Subject codes come from `<a name="CODE">` anchors.
- **Icons**: Term offerings, level (undergrad/grad), and requirement tags are encoded as small GIF icons (`/icns/*.gif`). The parser maps known icon filenames to labels. Unknown icons are silently ignored.
- **Prerequisites**: Stored as raw text. Prerequisite logic (AND/OR/parentheses) is preserved as-is but not structurally parsed.
- **Meeting times**: Stored as raw text. Day/time formats like `MW3-4.30`, `TR1-2.30`, `F10-12` are MIT-specific (M=Mon, T=Tue, W=Wed, R=Thu, F=Fri).
- **Instructors**: Extracted from `<I>` tags and "Term: Name" patterns. Some entries list only "Staff".
- **Descriptions**: The text block between the second `<hr>` image and the instructor line. Some subjects may have empty descriptions.

### Known gaps

- **Corequisites**: The `Prereq: None. Coreq: 18.03` pattern is handled, but other coreq formats may be missed.
- **Section details**: Multiple lecture/recitation sections are captured as raw text, not as structured section objects.
- **P/D/F grading, half-term, and other annotations**: These appear in some entries but are only partially captured in `notes_raw`.
- **Cross-listed subjects**: Both copies appear as separate records. Merging cross-listings is left for later.
- **New/changed subjects**: Subjects marked "(New)" have the flag captured but the label is stripped from the title.

### What may need adjustment

After running the pipeline and inspecting the output:

1. **Icon mapping**: Check if any new icon filenames appear that aren't in `ICON_LABELS` (in `utils.py`).
2. **Description extraction**: The "second HR separator" heuristic may occasionally grab extra or miss text. Inspect a sample.
3. **Instructor parsing**: Some entries have unconventional instructor formats. Check the `instructors` field for oddities.
4. **Subject code edge cases**: Codes like `21H.001`, `HST.010`, `ES.111` should parse fine, but check.
5. **Encoding**: Pages use ISO-8859-1. The fetcher reads as UTF-8 with error replacement; some special characters may be mangled.

## Next steps for chatbot

This pipeline produces the raw dataset. To make it useful for a course-advising chatbot:

1. **Prerequisite parsing**: Parse prerequisite text into a structured graph (AND/OR tree).
2. **Meeting time parsing**: Parse `MW3-4.30` into structured day/time/duration objects for schedule conflict detection.
3. **Embeddings**: Generate embeddings from descriptions + titles for semantic search ("courses about machine learning").
4. **Filtering API**: Build query functions over SQLite (by department, level, requirement tags, time, term).
5. **Cross-listing resolution**: Merge cross-listed subjects into canonical entries.
6. **Incremental updates**: Add logic to re-fetch only changed pages.
7. **Chatbot retrieval layer**: Combine keyword search, SQL filters, and semantic search for the chatbot's retrieval pipeline.
