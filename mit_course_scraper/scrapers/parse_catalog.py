"""
Parse catalog metadata from raw MIT catalog HTML files.

Each catalog page contains course entries delimited by:
  <a name="SUBJECT_CODE"></a>
  <p><h3>CODE TITLE ...</h3>
    ... metadata lines (separated by <br>) ...
    <img hr.gif>        ← second HR separator
    ... description ...
    <br>Fall: <I>Name</I>
    <br>No textbook...
  </p><!--end-->

This module extracts catalog-specific fields.
"""

import os
import re
import json
from bs4 import BeautifulSoup
from .utils import RAW_CATALOG_DIR, PROCESSED_DIR, CATALOG_BASE_URL, ICON_LABELS


def extract_department_from_html(soup, filename):
    """Extract department name from the page <title>."""
    title_tag = soup.find("title")
    if title_tag:
        text = title_tag.get_text(strip=True)
        match = re.search(r"(Course\s+\S+:\s+.+?)$", text)
        if match:
            return match.group(1).strip()
        # For non-numbered departments, return everything after the year
        match2 = re.search(r"\d{4}\s+(.+)$", text)
        if match2:
            return match2.group(1).strip()
        return text
    return filename


def parse_icons(entry_html):
    """
    Extract semantic labels from <img> icons in a course entry's raw HTML.
    Returns: (level, terms, requirement_tags, flags)
    """
    level = None
    terms = []
    requirement_tags = []
    flags = []

    for match in re.finditer(r'<img[^>]*src="/icns/([^"]+)"[^>]*>', entry_html, re.IGNORECASE):
        icon_file = match.group(1)
        label = ICON_LABELS.get(icon_file)

        if label is None:
            continue

        if label in ("Undergraduate", "Graduate"):
            level = label
        elif label in ("Fall", "Spring", "IAP", "Summer"):
            terms.append(label)
        elif label in ("Not offered this year", "Not offered next year", "Cancelled"):
            flags.append(label)
        elif label in ("New subject", "Can be repeated for credit"):
            flags.append(label)
        else:
            requirement_tags.append(label)

    return level, terms, requirement_tags, flags


