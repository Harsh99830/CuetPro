"""
CUET Score Engine - Dynamic PDF-Driven Scoring System
======================================================
- Parses DU admission rules live from Data3.pdf (no hardcoding).
- Falls back to course_requirements.json if PDF parse fails.
- Locks compulsory subjects per course rules.
- Auto-selects best optional subjects to maximise the consolidated score.
- Normalises final merit score to /1000.
"""

import json
import re
import sys
from itertools import combinations
from pathlib import Path

# ── Optional import: pdfplumber (pip install pdfplumber) ─────────────────────
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent          # …/frontend/Data/
PDF_PATH  = BASE_DIR / "Data3.pdf"
JSON_PATH = BASE_DIR / "course_requirements.json"

# ── CUET subject universe ────────────────────────────────────────────────────
# List A  – Languages (one compulsory in most courses)
LIST_A_SUBJECTS = {
    "english", "hindi", "sanskrit", "urdu", "bengali", "punjabi",
    "odia", "telugu", "tamil", "kannada", "malayalam", "marathi",
    "gujarati", "assamese", "nepali", "arabic", "french", "german",
    "spanish", "russian", "persian", "italian", "sindhi", "kashmiri",
    "bodo", "dogri", "manipuri", "maithili", "santhali",
}

# List B  – Domain subjects
LIST_B_SUBJECTS = {
    "mathematics", "applied mathematics", "physics", "chemistry",
    "biology", "biological studies", "biotechnology", "biochemistry",
    "accountancy", "book keeping", "business studies", "economics",
    "history", "political science", "geography", "sociology",
    "psychology", "philosophy", "computer science", "informatics practices",
    "physical education", "home science", "legal studies", "fine arts",
    "performing arts", "mass media", "mass communication",
    "agriculture", "geology", "statistics", "environmental studies",
    "entrepreneurship",
}

# GAT (General Aptitude Test)
GAT_LABEL = "general aptitude test"

# Max marks per CUET subject slot
MARKS_PER_SUBJECT = 200      # Each domain/language paper = 200 marks
MAX_CONSOLIDATED  = 1000     # Final merit out of 1000


# ════════════════════════════════════════════════════════════════════════════
# 1.  PDF PARSER  →  returns COURSE_RULES dict directly
# ════════════════════════════════════════════════════════════════════════════

def _normalise(text: str) -> str:
    """Collapse whitespace and lowercase — shared by parser and engine."""
    return re.sub(r"\s+", " ", text.lower().strip())


# ── Subject tokens used during eligibility parsing ───────────────────────────
# Listed longest-first so alternation matches "applied mathematics"
# before "mathematics", "biological studies" before "biology", etc.
_SUBJECT_TOKENS = (
    "applied mathematics", "mathematics",
    "physics", "chemistry",
    "biological studies", "biotechnology", "biochemistry", "biology",
    "accountancy", "book keeping",
    "computer science", "informatics practices",
    "physical education", "performing arts",
    "mass media", "mass communication",
    "geography", "geology",
    "english", "hindi",
)

# Pre-built alternation string (reused in both regexes below)
_TOK_ALT = "|".join(re.escape(s) for s in _SUBJECT_TOKENS)

# Matches a single "slot" which is either:
#   • a bare subject             → e.g.  "physics"
#   • an OR-pair joined by "/"   → e.g.  "mathematics/applied mathematics"
# Used to walk the plus-chain one slot at a time.
_SLOT_RE = re.compile(
    rf"(?:{_TOK_ALT})(?:\s*/\s*(?:{_TOK_ALT}))*",
    re.IGNORECASE,
)

# Matches a full plus-chain of two or more slots:
#   "SlotA + SlotB"  or  "SlotA + SlotB + SlotC"
_PLUS_CHAIN_RE = re.compile(
    rf"(?:{_TOK_ALT})(?:\s*/\s*(?:{_TOK_ALT}))*"      # first slot
    rf"(?:\s*\+\s*"                                     # " + "
    rf"(?:{_TOK_ALT})(?:\s*/\s*(?:{_TOK_ALT}))*)+",    # one-or-more further slots
    re.IGNORECASE,
)


