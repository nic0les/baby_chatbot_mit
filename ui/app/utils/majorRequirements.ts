import type { RequirementGroup } from "../types";

// ── Per-subcategory definition ─────────────────────────────────────────────────
interface SubcatTemplate {
  name: string;
  total: number;
  note?: string;
  /** Exact course codes that satisfy this requirement (any one counts) */
  courses?: string[];
  /** OR: count courses whose subject_code starts with these prefixes */
  electivePrefixes?: string[];
}

interface MajorTemplate {
  name: string;
  color: string;
  subcategories: SubcatTemplate[];
}

// ── Major templates ────────────────────────────────────────────────────────────
const TEMPLATES: Record<string, MajorTemplate> = {
  "6-14": {
    name: "6-14 — CS, Economics & Data Science",
    color: "#4A7FC1",
    subcategories: [
      {
        name: "Foundation",
        total: 3,
        note: "6.100A, 6.1200, 14.01",
        courses: ["6.100A", "6.100B", "6.1200", "14.01"],
      },
      {
        name: "Programming & Algorithms",
        total: 2,
        note: "6.1010, 6.1210",
        courses: ["6.1010", "6.1210"],
      },
      {
        name: "Math & Probability",
        total: 2,
        note: "18.06 or 18.03 + 18.600 or 6.3800",
        courses: ["18.06", "18.03", "18.600", "6.3800", "18.C06"],
      },
      {
        name: "Machine Learning / Data Science",
        total: 1,
        note: "6.3900 required",
        courses: ["6.3900", "6.036"],
      },
      {
        name: "Economics Core",
        total: 2,
        note: "14.30, 14.32",
        courses: ["14.30", "14.32"],
      },
      {
        name: "CI-M",
        total: 1,
        courses: ["15.279", "6.1810", "21W.732", "21W.735", "21W.742", "21W.762"],
      },
      {
        name: "Economics Electives",
        total: 3,
        note: "14.xxx advanced",
        electivePrefixes: ["14."],
        courses: [
          "14.02","14.03","14.04","14.05","14.06","14.08","14.09","14.10","14.11","14.12","14.13",
          "14.15","14.18","14.19","14.21","14.22","14.23","14.24","14.25","14.26","14.27","14.28",
          "14.31","14.33","14.41","14.42","14.44","14.45","14.46","14.64","14.73","14.74","14.75",
          "14.C395","14.750","14.27",
        ],
      },
      {
        name: "EECS Electives",
        total: 2,
        electivePrefixes: ["6."],
        courses: [
          "6.1220","6.1400","6.1420","6.1800","6.1810","6.3810","6.3900","6.4110","6.4200",
          "6.4210","6.4310","6.5080","6.5110","6.5120","6.5130","6.5210","6.5220","6.5230",
          "6.5240","6.5310","6.5320","6.5340","6.5930","6.7900","6.7960","6.8300","6.C51",
          "6.C52","9.660","6.S977",
        ],
      },
    ],
  },

  "6-3": {
    name: "6-3 — Computer Science",
    color: "#4A7FC1",
    subcategories: [
      {
        name: "Foundation",
        total: 2,
        note: "6.100A + 6.1200",
        courses: ["6.100A", "6.100B", "6.1200"],
      },
      {
        name: "Fundamentals",
        total: 3,
        note: "6.1010, 6.1210, 6.1910",
        courses: ["6.1010", "6.1210", "6.1910"],
      },
      {
        name: "Header Courses",
        total: 6,
        note: "6 from 6 categories",
        courses: [
          "6.1220","6.1400","6.1800","6.1810","6.3800","6.3900","6.4110","6.5060",
          "6.5080","6.5110","6.5120","6.5130","6.5160","6.5210","6.5220","6.5230",
          "6.5250","6.5320","6.5840","6.7900","6.7960","6.8300","6.C51",
        ],
      },
      {
        name: "CI-M",
        total: 1,
        courses: ["6.1810", "6.UAT", "21W.732", "21W.742", "21W.762"],
      },
      {
        name: "Electives",
        total: 3,
        electivePrefixes: ["6."],
        courses: [],
      },
    ],
  },

  "6-4": {
    name: "6-4 — AI & Decision Making",
    color: "#4A7FC1",
    subcategories: [
      {
        name: "Fundamentals",
        total: 4,
        note: "6.1200, 6.1210, 18.06, 6.3900",
        courses: ["6.1200", "6.1210", "18.06", "18.C06", "6.3900", "6.036"],
      },
      {
        name: "Header Courses",
        total: 5,
        note: "5 from 5+ categories",
        courses: [
          "6.3800","6.3810","6.4110","6.4200","6.4210","6.4310",
          "6.7900","6.7960","6.8301","6.8300","6.C51","6.C52",
          "14.C395","9.660","14.13","15.S50",
        ],
      },
      {
        name: "CI-M",
        total: 2,
        courses: ["6.1810", "6.UAT", "21W.732", "21W.742", "21W.762", "15.279"],
      },
      {
        name: "Ethics / SERC",
        total: 1,
        courses: ["6.C51", "6.C52", "24.131", "STS.047", "6.S976", "6.S977"],
      },
      {
        name: "Electives",
        total: 3,
        electivePrefixes: ["6.", "14.", "15."],
        courses: [],
      },
    ],
  },

  "6-7": {
    name: "6-7 — CS & Molecular Biology",
    color: "#4E9E6E",
    subcategories: [
      {
        name: "CS Core",
        total: 4,
        courses: ["6.100A", "6.100B", "6.1010", "6.1210", "6.1200"],
      },
      {
        name: "Biology Core",
        total: 3,
        courses: ["7.01", "7.012", "7.013", "7.014", "7.015", "7.016", "5.07", "5.111", "5.112"],
      },
      {
        name: "Computational Biology",
        total: 3,
        courses: ["6.047", "6.8701", "6.874", "6.7920", "7.91", "7.910"],
      },
      { name: "CI-M", total: 1, courses: [] },
      { name: "Electives", total: 3, electivePrefixes: ["6.", "7."], courses: [] },
    ],
  },

  "18-C": {
    name: "18-C — Mathematics with Computer Science",
    color: "#9171C7",
    subcategories: [
      {
        name: "Math Core",
        total: 5,
        note: "18.01–18.06, 18.100",
        courses: ["18.01", "18.02", "18.03", "18.06", "18.100A", "18.100B", "18.100C", "18.100P", "18.C06"],
      },
      {
        name: "CS Core",
        total: 3,
        courses: ["6.1010", "6.1210", "6.1200", "6.100A", "6.100B"],
      },
      {
        name: "Advanced Mathematics",
        total: 4,
        electivePrefixes: ["18."],
        courses: [],
      },
      {
        name: "CS Electives",
        total: 2,
        electivePrefixes: ["6."],
        courses: [],
      },
      { name: "CI-M", total: 1, courses: [] },
    ],
  },
};