def parse_single_entry(entry_html, source_url, department):
    """
    Parse a single course entry from raw HTML.

    Uses a hybrid approach: regex on raw HTML for structure-sensitive parts,
    BeautifulSoup for text extraction where needed.
    """
    record = {
        "subject_code": "",
        "title": "",
        "description": "",
        "department": department,
        "prereq_text": "",
        "coreq_text": "",
        "units": "",
        "subject_level_raw": "",
        "terms_offered": [],
        "requirement_tags": [],
        "cross_listings": "",
        "credit_exclusions": "",
        "course_url": "",
        "notes_raw": "",
        "not_offered_flag": False,
        "new_subject_flag": False,
        "can_repeat_flag": False,
        "source_url": source_url,
    }

    # --- Extract subject code and title from <h3> ---
    h3_match = re.search(r"<h3>(.*?)</h3>", entry_html, re.DOTALL | re.IGNORECASE)
    if not h3_match:
        return None

    h3_soup = BeautifulSoup(h3_match.group(1), "html.parser")
    h3_text = h3_soup.get_text(separator=" ", strip=True)
    # Remove hr alt text and (New) marker
    h3_text = h3_text.replace("______", "").strip()
    h3_text = re.sub(r"\s*\(New\)\s*", " ", h3_text).strip()
    h3_text = re.sub(r"\s+", " ", h3_text).strip()

    code_match = re.match(r"^(\S+)\s+(.+)$", h3_text)
    if code_match:
        raw_code = code_match.group(1)
        record["title"] = code_match.group(2).strip()
    else:
        raw_code = h3_text.strip()

    # Subject codes sometimes include [J] suffix for joint subjects.
    # Store the clean code and note the [J] in cross_listings if present.
    if raw_code.endswith("[J]"):
        record["subject_code"] = raw_code[:-3]
        if not record["cross_listings"]:
            record["cross_listings"] = "Joint subject"
    else:
        record["subject_code"] = raw_code

    # Check for (New) in h3
    if "(New)" in h3_match.group(1):
        record["new_subject_flag"] = True

    # --- Extract icons ---
    level, terms, req_tags, flags = parse_icons(entry_html)
    record["subject_level_raw"] = level or ""
    record["terms_offered"] = terms
    record["requirement_tags"] = req_tags
    if "Not offered this year" in flags:
        record["not_offered_flag"] = True
    if "New subject" in flags:
        record["new_subject_flag"] = True
    if "Can be repeated for credit" in flags:
        record["can_repeat_flag"] = True

    # --- Split entry into metadata section and description section ---
    # The second <img src="/icns/hr.gif"> (after the one inside <h3>) separates
    # metadata from description. We split on it.
    #
    # Structure:  <h3>...hr.gif...</h3> [metadata lines] <br>hr.gif<br> [description] <br>[instructors]

    # Remove the <h3>...</h3> first, then find the hr.gif separator
    after_h3 = entry_html[h3_match.end():]

    # Split on the second hr.gif (the one outside h3)
    hr_pattern = r'<img[^>]*src="/icns/hr\.gif"[^>]*>'
    hr_split = re.split(hr_pattern, after_h3, maxsplit=1)

    metadata_html = hr_split[0] if len(hr_split) > 0 else ""
    description_html = hr_split[1] if len(hr_split) > 1 else ""

    # --- Parse metadata lines ---
    # Convert <br> to newlines for line-by-line parsing
    meta_soup = BeautifulSoup(metadata_html, "html.parser")
    # Replace <br> with newlines
    for br in meta_soup.find_all("br"):
        br.replace_with("\n")
    meta_text = meta_soup.get_text()
    meta_lines = [l.strip() for l in meta_text.split("\n") if l.strip()]

    notes = []
    for line in meta_lines:
        if line.startswith("Prereq:"):
            prereq = line[len("Prereq:"):].strip()
            # Handle "Prereq: None. Coreq: 18.03" pattern
            coreq_match = re.search(r"Coreq:\s*(.+)", prereq)
            if coreq_match:
                record["coreq_text"] = coreq_match.group(1).strip()
                prereq = prereq[:coreq_match.start()].strip().rstrip(".")
            record["prereq_text"] = prereq

        elif line.startswith("Coreq:"):
            record["coreq_text"] = line[len("Coreq:"):].strip()

        elif line.startswith("Units:"):
            record["units"] = line[len("Units:"):].strip()

        elif line.startswith("Credit cannot also be received for"):
            # Get the full line with linked subject codes
            excl_soup = BeautifulSoup(metadata_html, "html.parser")
            for br in excl_soup.find_all("br"):
                br.replace_with("\n")
            excl_text = excl_soup.get_text()
            for el in excl_text.split("\n"):
                if "Credit cannot also be received for" in el:
                    record["credit_exclusions"] = el.strip()
                    break
            if not record["credit_exclusions"]:
                record["credit_exclusions"] = line

        elif line.startswith("(Subject meets with"):
            record["cross_listings"] = line

        elif line.startswith("URL:"):
            record["course_url"] = line[len("URL:"):].strip()

        elif line.startswith("Not offered regularly"):
            notes.append(line)

    # Better extraction of credit exclusions from raw HTML
    # since get_text() without separator fragments the linked codes
    if "Credit cannot also be received for" in metadata_html:
        excl_match = re.search(
            r"Credit cannot also be received for\s*(.*?)(?:<br|$)",
            metadata_html, re.DOTALL | re.IGNORECASE
        )
        if excl_match:
            excl_soup = BeautifulSoup(
                "Credit cannot also be received for " + excl_match.group(1),
                "html.parser"
            )
            record["credit_exclusions"] = excl_soup.get_text(separator=" ", strip=True)
            # Clean up extra whitespace
            record["credit_exclusions"] = re.sub(r"\s+", " ", record["credit_exclusions"]).strip()

    # Better cross-listing extraction
    if "(Subject meets with" in metadata_html:
        cross_match = re.search(
            r"\(Subject meets with\s*(.*?)\)",
            metadata_html, re.DOTALL | re.IGNORECASE
        )
        if cross_match:
            cross_soup = BeautifulSoup(cross_match.group(1), "html.parser")
            codes = cross_soup.get_text(separator=", ", strip=True)
            record["cross_listings"] = f"(Subject meets with {codes})"

    # Better prereq extraction from HTML (preserves spaces between linked codes)
    if "Prereq:" in metadata_html:
        prereq_match = re.search(
            r"Prereq:\s*(.*?)(?:<br|$)",
            metadata_html, re.DOTALL | re.IGNORECASE
        )
        if prereq_match:
            prereq_soup = BeautifulSoup(prereq_match.group(1), "html.parser")
            prereq_text = prereq_soup.get_text(separator=" ", strip=True)
            prereq_text = re.sub(r"\s+", " ", prereq_text).strip()
            # Handle embedded coreq
            coreq_match = re.search(r"Coreq:\s*(.+)", prereq_text)
            if coreq_match:
                record["coreq_text"] = coreq_match.group(1).strip()
                prereq_text = prereq_text[:coreq_match.start()].strip().rstrip(".")
            record["prereq_text"] = prereq_text

    # Better URL extraction
    if "URL:" in metadata_html:
        url_match = re.search(
            r'URL:\s*<a\s+href="([^"]+)"',
            metadata_html, re.IGNORECASE
        )
        if url_match:
            record["course_url"] = url_match.group(1)

    # --- Parse description ---
    if description_html:
        desc_soup = BeautifulSoup(description_html, "html.parser")
        for br in desc_soup.find_all("br"):
            br.replace_with("\n")
        desc_text = desc_soup.get_text()
        desc_lines = [l.strip() for l in desc_text.split("\n") if l.strip()]

        # Description is everything before instructor lines or textbook info
        description_parts = []
        for line in desc_lines:
            # Stop at instructor lines
            if re.match(r"^(Fall|Spring|IAP|Summer):\s+", line):
                break
            if line in ("Staff",):
                break
            if line.startswith("No textbook"):
                break
            # Skip schedule comment markers
            if line.startswith("<!--"):
                continue
            description_parts.append(line)

        record["description"] = " ".join(description_parts).strip()

    record["notes_raw"] = "; ".join(notes) if notes else ""

    return record