def _extract_compulsory(norm_elig: str) -> tuple[list[str], bool]:
    """
    Read ONLY the eligibility text (norm_elig) — zero knowledge of the
    course name — and return:

        compulsory     list[str]   subjects that must be locked in
        compulsory_any bool        True  → engine picks the BEST one (OR rule)
                                   False → engine locks ALL of them (AND rule)

    Algorithm (pure text-pattern, no course-name checks)
    ─────────────────────────────────────────────────────
    Step 1 – Find every plus-chain in the eligibility text.
             Each combination clause looks like:
               "Physics + Chemistry + Mathematics/Applied Mathematics"
             Split every chain into its individual slots at "+".
             A slot may be an OR-pair ("Mathematics/Applied Mathematics")
             or a single subject ("Physics").

    Step 2 – A subject (or OR-pair) that appears in EVERY combination
             clause is by definition compulsory for that course — the
             student has no way to avoid it.
             • If the common slot is a single subject  → lock it (AND, False).
             • If the common slot is an OR-pair        → lock best one (OR, True).

    Step 3 – If no plus-chains exist (free-choice arts/commerce courses
             that use "Any three subjects from List B"), scan for a bare
             OR-pair slot written as a required fixed position:
               "Mathematics/Applied Mathematics + Any other two subjects"
               "Accountancy/Book Keeping + Any other two subjects"
             These bare OR-pairs at the start of a combination are
             compulsory even though there is no full chain.

    Step 4 – Detect a language mandated by name:
               "Hindi from List A"  →  Hindi compulsory (AND, False)

    Step 5 – Nothing matched → no compulsory subjects.
    """

    # ── Step 1 & 2: parse plus-chains and find common slots ──────────────────
    chains = _PLUS_CHAIN_RE.findall(norm_elig)

    if chains:
        # Parse each chain into a frozenset of normalised slot-strings.
        # A slot string preserves the "/" so we can tell OR-pairs from singles.
        def chain_to_slots(chain: str) -> list[str]:
            """Split a plus-chain into its individual slots (lowercase, stripped)."""
            slots = []
            for raw_slot in re.split(r"\s*\+\s*", chain.lower()):
                # Normalise each part of an OR-pair and rejoin with "/"
                parts = [p.strip() for p in raw_slot.split("/")]
                slots.append("/".join(parts))
            return slots

        parsed = [chain_to_slots(c) for c in chains]

        # Subjects/OR-pairs present in ALL chains are truly compulsory.
        common = set(parsed[0])
        for slots in parsed[1:]:
            common &= set(slots)

        if common:
            compulsory = []
            compulsory_any = False   # default: AND (all must be present)

            for slot in common:
                parts = [p.strip() for p in slot.split("/")]
                if len(parts) == 1:
                    # Single subject — must be present (AND rule)
                    if parts[0] not in compulsory:
                        compulsory.append(parts[0])
                else:
                    # OR-pair — student picks the best-scoring one
                    compulsory_any = True
                    for p in parts:
                        if p not in compulsory:
                            compulsory.append(p)

            if compulsory:
                return compulsory, compulsory_any

    # ── Step 3: bare OR-pair as a required fixed slot (no full plus-chain) ────
    # Pattern: "SubjA/SubjB" appears as a named required subject slot,
    # followed by "+ Any other …" or similar free-choice language.
    # We scan for every OR-pair in the text; if any appears in ALL
    # combination clauses (identified by "Combination I/II/III…" markers),
    # it is compulsory.
    #
    # Simpler heuristic that covers all real DU cases without false positives:
    # if a specific OR-pair written in the eligibility text matches one of
    # the known OR-pair patterns AND the text also contains "any other"
    # (meaning the other slots are free), that pair is the compulsory slot.

    or_compulsory: list[str] = []

    if re.search(
        r"(?:applied mathematics|mathematics)\s*/\s*(?:applied mathematics|mathematics)",
        norm_elig,
    ) and "any other" in norm_elig:
        or_compulsory += ["mathematics", "applied mathematics"]

    if re.search(
        r"(?:accountancy|book keeping)\s*/\s*(?:accountancy|book keeping)",
        norm_elig,
    ) and "any other" in norm_elig:
        or_compulsory += ["accountancy", "book keeping"]

    if or_compulsory:
        return list(dict.fromkeys(or_compulsory)), True   # pick BEST one

    # ── Step 4: named language explicitly required ("Hindi from List A") ──────
    # Walk every language token — no hardcoded course names, just text pattern.
    for lang in LIST_A_SUBJECTS:
        if re.search(rf"\b{re.escape(lang)}\b from list a", norm_elig):
            return [lang], False

    # ── Step 5: no compulsory subjects detected ───────────────────────────────
    return [], False


