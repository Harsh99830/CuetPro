/**
 * scoreEngine.js
 * ==============
 * JavaScript port of cuet_score_engine.py
 *
 * Exports one function used by App.jsx:
 *   computeSmartScore(subjectEntries, courseName, courseRequirements) → number (0–1000)
 *
 * And one helper used to show per-course breakdown in ResultsSection:
 *   getScoreBreakdown(subjectEntries, courseName, courseRequirements) → breakdown object
 *
 * The rest of helpers.js is completely untouched.
 * App.jsx only needs to swap one call:
 *   OLD: computeStudentScore(subjectEntries)
 *   NEW: computeSmartScore(subjectEntries, course, courseRequirements)
 */

import { languages } from './constants'

// ─── Constants (mirror Python engine) ────────────────────────────────────────
const MARKS_PER_SUBJECT = 200   // CUET max per paper
const MAX_SCORE        = 1000   // Merit list ceiling

// ─── Subject token list ───────────────────────────────────────────────────────
// Longest-first so "applied mathematics" matches before "mathematics",
// "biological studies" before "biology", etc.
const SUBJECT_TOKENS = [
  'applied mathematics', 'mathematics',
  'physics', 'chemistry',
  'biological studies', 'biotechnology', 'biochemistry', 'biology',
  'accountancy', 'book keeping',
  'computer science', 'informatics practices',
  'physical education', 'performing arts',
  'mass media', 'mass communication',
  'geography', 'geology',
  'english', 'hindi',
]

// Frontend subject labels → normalised token(s) they map to.
// Needed because the frontend uses grouped labels like
// "Mathematics / Applied Mathematics" but the eligibility text says
// "mathematics/applied mathematics".
const FRONTEND_TO_TOKENS = {
  'mathematics / applied mathematics':      ['mathematics', 'applied mathematics'],
  'accountancy / book keeping':             ['accountancy', 'book keeping'],
  'biology / biological studies / biotechnology / biochemistry':
                                            ['biology', 'biological studies', 'biotechnology', 'biochemistry'],
  'computer science / information practices': ['computer science', 'informatics practices'],
  'economics / business economics':         ['economics'],
  'geography / geology':                    ['geography', 'geology'],
  'environmental studies / environmental science': ['environmental studies'],
  'fine arts / visual arts / commercial arts':     ['fine arts'],
  'performing arts (dance, drama, music)':  ['performing arts'],
  'physical education (yoga, sports)':      ['physical education'],
  'mass media / mass communication':        ['mass media', 'mass communication'],
}

// Set of normalised language names (mirrors Python LIST_A_SUBJECTS)
const LANGUAGE_SET = new Set(languages.map((l) => l.toLowerCase().trim()))

const GAT_LABEL = 'general aptitude test'


// ─── Normalise helpers ────────────────────────────────────────────────────────

