"""
SQLite storage for parsed MIT course data.

Creates a courses.db with a `subjects` table and optionally an `offerings` table.
Designed to be simple but extensible for later chatbot queries.
"""

import os
import json
import sqlite3
from .utils import PROCESSED_DIR


DB_PATH = os.path.join(PROCESSED_DIR, "courses.db")

SUBJECTS_SCHEMA = """
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    department TEXT,
    term TEXT,
    units TEXT,
    prereq_text TEXT,
    coreq_text TEXT,
    instructors TEXT,
    meeting_times_raw TEXT,
    location_raw TEXT,
    format_raw TEXT,
    subject_level_raw TEXT,
    requirement_tags TEXT,
    cross_listings TEXT,
    credit_exclusions TEXT,
    course_url TEXT,
    notes_raw TEXT,
    sections_raw TEXT,
    has_final INTEGER DEFAULT 0,
    offered_spring_2026 INTEGER DEFAULT 0,
    offered_iap_2026 INTEGER DEFAULT 0,
    not_offered_flag INTEGER DEFAULT 0,
    new_subject_flag INTEGER DEFAULT 0,
    can_repeat_flag INTEGER DEFAULT 0,
    source_url TEXT
);
"""

# Optional: a separate offerings table for per-term instructor data
OFFERINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS offerings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_code TEXT NOT NULL,
    term TEXT NOT NULL,
    instructor TEXT,
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code)
);
"""

# Index for fast lookups
INDEXES = [
    "CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(subject_code);",
    "CREATE INDEX IF NOT EXISTS idx_subjects_dept ON subjects(department);",
    "CREATE INDEX IF NOT EXISTS idx_subjects_spring ON subjects(offered_spring_2026);",
    "CREATE INDEX IF NOT EXISTS idx_subjects_iap ON subjects(offered_iap_2026);",
    "CREATE INDEX IF NOT EXISTS idx_offerings_code ON offerings(subject_code);",
]


def init_db():
    """Create the database and tables."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(SUBJECTS_SCHEMA)
    cursor.execute(OFFERINGS_SCHEMA)
    for idx_sql in INDEXES:
        cursor.execute(idx_sql)
    conn.commit()
    return conn


def _to_json_str(value):
    """Convert lists/dicts to JSON strings for storage. Pass through strings."""
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False)
    return value or ""


def insert_merged_records(conn, records):
    """Insert merged course records into the subjects table."""
    cursor = conn.cursor()

    # Clear existing data
    cursor.execute("DELETE FROM subjects")
    cursor.execute("DELETE FROM offerings")

    inserted = 0
    skipped = 0

    for rec in records:
        try:
            cursor.execute("""
                INSERT OR REPLACE INTO subjects (
                    subject_code, title, description, department, term,
                    units, prereq_text, coreq_text, instructors,
                    meeting_times_raw, location_raw, format_raw,
                    subject_level_raw, requirement_tags, cross_listings,
                    credit_exclusions, course_url, notes_raw, sections_raw,
                    has_final, offered_spring_2026, offered_iap_2026,
                    not_offered_flag, new_subject_flag, can_repeat_flag,
                    source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec.get("subject_code", ""),
                rec.get("title", ""),
                rec.get("description", ""),
                rec.get("department", ""),
                rec.get("term", ""),
                rec.get("units", ""),
                rec.get("prereq_text", ""),
                rec.get("coreq_text", ""),
                _to_json_str(rec.get("instructors", [])),
                rec.get("meeting_times_raw", ""),
                _to_json_str(rec.get("locations_raw", [])),
                _to_json_str(rec.get("format_raw", [])),
                rec.get("subject_level_raw", ""),
                _to_json_str(rec.get("requirement_tags", [])),
                rec.get("cross_listings", ""),
                rec.get("credit_exclusions", ""),
                rec.get("course_url", ""),
                rec.get("notes_raw", ""),
                rec.get("sections_raw", ""),
                1 if rec.get("has_final") else 0,
                1 if rec.get("offered_spring_2026") else 0,
                1 if rec.get("offered_iap_2026") else 0,
                1 if rec.get("not_offered_flag") else 0,
                1 if rec.get("new_subject_flag") else 0,
                1 if rec.get("can_repeat_flag") else 0,
                rec.get("source_url", ""),
            ))
            inserted += 1

            # Insert per-term instructor offerings
            instructor_by_term = rec.get("instructor_by_term", {})
            for term, instructor in instructor_by_term.items():
                cursor.execute(
                    "INSERT INTO offerings (subject_code, term, instructor) VALUES (?, ?, ?)",
                    (rec["subject_code"], term, instructor)
                )

        except sqlite3.Error as e:
            print(f"  WARNING: Could not insert {rec.get('subject_code', '?')}: {e}")
            skipped += 1

    conn.commit()
    print(f"  Inserted {inserted} subjects into SQLite ({skipped} skipped)")
    return inserted


def build_db(merged_records=None):
    """
    Build the SQLite database from merged records.
    Loads from merged_courses.json if records not provided.
    """
    if merged_records is None:
        merged_path = os.path.join(PROCESSED_DIR, "merged_courses.json")
        if not os.path.exists(merged_path):
            print("ERROR: merged_courses.json not found. Run merge first.")
            return
        with open(merged_path, "r", encoding="utf-8") as f:
            merged_records = json.load(f)

    print(f"=== Building SQLite database ===")
    conn = init_db()
    insert_merged_records(conn, merged_records)

    # Print a quick summary
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM subjects")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM subjects WHERE offered_spring_2026 = 1")
    spring = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM offerings")
    offerings_count = cursor.fetchone()[0]

    print(f"  Database: {DB_PATH}")
    print(f"  Total subjects: {total}")
    print(f"  Spring 2026 offerings: {spring}")
    print(f"  Term-instructor entries: {offerings_count}")

    conn.close()


if __name__ == "__main__":
    build_db()