def _build_rules_dict(raw_rows: list[dict]) -> dict:
    """
    Convert a list of {"course": ..., "eligibility": ...} records into the
    COURSE_RULES dict that calculate_cuet_score() consumes.

    Every decision here is derived purely from the eligibility text of that
    row — no course-name string checks anywhere.

        {
          "b.com. (hons.)": {
              "display_name":   "B.Com. (Hons.)",
              "compulsory":     ["mathematics", "applied mathematics",
                                 "accountancy", "book keeping"],
              "compulsory_any": True,
              "language_req":   True,
              "total_subjects": 4,
              "uses_gat":       False,
              "eligibility_raw": "...",
          },
          ...
        }
    """
    rules = {}

    for entry in raw_rows:
        raw_name    = entry.get("course", "").strip()
        eligibility = entry.get("eligibility", "")
        if not raw_name:
            continue

        key       = _normalise(raw_name)
        norm_elig = _normalise(eligibility)

        # ── Language requirement ──────────────────────────────────────────────
        # True whenever the eligibility text references List A at all.
        language_req = "from list a" in norm_elig

        # ── GAT ──────────────────────────────────────────────────────────────
        uses_gat = GAT_LABEL in norm_elig

        # ── Total subject slots (domain papers, language excluded) ────────────
        # Read the free-choice count directly from the eligibility sentence.
        # "any three subjects from List B" → student picks 3 free domain papers.
        # Add 1 for the language slot → total_subjects used by the engine.
        if "any three subjects from list b" in norm_elig:
            total_subjects = 4      # 1 lang + 3 free domain
        elif "any two subjects from list b" in norm_elig:
            total_subjects = 3      # 1 lang + 2 free domain
        elif "any one subject from list b" in norm_elig:
            total_subjects = 2      # 1 lang + 1 free domain (e.g. MMMC)
        else:
            # Science / specialist courses: no "any N subjects" clause.
            # total_subjects is implicitly the number of compulsory subjects
            # (handled after _extract_compulsory runs), so set a safe ceiling.
            total_subjects = 4

        # ── Compulsory subjects ───────────────────────────────────────────────
        # Derived entirely from the eligibility text by _extract_compulsory.
        # No course-name string checks.
        compulsory, compulsory_any = _extract_compulsory(norm_elig)

        # ── Adjust total_subjects for science courses ─────────────────────────
        # Science courses have no "any N subjects from List B" clause, so the
        # ceiling was set to 4 above.  If _extract_compulsory found a fixed
        # set of compulsory subjects (AND rule), those subjects ARE the full
        # combination — reset total_subjects to match exactly.
        if compulsory and not compulsory_any and total_subjects == 4:
            total_subjects = len(compulsory)

        rules[key] = {
            "display_name":    raw_name,
            "compulsory":      compulsory,
            "compulsory_any":  compulsory_any,
            "language_req":    language_req,
            "total_subjects":  total_subjects,
            "uses_gat":        uses_gat,
            "eligibility_raw": eligibility,
        }

    return rules


def _load_rules_from_json(json_path: Path) -> dict:
    """JSON fallback — load course_requirements.json and convert to rules dict."""
    if not json_path.exists():
        raise FileNotFoundError(
            f"Neither Data3.pdf nor {json_path.name} found in the Data/ folder."
        )
    with open(json_path, "r", encoding="utf-8") as f:
        raw_rows = json.load(f)
    print(f"[JSON] Loaded {len(raw_rows)} courses from {json_path.name}")
    return _build_rules_dict(raw_rows)