def parse_catalog_file(filepath, filename):
    """
    Parse all course entries from a single catalog HTML file.
    Returns a list of parsed record dicts.
    """
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")
    department = extract_department_from_html(soup, filename)

    records = []

    # Split entries by <!--end-->
    entries = re.split(r"<!--end-->", html)

    for entry_html in entries:
        anchor_match = re.search(r'<a\s+name="([^"]+)"', entry_html, re.IGNORECASE)
        if not anchor_match:
            continue

        subject_code = anchor_match.group(1)
        source_url = CATALOG_BASE_URL + filename + "#" + subject_code

        record = parse_single_entry(entry_html, source_url, department)
        if record and record["subject_code"]:
            records.append(record)

    return records


def parse_all_catalog():
    """
    Parse all saved catalog HTML files.
    Returns a list of all parsed records and saves to catalog.json.
    """
    if not os.path.exists(RAW_CATALOG_DIR):
        print("ERROR: No raw catalog data found. Run fetch_catalog first.")
        return []

    files = sorted(f for f in os.listdir(RAW_CATALOG_DIR) if f.endswith(".html"))
    if not files:
        print("ERROR: No HTML files in raw catalog directory.")
        return []

    print(f"=== Parsing {len(files)} catalog files ===")
    all_records = []

    for filename in files:
        filepath = os.path.join(RAW_CATALOG_DIR, filename)
        print(f"  Parsing {filename}...")
        records = parse_catalog_file(filepath, filename)
        print(f"    Found {len(records)} subjects")
        all_records.extend(records)

    print(f"\nTotal catalog records: {len(all_records)}")

    # Save to JSON
    output_path = os.path.join(PROCESSED_DIR, "catalog.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_records, f, indent=2, ensure_ascii=False)
    print(f"Saved catalog data to {output_path}")

    return all_records


if __name__ == "__main__":
    parse_all_catalog()