const GIR_SCIENCE_CODES = new Set(["PHY1", "PHY2", "CAL1", "CAL2", "CHEM", "BIOL"]);

const HASS_PREFIXES = ["21", "CMS", "STS", "11.", "17.", "24.", "WGS", "21W", "21L", "21M", "21G"];

// ── Build RequirementGroups from an uploaded CourseRoad ────────────────────────
export function buildRoadRequirements(
  subjects: Array<{ subject_id: string; units: number }>,
  majorCode: string,
  progressAssertions: Record<string, { substitutions?: string[] }> = {}
): RequirementGroup[] {
  const completedSet = new Set(subjects.map((s) => s.subject_id.toUpperCase()));

  // ── GIR section ─────────────────────────────────────────────────────────────
  const scienceDone = [...GIR_SCIENCE_CODES].filter((g) => completedSet.has(g)).length;

  // Collect all courses explicitly assigned to GIR slots via progressAssertions
  // Key format: "girs.<category>.<slot...>" — category 1=HASS, 2=REST, 3=Lab
  const girSlotCourses: { hass: Set<string>; rest: Set<string>; lab: Set<string> } = {
    hass: new Set(),
    rest: new Set(),
    lab: new Set(),
  };
  for (const [key, val] of Object.entries(progressAssertions)) {
    const subs = val.substitutions ?? [];
    if (/^girs\.1\./.test(key)) subs.forEach((s) => girSlotCourses.hass.add(s.toUpperCase()));
    else if (/^girs\.2\./.test(key)) subs.forEach((s) => girSlotCourses.rest.add(s.toUpperCase()));
    else if (/^girs\.3\./.test(key)) subs.forEach((s) => girSlotCourses.lab.add(s.toUpperCase()));
  }

  // HASS: prefix-based heuristic UNION assertion-assigned courses (deduplicated)
  // MIT allows double-counting: a CI-H course IS one of your 8 HASS courses;
  // a REST course with a HASS tag can count for both.
  const hassIds = new Set<string>([
    ...subjects
      .filter((s) => HASS_PREFIXES.some((p) => s.subject_id.toUpperCase().startsWith(p)))
      .map((s) => s.subject_id.toUpperCase()),
    ...girSlotCourses.hass,
  ]);
  const hassCount = Math.min(hassIds.size, 8);

  // REST and Lab: use slot assertions from progressAssertions (most reliable source)
  const restCount = Math.min(girSlotCourses.rest.size, 2);
  const labCount = Math.min(girSlotCourses.lab.size, 1);

  const girGroup: RequirementGroup = {
    id: "girs",
    name: "General Institute Requirements",
    color: "#E8A838",
    subcategories: [
      { name: "Science Core", completed: scienceDone, total: 6 },
      { name: "HASS (incl. 1 CI-H)", completed: hassCount, total: 8 },
      { name: "REST", completed: restCount, total: 2 },
      { name: "Lab", completed: labCount, total: 1 },
    ],
  };

  // ── Major section ────────────────────────────────────────────────────────────
  const template = TEMPLATES[majorCode.toUpperCase()] ?? TEMPLATES[majorCode] ?? null;

  if (!template) {
    // Unknown major — flat course list grouped by prefix
    return [girGroup];
  }

  // Track which courses have been "used" to satisfy a requirement (no double-counting)
  const usedCodes = new Set<string>();

  const subcategories = template.subcategories.map((subcat) => {
    // Count exact-match courses
    const exactMatches = (subcat.courses ?? []).filter((c) => {
      const norm = c.toUpperCase();
      return completedSet.has(norm) && !usedCodes.has(norm);
    });
    exactMatches.forEach((c) => usedCodes.add(c.toUpperCase()));

    // Count electives by prefix (for leftover slots)
    let electiveCount = 0;
    if (subcat.electivePrefixes && exactMatches.length < subcat.total) {
      const remaining = subcat.total - exactMatches.length;
      const electives = subjects.filter(
        (s) =>
          !usedCodes.has(s.subject_id.toUpperCase()) &&
          subcat.electivePrefixes!.some((p) => s.subject_id.toUpperCase().startsWith(p.toUpperCase())) &&
          // Don't count GIR generic codes as electives
          !GIR_SCIENCE_CODES.has(s.subject_id.toUpperCase())
      );
      electiveCount = Math.min(electives.length, remaining);
      electives.slice(0, electiveCount).forEach((s) => usedCodes.add(s.subject_id.toUpperCase()));
    }

    const completed = Math.min(exactMatches.length + electiveCount, subcat.total);
    return { name: subcat.name, completed, total: subcat.total, note: subcat.note };
  });

  const majorGroup: RequirementGroup = {
    id: "major",
    name: template.name,
    color: template.color,
    subcategories,
  };

  return [girGroup, majorGroup];
}

export function parseMajorCode(coursesOfStudy: string[]): string {
  // Look for "major6-14", "major6-3", etc. — strip "major" prefix
  const entry = coursesOfStudy.find((c) => /^major\d/i.test(c));
  if (entry) return entry.replace(/^major/i, "").toUpperCase();
  // Fall back to first entry that looks like a major code
  const fallback = coursesOfStudy.find((c) => /^\d+-[A-Z0-9]+$/i.test(c));
  return fallback?.toUpperCase() ?? "";
}