def load_course_rules_from_pdf(pdf_path: str | Path) -> dict:
    """
    PRIMARY entry point.  Open Data3.pdf with pdfplumber, walk every page,
    extract course-name + eligibility pairs from tables (or plain text as
    fallback), then pass them through _build_rules_dict() to produce the
    COURSE_RULES dict that the scoring engine needs.

    Automatically falls back to course_requirements.json when:
      • pdfplumber is not installed, OR
      • the PDF cannot be opened / yields zero rows.

    How to plug this into the engine
    ---------------------------------
        COURSE_RULES = load_course_rules_from_pdf(PDF_PATH)
        result       = calculate_cuet_score(course, marks, COURSE_RULES)
    """
    if not PDFPLUMBER_AVAILABLE:
        print("[PDF] pdfplumber not installed → falling back to JSON. "
              "Fix with:  pip install pdfplumber")
        return _load_rules_from_json(JSON_PATH)

    raw_rows: list[dict] = []

    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            current_course:      str | None = None
            current_eligibility: list[str]  = []

            for page in pdf.pages:
                tables = page.extract_tables()

                if tables:
                    # ── Table mode (most DU PDF pages) ──────────────────────
                    for table in tables:
                        for row in table:
                            if not row:
                                continue
                            cells = [c.strip() if c else "" for c in row]

                            if len(cells) >= 2 and cells[0] and cells[1]:
                                # New course row: flush previous entry first
                                if current_course:
                                    raw_rows.append({
                                        "course":
                                            current_course,
                                        "eligibility":
                                            " ".join(current_eligibility).strip(),
                                    })
                                current_course      = cells[0]
                                current_eligibility = [cells[1]]

                            elif len(cells) >= 2 and not cells[0] and cells[1]:
                                # Continuation row — eligibility wraps to next cell
                                current_eligibility.append(cells[1])

                else:
                    # ── Plain-text fallback (scanned / image-only pages) ─────
                    text = page.extract_text() or ""
                    for line in text.splitlines():
                        line = line.strip()
                        if not line:
                            continue
                        if re.match(r"^(B\.|Bachelor|Five Year)", line, re.IGNORECASE):
                            if current_course:
                                raw_rows.append({
                                    "course":
                                        current_course,
                                    "eligibility":
                                        " ".join(current_eligibility).strip(),
                                })
                            current_course      = line
                            current_eligibility = []
                        elif current_course:
                            current_eligibility.append(line)

            # Flush the final pending course
            if current_course:
                raw_rows.append({
                    "course":      current_course,
                    "eligibility": " ".join(current_eligibility).strip(),
                })

    except Exception as exc:
        print(f"[PDF] Could not parse '{pdf_path}': {exc}  → falling back to JSON.")
        return _load_rules_from_json(JSON_PATH)

    if not raw_rows:
        print("[PDF] No rows extracted → falling back to JSON.")
        return _load_rules_from_json(JSON_PATH)

    print(f"[PDF] Extracted {len(raw_rows)} course rows from {Path(pdf_path).name}")
    return _build_rules_dict(raw_rows)


# ════════════════════════════════════════════════════════════════════════════
# 2.  SCORE ENGINE  (mathematical core — untouched)
# ════════════════════════════════════════════════════════════════════════════

def _find_course_rule(course_name: str, rules: dict) -> tuple[str, dict]:
    """
    Fuzzy-match the requested course to a rule key.
    Returns (matched_key, rule_dict).
    Raises ValueError with a friendly message if not found.
    """
    query = _normalise(course_name)

    # Exact match
    if query in rules:
        return query, rules[query]

    # Partial match (longest overlapping key wins)
    candidates = [
        (key, len(set(query.split()) & set(key.split())))
        for key in rules
        if set(query.split()) & set(key.split())
    ]
    if candidates:
        best_key = max(candidates, key=lambda x: x[1])[0]
        return best_key, rules[best_key]

    # Not found – give user-friendly list of similar courses
    close = [r["display_name"] for k, r in rules.items()
             if any(w in k for w in query.split() if len(w) > 3)]
    hint = ("\n  Did you mean one of:\n    " + "\n    ".join(close[:5])) if close else ""
    raise ValueError(
        f"❌  Course '{course_name}' was not found in the DU admission data.\n"
        f"    Please check the course name and try again.{hint}"
    )