/** Collapse whitespace, lowercase. Keep slashes & plus signs for parsing. */
function norm(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Map a frontend subject label to its canonical token(s).
 * e.g. "Mathematics / Applied Mathematics" → ["mathematics", "applied mathematics"]
 * e.g. "Physics" → ["physics"]
 */
function subjectToTokens(label) {
  const n = norm(label)
  if (FRONTEND_TO_TOKENS[n]) return FRONTEND_TO_TOKENS[n]
  // Single-word subjects: physics, chemistry, history, etc.
  return [n]
}

/** True if the student has a subject whose tokens include `token`. */
function studentHasToken(studentTokenMap, token) {
  return Boolean(studentTokenMap[token])
}


// ─── PDF eligibility text parser (mirrors Python _extract_compulsory) ─────────

/**
 * Given normalised eligibility text, return:
 *   { compulsory: string[], compulsoryAny: boolean }
 *
 * compulsory    – token list that must be locked
 * compulsoryAny – true  → engine picks the BEST-scoring one (OR rule)
 *                 false → engine locks ALL of them (AND rule)
 *
 * Algorithm (pure text pattern, zero course-name checks):
 *  Step 1 – Find "SubjA + SubjB + SubjC" chains. Subjects common to ALL
 *            chains are compulsory. OR-pairs inside a chain stay as OR-groups.
 *  Step 2 – Bare OR-pair slot ("mathematics/applied mathematics") followed
 *            by "any other" → OR-compulsory.
 *  Step 3 – Named language "hindi from list a" → that language is compulsory.
 *  Step 4 – Nothing → no compulsory.
 */
function extractCompulsory(normElig) {
  // Build a regex that matches one "slot":
  //   a subject token, optionally followed by "/alternateToken"
  const tokAlt = SUBJECT_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const slotPat = `(?:${tokAlt})(?:\\s*/\\s*(?:${tokAlt}))*`
  const chainRe = new RegExp(`${slotPat}(?:\\s*\\+\\s*${slotPat})+`, 'gi')

  // ── Step 1: plus-chains ────────────────────────────────────────────────────
  const chains = []
  let m
  const chainReCopy = new RegExp(chainRe.source, 'gi')
  while ((m = chainReCopy.exec(normElig)) !== null) chains.push(m[0])

  if (chains.length) {
    // Parse each chain into its slots (split at "+")
    const parseChain = (chain) =>
      chain.split(/\s*\+\s*/).map((slot) =>
        slot.trim().split(/\s*\/\s*/).map((p) => p.trim())
      )

    const parsed = chains.map(parseChain)

    // Find slots common to ALL chains (intersection by canonical slot key)
    const slotKey = (parts) => [...parts].sort().join('/')
    const firstKeys = new Map(parsed[0].map((parts) => [slotKey(parts), parts]))
    let common = new Map(firstKeys)
    for (let i = 1; i < parsed.length; i++) {
      const keys = new Set(parsed[i].map((parts) => slotKey(parts)))
      for (const k of common.keys()) {
        if (!keys.has(k)) common.delete(k)
      }
    }

    if (common.size) {
      const compulsory = []
      let compulsoryAny = false
      for (const parts of common.values()) {
        if (parts.length === 1) {
          // Single subject → AND lock
          if (!compulsory.includes(parts[0])) compulsory.push(parts[0])
        } else {
          // OR-pair inside chain → pick best
          compulsoryAny = true
          for (const p of parts) {
            if (!compulsory.includes(p)) compulsory.push(p)
          }
        }
      }
      if (compulsory.length) return { compulsory, compulsoryAny }
    }
  }

  // ── Step 2: bare OR-pair slot ──────────────────────────────────────────────
  const orCompulsory = []
  if (
    /(?:applied mathematics|mathematics)\s*\/\s*(?:applied mathematics|mathematics)/i.test(normElig) &&
    normElig.includes('any other')
  ) {
    orCompulsory.push('mathematics', 'applied mathematics')
  }
  if (
    /(?:accountancy|book keeping)\s*\/\s*(?:accountancy|book keeping)/i.test(normElig) &&
    normElig.includes('any other')
  ) {
    orCompulsory.push('accountancy', 'book keeping')
  }
  if (orCompulsory.length) {
    return { compulsory: [...new Set(orCompulsory)], compulsoryAny: true }
  }

  // ── Step 3: named language compulsory ("hindi from list a") ───────────────
  for (const lang of LANGUAGE_SET) {
    const langEsc = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${langEsc}\\b from list a`, 'i').test(normElig)) {
      return { compulsory: [lang], compulsoryAny: false }
    }
  }

  // ── Step 4: nothing ────────────────────────────────────────────────────────
  return { compulsory: [], compulsoryAny: false }
}

/**
 * Parse an eligibility string into a structured rule object.
 * Mirrors Python _build_rules_dict logic for a single row.
 *
 *  {
 *    compulsory:    string[]   normalised token(s) that must be locked
 *    compulsoryAny: boolean    true = OR rule, false = AND rule
 *    languageReq:   boolean    needs a List-A language
 *    totalSubjects: number     total subject slots (lang + domain)
 *    usesGat:       boolean    needs General Aptitude Test
 *  }
 */
function parseEligibilityRule(eligibilityText) {
  const n = norm(eligibilityText)

  const languageReq = n.includes('from list a')
  const usesGat     = n.includes('general aptitude test')

  // Free-choice domain slot count
  let totalSubjects
  if (n.includes('any three subjects from list b'))     totalSubjects = 4  // 1 lang + 3 domain
  else if (n.includes('any two subjects from list b'))  totalSubjects = 3  // 1 lang + 2 domain
  else if (n.includes('any one subject from list b'))   totalSubjects = 2  // 1 lang + 1 domain
  else                                                  totalSubjects = 4  // science default

  const { compulsory, compulsoryAny } = extractCompulsory(n)

  // Science courses: total = exactly the number of compulsory subjects
  if (compulsory.length && !compulsoryAny && totalSubjects === 4) {
    totalSubjects = compulsory.length
  }

  return { compulsory, compulsoryAny, languageReq, totalSubjects, usesGat }
}


// ─── Core scoring engine (mirrors Python calculate_cuet_score) ────────────────

/**
 * Find the eligibility text for `courseName` from the courseRequirements array.
 * Uses the same normalised fuzzy-match as App.jsx's courseRequirementIndex.
 */
function findEligibility(courseName, courseRequirements) {
  const query = norm(courseName).replace(/[^a-z0-9]/g, '')
  for (const entry of courseRequirements) {
    const key = norm(String(entry.course || '')).replace(/\n/g, ' ').replace(/[^a-z0-9]/g, '')
    if (key === query) return entry.eligibility || ''
  }
  // Partial fallback
  for (const entry of courseRequirements) {
    const key = norm(String(entry.course || '')).replace(/\n/g, ' ').replace(/[^a-z0-9]/g, '')
    if (key.includes(query) || query.includes(key)) return entry.eligibility || ''
  }
  return null
}

/**
 * Build a flat token → marks map from the student's subject entries.
 * e.g. [{ subject: "Mathematics / Applied Mathematics", marks: 185 }]
 *   → { "mathematics": 185, "applied mathematics": 185 }
 */
function buildTokenMap(subjectEntries) {
  const map = {}
  for (const { subject, marks } of subjectEntries) {
    const tokens = subjectToTokens(subject)
    for (const t of tokens) map[t] = marks
    // Also store by original normalised label for language matching
    map[norm(subject)] = marks
  }
  return map
}

/**
 * Main engine. Returns a breakdown object:
 * {
 *   lockedSubjects:    string[]         tokens that were compulsory-locked
 *   chosenSubjects:    string[]         final subject list (tokens)
 *   subjectScores:     {token: marks}   score per chosen subject
 *   rawTotal:          number
 *   maxPossible:       number
 *   consolidatedScore: number           out of 1000
 *   fallback:          boolean          true if no eligibility rule found
 * }
 */
function getScoreBreakdown(subjectEntries, courseName, courseRequirements) {
  // ── Fetch rule ─────────────────────────────────────────────────────────────
  const eligText = findEligibility(courseName, courseRequirements)

  // No rule found → plain average fallback (same as old computeStudentScore)
  if (!eligText) {
    const totalRaw  = subjectEntries.reduce((s, e) => s + e.marks, 0)
    const maxPoss   = subjectEntries.length * MARKS_PER_SUBJECT
    const score     = maxPoss ? Math.round((totalRaw / maxPoss) * MAX_SCORE) : 0
    return {
      lockedSubjects: [], chosenSubjects: subjectEntries.map((e) => e.subject),
      subjectScores: Object.fromEntries(subjectEntries.map((e) => [e.subject, e.marks])),
      rawTotal: totalRaw, maxPossible: maxPoss, consolidatedScore: score, fallback: true,
    }
  }

  const rule      = parseEligibilityRule(eligText)
  const tokenMap  = buildTokenMap(subjectEntries)

  // Separate student subjects into languages vs domain vs GAT
  const studentLangs   = subjectEntries.filter((e) => LANGUAGE_SET.has(norm(e.subject)))
  const studentDomain  = subjectEntries.filter(
    (e) => !LANGUAGE_SET.has(norm(e.subject)) && norm(e.subject) !== GAT_LABEL
  )
  const gatEntry       = subjectEntries.find((e) => norm(e.subject) === GAT_LABEL)

  // ── Step 1: Lock compulsory subjects ──────────────────────────────────────
  const locked = []

  if (rule.compulsory.length) {
    if (rule.compulsoryAny) {
      // Pick the highest-scoring one the student actually has
      const available = rule.compulsory
        .filter((t) => studentHasToken(tokenMap, t))
        .map((t) => ({ token: t, marks: tokenMap[t] }))
        .sort((a, b) => b.marks - a.marks)

      if (available.length) locked.push(available[0].token)
      // (if none available, silently skip — eligibility check is App.jsx's job)
    } else {
      // Lock all compulsory tokens the student has
      for (const t of rule.compulsory) {
        if (studentHasToken(tokenMap, t)) locked.push(t)
      }
    }
  }

  // ── Step 2: Language slot ─────────────────────────────────────────────────
  let chosenLang = null
  if (rule.languageReq && studentLangs.length) {
    chosenLang = studentLangs.reduce((best, e) => e.marks > best.marks ? e : best).subject
    chosenLang = norm(chosenLang)
  }

  // ── Step 3: Fill remaining optional domain slots ──────────────────────────
  const usedSlots            = locked.length
  const langSlots            = chosenLang ? 1 : 0
  const domainSlotsAvailable = rule.totalSubjects - langSlots - usedSlots

  // Optional candidates: domain subjects not already locked
  // Map back to original entry marks using tokenMap
  const optionalCandidates = []
  for (const entry of studentDomain) {
    const tokens    = subjectToTokens(entry.subject)
    const isLocked  = tokens.some((t) => locked.includes(t))
    if (!isLocked) optionalCandidates.push({ token: norm(entry.subject), marks: entry.marks })
  }

  // Sort by marks descending, pick top N
  optionalCandidates.sort((a, b) => b.marks - a.marks)
  const chosenOptionals = optionalCandidates
    .slice(0, Math.max(0, domainSlotsAvailable))
    .map((c) => c.token)

  // ── Step 4: Assemble final list ───────────────────────────────────────────
  const chosenSubjects = []
  if (chosenLang)          chosenSubjects.push(chosenLang)
  chosenSubjects.push(...locked)
  chosenSubjects.push(...chosenOptionals)
  if (rule.usesGat && gatEntry) chosenSubjects.push(GAT_LABEL)

  // ── Step 5: Compute scores ────────────────────────────────────────────────
  const subjectScores = {}
  for (const subj of chosenSubjects) {
    subjectScores[subj] = tokenMap[subj] ?? (subj === GAT_LABEL && gatEntry ? gatEntry.marks : 0)
  }

  const rawTotal    = Object.values(subjectScores).reduce((s, v) => s + v, 0)
  const maxPossible = (chosenSubjects.length || 1) * MARKS_PER_SUBJECT
  const consolidatedScore = maxPossible
    ? Math.round((rawTotal / maxPossible) * MAX_SCORE)
    : 0

  return {
    lockedSubjects: locked,
    chosenSubjects,
    subjectScores,
    rawTotal,
    maxPossible,
    consolidatedScore,
    fallback: false,
  }
}

/**
 * Drop-in replacement for computeStudentScore(subjectEntries).
 *
 * When called with just subjectEntries (old usage), falls back to plain average.
 * When called with courseName + courseRequirements, uses the full engine.
 *
 * Usage in App.jsx:
 *   import { computeSmartScore } from './utils/scoreEngine'
 *   const studentScore = computeSmartScore(subjectEntries, course, courseRequirements)
 */
export function computeSmartScore(subjectEntries, courseName, courseRequirements) {
  if (!courseName || !courseRequirements?.length) {
    // Plain fallback — same formula as old computeStudentScore
    const totalRaw   = subjectEntries.reduce((s, e) => s + e.marks, 0)
    const maxPossible = subjectEntries.length * MARKS_PER_SUBJECT
    return maxPossible ? Math.round((totalRaw / maxPossible) * MAX_SCORE) : 0
  }
  return getScoreBreakdown(subjectEntries, courseName, courseRequirements).consolidatedScore
}

export { getScoreBreakdown }
