"""
Shared helpers for the MIT course scraper pipeline.
"""

import os
import time
import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
RAW_CATALOG_DIR = os.path.join(DATA_DIR, "raw", "catalog")
RAW_SCHEDULE_DIR = os.path.join(DATA_DIR, "raw", "schedule")
PROCESSED_DIR = os.path.join(DATA_DIR, "processed")

CATALOG_BASE_URL = "https://student.mit.edu/catalog/"

# ---------------------------------------------------------------------------
# Known department start pages (from the catalog index)
# ---------------------------------------------------------------------------

DEPARTMENT_START_PAGES = [
    "m1a.html", "m2a.html", "m3a.html", "m4a.html", "m5a.html",
    "m6a.html", "m7a.html", "m8a.html", "m9a.html", "m10a.html",
    "m11a.html", "m12a.html", "m14a.html", "m15a.html", "m16a.html",
    "m17a.html", "m18a.html", "m20a.html", "m21a.html",
    # Humanities sub-departments
    "m21Aa.html", "mCMSa.html", "m21Wa.html", "m21Ga.html",
    "m21Ha.html", "m21La.html", "m21Ma.html", "m21Ta.html", "mWGSa.html",
    # Other departments
    "m22a.html", "m24a.html",
    # Interdisciplinary / special programs
    "mCCa.html", "mCGa.html", "mCSBa.html", "mCSEa.html",
    "mECa.html", "mEMa.html", "mESa.html", "mHSTa.html",
    "mIDSa.html", "mMASa.html", "mSCMa.html",
    # ROTC & other
    "mASa.html", "mMSa.html", "mNSa.html",
    "mSTSa.html", "mSWEa.html", "mSPa.html",
]

# ---------------------------------------------------------------------------
# Icon filename -> semantic label mapping
# The catalog uses small gif icons to indicate subject attributes.
# ---------------------------------------------------------------------------

ICON_LABELS = {
    "under.gif": "Undergraduate",
    "grad.gif": "Graduate",
    "fall.gif": "Fall",
    "spring.gif": "Spring",
    "iap.gif": "IAP",
    "summer.gif": "Summer",
    "rest.gif": "REST",
    "hassA.gif": "HASS-A",
    "hassH.gif": "HASS-H",
    "hassS.gif": "HASS-S",
    "hassAH.gif": "HASS-A,H",
    "cih1.gif": "CI-H",
    "cihw.gif": "CI-HW",
    "Lab.gif": "Institute Lab",
    "phys1.gif": "Physics I (GIR)",
    "phys2.gif": "Physics II (GIR)",
    "chem.gif": "Chemistry (GIR)",
    "bio.gif": "Biology (GIR)",
    "calc1.gif": "Calculus I (GIR)",
    "calc2.gif": "Calculus II (GIR)",
    "nooffer.gif": "Not offered this year",
    "nonext.gif": "Not offered next year",
    "newmit.gif": "New subject",
    "repeat.gif": "Can be repeated for credit",
    "buttonx.gif": "Cancelled",
    # Navigation/decoration icons we can ignore
    "hr.gif": None,
    "purple1.gif": None,
    "purple2.gif": None,
    "RegLogo.gif": None,
    "RegGo.gif": None,
}

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

DEFAULT_HEADERS = {
    "User-Agent": (
        "MIT-Course-Scraper/1.0 "
        "(educational research project; polite scraping with delays)"
    ),
}

REQUEST_DELAY_SECONDS = 1.0  # polite delay between requests
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 3.0


def fetch_url(url, delay=True):
    """Fetch a URL with retries and polite delay. Returns response text or None."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=30)
            resp.raise_for_status()
            if delay:
                time.sleep(REQUEST_DELAY_SECONDS)
            return resp.text
        except requests.RequestException as e:
            print(f"  [attempt {attempt}/{MAX_RETRIES}] Error fetching {url}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
    print(f"  FAILED to fetch {url} after {MAX_RETRIES} attempts")
    return None


def ensure_dirs():
    """Create output directories if they don't exist."""
    for d in [RAW_CATALOG_DIR, RAW_SCHEDULE_DIR, PROCESSED_DIR]:
        os.makedirs(d, exist_ok=True)