def calculate_cuet_score(
    course_name:   str,
    student_marks: dict,          # {"Subject Name": score, ...}
    rules:         dict,
) -> dict:
    """
    Core scoring engine.

    Parameters
    ----------
    course_name   : User-supplied course string (fuzzy-matched).
    student_marks : Dict of subject → raw score (0–200 each).
    rules         : COURSE_RULES from load_course_rules_from_pdf().

    Returns
    -------
    dict with keys:
      matched_course, locked_subjects, chosen_subjects,
      subject_scores, raw_total, consolidated_score (out of 1000),
      max_possible
    """

    # ── 1. Resolve course rule ───────────────────────────────────────────────
    matched_key, rule = _find_course_rule(course_name, rules)

    # ── 2. Normalise student marks keys ─────────────────────────────────────
    norm_marks = {_normalise(k): v for k, v in student_marks.items()}

    # ── 3. Identify which student subjects are languages vs domain ───────────
    student_langs  = {s: v for s, v in norm_marks.items() if s in LIST_A_SUBJECTS}
    student_domain = {s: v for s, v in norm_marks.items()
                      if s not in LIST_A_SUBJECTS and s != GAT_LABEL}
    student_gat    = norm_marks.get(GAT_LABEL, 0)

    # ── 4. Lock compulsory subjects ──────────────────────────────────────────
    locked          = []
    compulsory_pool = [_normalise(s) for s in rule["compulsory"]]

    if compulsory_pool:
        if rule["compulsory_any"]:
            # Lock the highest-scoring one from the pool (e.g. Maths OR Accountancy)
            available = {s: norm_marks.get(s, 0)
                         for s in compulsory_pool if s in norm_marks}
            if available:
                best_comp = max(available, key=available.get)
                locked    = [best_comp]
            else:
                raise ValueError(
                    f"❌  Course '{rule['display_name']}' requires at least one of: "
                    f"{rule['compulsory']}.\n"
                    f"    None of these subjects found in your marksheet."
                )
        else:
            # All compulsory subjects must be present (e.g. PCM for B.Sc. Physics)
            for s in compulsory_pool:
                if s not in norm_marks:
                    raise ValueError(
                        f"❌  Course '{rule['display_name']}' requires '{s}' "
                        f"but it was not found in your marksheet."
                    )
            locked = compulsory_pool

    # ── 5. Language slot ─────────────────────────────────────────────────────
    chosen_lang = None
    if rule["language_req"] and student_langs:
        chosen_lang = max(student_langs, key=student_langs.get)

    # ── 6. Calculate remaining optional slots ────────────────────────────────
    used_slots             = len(locked)
    domain_slots_available = rule["total_subjects"] - (1 if chosen_lang else 0) - used_slots

    # Candidate optional domain subjects (exclude locked, exclude language)
    optional_candidates = {
        s: v for s, v in student_domain.items()
        if s not in locked
    }

    # ── 7. Best-subject auto-selection ───────────────────────────────────────
    chosen_optionals = []
    if domain_slots_available > 0 and optional_candidates:
        sorted_opts      = sorted(optional_candidates.items(), key=lambda x: -x[1])
        chosen_optionals = [s for s, _ in sorted_opts[:domain_slots_available]]

    # ── 8. Assemble final subject list ───────────────────────────────────────
    chosen_subjects = []
    if chosen_lang:
        chosen_subjects.append(chosen_lang)
    chosen_subjects.extend(locked)
    chosen_subjects.extend(chosen_optionals)
    if rule["uses_gat"] and student_gat:
        chosen_subjects.append(GAT_LABEL)

    # ── 9. Compute scores ────────────────────────────────────────────────────
    subject_scores = {}
    for subj in chosen_subjects:
        subject_scores[subj] = norm_marks.get(subj, student_gat if subj == GAT_LABEL else 0)

    raw_total = sum(subject_scores.values())

    # ── 10. Normalise to /1000 ───────────────────────────────────────────────
    slot_count        = len(chosen_subjects) or 1
    max_possible      = slot_count * MARKS_PER_SUBJECT
    normalised_score  = round((raw_total / max_possible) * MAX_CONSOLIDATED, 2) if max_possible else 0

    return {
        "matched_course":     rule["display_name"],
        "locked_subjects":    locked,
        "chosen_subjects":    chosen_subjects,
        "subject_scores":     subject_scores,
        "raw_total":          raw_total,
        "max_possible":       max_possible,
        "consolidated_score": normalised_score,    # OUT OF 1000
    }


