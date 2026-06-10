import { languages } from './constants'

// ─── Constants (mirror Python engine) ────────────────────────────────────────
const MARKS_PER_SUBJECT = 250   // CUET max per paper
const MAX_SCORE        = 1000   // Merit list ceiling

// ─── Subject token list ───────────────────────────────────────────────────────
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

const LANGUAGE_SET = new Set(languages.map((l) => l.toLowerCase().trim()))
const GAT_LABEL = 'general aptitude test'

// ─── Normalise helpers ────────────────────────────────────────────────────────
function norm(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function subjectToTokens(label) {
  const n = norm(label)
  if (FRONTEND_TO_TOKENS[n]) return FRONTEND_TO_TOKENS[n]
  return [n]
}

function studentHasToken(tokenMap, token) {
  return Boolean(tokenMap[token])
}

// ─── Parser ──────────────────────────────────────────────────────────────────
function extractCompulsory(normElig) {
  const tokAlt = SUBJECT_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const slotPat = `(?:${tokAlt})(?:\\s*/\\s*(?:${tokAlt}))*`
  const chainRe = new RegExp(`${slotPat}(?:\\s*\\+\\s*${slotPat})+`, 'gi')

  const chains = []
  let m
  const chainReCopy = new RegExp(chainRe.source, 'gi')
  while ((m = chainReCopy.exec(normElig)) !== null) chains.push(m[0])

  let compulsorySlots = []

  if (chains.length) {
    const parseChain = (chain) =>
      chain.split(/\s*\+\s*/).map((slot) =>
        slot.trim().split(/\s*\/\s*/).map((p) => p.trim())
      )

    const parsed = chains.map(parseChain)

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
      compulsorySlots = Array.from(common.values())
    }
  }

  // Bare OR-pair check
  if (compulsorySlots.length === 0) {
    if (/(?:applied mathematics|mathematics)\s*\/\s*(?:applied mathematics|mathematics)/i.test(normElig)) {
      compulsorySlots.push(['mathematics', 'applied mathematics'])
    } else if (/(?:accountancy|book keeping)\s*\/\s*(?:accountancy|book keeping)/i.test(normElig)) {
      compulsorySlots.push(['accountancy', 'book keeping'])
    }
  }

  // Named language required
  for (const lang of LANGUAGE_SET) {
    const langEsc = lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${langEsc}\\b\\s+from\\s+list`, 'i').test(normElig)) {
      compulsorySlots.push([lang])
    }
  }

  return compulsorySlots
}

function parseCombinationRule(n) {
  let languageReqCount = 0
  if (n.includes('any two languages')) languageReqCount = 2
  else if (n.includes('any one language') || n.includes('any language')) languageReqCount = 1

  const usesGat = n.includes('general aptitude test') || n.includes('general aptitute test') || n.includes('gat')

  const compulsorySlots = extractCompulsory(n)

  let optionalDomains = 0
  if (n.includes('any three subjects')) optionalDomains = 3
  else if (n.includes('any two subjects') || n.includes('any other two subjects')) optionalDomains = 2
  else if (n.includes('any one subject') || n.includes('any one other subject') || n.includes('any one other')) optionalDomains = 1

  return { compulsorySlots, languageReqCount, usesGat, optionalDomains }
}

const COURSE_ALIASES = {
  'bachelorofbusinessadministrationfinancialinvestmentanalysisbbafia': 'bachelorofbusinessadministrationinfinancialinvestmentanalysisbbafia',
  'bscappliedphysicalscienceswithanalyticalmethodsinchemistrybiochemistry': 'bscprogappliedphysicalscienceswithanalyticalmethodsinchemistrybiochemistry',
  'bvocsoftwaredevelopment': 'bvocsofwaredevelopment', // Handles JSON typo
}

function findEligibility(courseName, courseRequirements) {
  let query = norm(courseName).replace(/[^a-z0-9]/g, '')
  query = COURSE_ALIASES[query] || query

  for (const entry of courseRequirements) {
    const key = norm(String(entry.course || '')).replace(/\n/g, ' ').replace(/[^a-z0-9]/g, '')
    if (key === query) return entry.eligibility || ''
  }
  for (const entry of courseRequirements) {
    const key = norm(String(entry.course || '')).replace(/\n/g, ' ').replace(/[^a-z0-9]/g, '')
    if (key.includes(query) || query.includes(key)) return entry.eligibility || ''
  }
  return null
}

function buildTokenMap(subjectEntries) {
  const map = {}
  for (const { subject, marks } of subjectEntries) {
    const tokens = subjectToTokens(subject)
    for (const t of tokens) map[t] = marks
    map[norm(subject)] = marks
  }
  return map
}

// ─── Core Engine ─────────────────────────────────────────────────────────────
function getScoreBreakdown(subjectEntries, courseName, courseRequirements) {
  const eligText = findEligibility(courseName, courseRequirements)

  if (!eligText) {
    const totalRaw  = subjectEntries.reduce((s, e) => s + e.marks, 0)
    const maxPoss   = subjectEntries.length * MARKS_PER_SUBJECT
    const score     = maxPoss ? Math.round((totalRaw / maxPoss) * MAX_SCORE) : 0
    return {
      lockedSubjects: [], chosenSubjects: subjectEntries.map((e) => e.subject),
      subjectScores: Object.fromEntries(subjectEntries.map((e) => [e.subject, e.marks])),
      rawTotal: totalRaw, maxPossible: maxPoss, consolidatedScore: score, fallback: true, isEligible: true
    }
  }

  const tokenMap  = buildTokenMap(subjectEntries)
  const gatEntry  = subjectEntries.find((e) => norm(e.subject) === GAT_LABEL)
  const studentLangs = subjectEntries.filter((e) => LANGUAGE_SET.has(norm(e.subject)))
  
  // Languages can be used as domains if not selected as languages!
  const studentDomain = subjectEntries.filter(e => norm(e.subject) !== GAT_LABEL)

  // Split the eligibility text by "OR" to evaluate each combination independently
  const combinations = norm(eligText).split(/\bor\b/g).map(c => c.trim()).filter(Boolean)

  let bestResult = null

  for (const combText of combinations) {
    const rule = parseCombinationRule(combText)

    const locked = []
    let isEligible = true

    // 1. Lock compulsory subjects
    for (const slot of rule.compulsorySlots) {
      const available = slot
        .filter(t => studentHasToken(tokenMap, t))
        .map(t => ({ token: t, marks: tokenMap[t] }))
        .sort((a, b) => b.marks - a.marks)
        .filter(a => !locked.includes(a.token))

      if (available.length > 0) {
        locked.push(available[0].token)
      } else {
        isEligible = false
        break
      }
    }

    // 2. Language slots
    const chosenLangs = []
    if (rule.languageReqCount > 0) {
      const availableLangs = studentLangs.filter(e => {
        const tokens = subjectToTokens(e.subject)
        return !tokens.some(t => locked.includes(t))
      }).sort((a, b) => b.marks - a.marks)

      if (availableLangs.length >= rule.languageReqCount) {
        for (let i = 0; i < rule.languageReqCount; i++) {
          chosenLangs.push(norm(availableLangs[i].subject))
        }
      } else {
        isEligible = false
      }
    }

    // 3. Optional domain slots
    const optionalCandidates = []
    for (const entry of studentDomain) {
      const nSubj = norm(entry.subject)
      if (chosenLangs.includes(nSubj)) continue
      const tokens = subjectToTokens(entry.subject)
      if (!tokens.some(t => locked.includes(t))) {
        optionalCandidates.push({ token: nSubj, marks: entry.marks })
      }
    }
    
    optionalCandidates.sort((a, b) => b.marks - a.marks)
    const chosenOptionals = optionalCandidates
      .slice(0, Math.max(0, rule.optionalDomains))
      .map(c => c.token)
    
    if (chosenOptionals.length < rule.optionalDomains) {
      isEligible = false
    }

    // 4. Assemble final list
    const chosenSubjects = []
    // Science courses typically require 3 compulsory domains and use language just as a qualifier.
    const isScience = (rule.compulsorySlots.length >= 3 && rule.optionalDomains === 0)

    if (!isScience) {
      chosenSubjects.push(...chosenLangs)
    }
    chosenSubjects.push(...locked)
    chosenSubjects.push(...chosenOptionals)

    if (rule.usesGat) {
      if (gatEntry) chosenSubjects.push(GAT_LABEL)
      else isEligible = false
    }

    // 5. Score Calculation
    const subjectScores = {}
    for (const subj of chosenSubjects) {
      subjectScores[subj] = tokenMap[subj] ?? (subj === GAT_LABEL && gatEntry ? gatEntry.marks : 0)
    }
    // Add qualifying languages for UI completeness
    if (isScience) {
       for (const lang of chosenLangs) {
         subjectScores[lang] = tokenMap[lang] ?? 0
       }
    }

    const maxPossible = (chosenSubjects.length || 1) * MARKS_PER_SUBJECT
    const meritTotal = chosenSubjects.reduce((s, subj) => s + (subjectScores[subj] || 0), 0)
    const consolidatedScore = maxPossible ? Math.round((meritTotal / maxPossible) * MAX_SCORE) : 0

    const result = {
      lockedSubjects: locked,
      chosenSubjects: isScience ? [...chosenLangs, ...chosenSubjects] : chosenSubjects,
      subjectScores,
      rawTotal: meritTotal,
      maxPossible,
      consolidatedScore,
      fallback: false,
      isEligible
    }

    // Keep the best valid result
    if (!bestResult) {
      bestResult = result
    } else {
      if (result.isEligible && !bestResult.isEligible) {
        bestResult = result
      } else if (result.isEligible && bestResult.isEligible) {
        if (result.consolidatedScore > bestResult.consolidatedScore) {
          bestResult = result
        }
      }
    }
  }

  return bestResult
}

export function computeSmartScore(subjectEntries, courseName, courseRequirements) {
  if (!courseName || !courseRequirements?.length) {
    const totalRaw   = subjectEntries.reduce((s, e) => s + e.marks, 0)
    const maxPossible = subjectEntries.length * MARKS_PER_SUBJECT
    return maxPossible ? Math.round((totalRaw / maxPossible) * MAX_SCORE) : 0
  }
  return getScoreBreakdown(subjectEntries, courseName, courseRequirements).consolidatedScore
}

export { getScoreBreakdown }