# ════════════════════════════════════════════════════════════════════════════
# 3.  PRETTY RESULT FORMATTER
# ════════════════════════════════════════════════════════════════════════════

def format_result(result: dict) -> str:
    lines = [
        "=" * 60,
        f"  Course    : {result['matched_course']}",
        "=" * 60,
    ]
    if result["locked_subjects"]:
        lines.append(f"  Locked    : {', '.join(result['locked_subjects'])}")

    lines.append("  Subject Breakdown:")
    for subj, score in result["subject_scores"].items():
        tag = " ★" if subj in result["locked_subjects"] else ""
        lines.append(f"    {subj.title():<40}  {score:>6} / {MARKS_PER_SUBJECT}{tag}")

    lines += [
        "-" * 60,
        f"  Raw Total : {result['raw_total']} / {result['max_possible']}",
        f"  ✅ CUET Consolidated Score : {result['consolidated_score']} / 1000",
        "=" * 60,
    ]
    return "\n".join(lines)


# ════════════════════════════════════════════════════════════════════════════
# 4.  MULTI-COURSE OPTIMIZER
# ════════════════════════════════════════════════════════════════════════════

def rank_all_courses(student_marks: dict, rules: dict) -> list[dict]:
    """Run every course through the engine; return a sorted leaderboard."""
    results = []
    for key, rule in rules.items():
        try:
            res = calculate_cuet_score(rule["display_name"], student_marks, rules)
            results.append({"course": rule["display_name"], "score": res["consolidated_score"]})
        except ValueError:
            pass    # student not eligible — skip silently
    results.sort(key=lambda x: -x["score"])
    return results


# ════════════════════════════════════════════════════════════════════════════
# 5.  CLI DEMO
# ════════════════════════════════════════════════════════════════════════════

def main():
    # ── Load COURSE_RULES dynamically from PDF (JSON fallback automatic) ─────
    COURSE_RULES = load_course_rules_from_pdf(PDF_PATH)
    print(f"[Engine] {len(COURSE_RULES)} course rules ready.\n")

    # ── Sample student marksheet ─────────────────────────────────────────────
    student_marks = {
        "English":               185,
        "Mathematics":           178,
        "Accountancy":           190,
        "Business Studies":      172,
        "Economics":             168,
        "General Aptitude Test": 155,
    }

    # ── Test specific courses ────────────────────────────────────────────────
    test_courses = [
        "B.Com. (Hons.)",
        "B.A. (Hons.) Economics",
        "Bachelor of Management Studies (BMS)",
        "B.A. (Hons.) Business Economics (BBE)",
    ]

    for course in test_courses:
        try:
            result = calculate_cuet_score(course, student_marks, COURSE_RULES)
            print(format_result(result))
        except ValueError as err:
            print(err)
        print()

    # ── Rank all eligible courses ─────────────────────────────────────────────
    print("\n📊  Top 10 Courses by Consolidated CUET Score:\n")
    ranking = rank_all_courses(student_marks, COURSE_RULES)
    for i, item in enumerate(ranking[:10], 1):
        print(f"  {i:>2}. {item['course']:<55}  {item['score']:>7} / 1000")


if __name__ == "__main__":
    main()
