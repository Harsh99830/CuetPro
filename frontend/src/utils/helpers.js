import { languages, domainSubjects, generalTests } from './constants'

export function normalizeTextForMatch(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function normalizeCourseName(course) {
  return normalizeTextForMatch(String(course || '').replace(/\s+/g, ' '))
}

export function normalizeSubject(subject) {
  return normalizeTextForMatch(subject)
}

export function formatProgram(program) {
  return String(program || '').replace(/\s+/g, ' ').trim()
}

export function inferStream(program) {
  const p = String(program || '').toLowerCase()
  if (p.includes('b.com') || p.includes('bms') || p.includes('bba') || p.includes('financial')) return 'Commerce'
  if (p.includes('b.sc') || p.includes('science') || p.includes('computer') || p.includes('statistics')) return 'Science'
  return 'Humanities'
}

export function hasSubject(selectedNorm, subjectName) {
  const targetNorm = normalizeSubject(subjectName)
  return selectedNorm.some((v) => v === targetNorm || v.includes(targetNorm) || targetNorm.includes(v))
}

export function hasAnySubjectVariant(selectedNorm, variants) {
  return variants.some((variant) => hasSubject(selectedNorm, variant))
}

export function countByList(subjects) {
  const languageNormSet = new Set(languages.map((item) => normalizeSubject(item)))
  const selectedNorm = subjects.map((item) => normalizeSubject(item))
  const listACount = selectedNorm.filter((item) => languageNormSet.has(item)).length
  const listBCount = selectedNorm.length - listACount
  return { listACount, listBCount, selectedNorm }
}

export function includesToken(containerNorm, tokenRaw) {
  const token = normalizeTextForMatch(tokenRaw)
  return token && containerNorm.includes(token)
}

function parseRequiredCount(segmentNorm, type) {
  const patterns = type === 'A'
    ? [{ re: /anyonelanguagefromlista/, count: 1 }, { re: /anytwolanguagesfromlista/, count: 2 }]
    : [
        { re: /anyone(?:other)?subjectfromlistb/, count: 1 },
        { re: /anytwo(?:other)?subjectsfromlistb/, count: 2 },
        { re: /anythree(?:other)?subjectsfromlistb/, count: 3 },
      ]
  for (const pattern of patterns) {
    if (pattern.re.test(segmentNorm)) return pattern.count
  }
  return 0
}

function specificListARequirements(segmentNorm) {
  return languages.filter((lang) => includesToken(segmentNorm, `${lang}fromlista`))
}

function specificListBRequirements(segmentNorm) {
  return domainSubjects.filter((subject) => includesToken(segmentNorm, `${subject}fromlistb`))
}

export function evaluateCombinationRule(segmentText, subjects) {
  const segmentNorm = normalizeTextForMatch(segmentText)
  const { listACount, listBCount, selectedNorm } = countByList(subjects)

  if (listACount < parseRequiredCount(segmentNorm, 'A')) return false
  if (listBCount < parseRequiredCount(segmentNorm, 'B')) return false
  if (specificListARequirements(segmentNorm).some((item) => !hasSubject(selectedNorm, item))) return false
  if (specificListBRequirements(segmentNorm).some((item) => !hasSubject(selectedNorm, item))) return false
  if (includesToken(segmentNorm, 'generalaptitudetest') && !hasAnySubjectVariant(selectedNorm, generalTests)) return false
  if (includesToken(segmentNorm, 'physics') && !hasAnySubjectVariant(selectedNorm, ['Physics'])) return false
  if (includesToken(segmentNorm, 'chemistry') && !hasAnySubjectVariant(selectedNorm, ['Chemistry'])) return false
  if (includesToken(segmentNorm, 'biology') && !hasAnySubjectVariant(selectedNorm, ['Biology / Biological Studies / Biotechnology / Biochemistry'])) return false
  if (includesToken(segmentNorm, 'mathematics') && !hasAnySubjectVariant(selectedNorm, ['Mathematics / Applied Mathematics'])) return false
  if (includesToken(segmentNorm, 'massmedia') && !hasAnySubjectVariant(selectedNorm, ['Mass Media / Mass Communication'])) return false
  if (includesToken(segmentNorm, 'accountancy') && !hasAnySubjectVariant(selectedNorm, ['Accountancy / Book Keeping'])) return false
  return true
}

export function isProgramAllowedForGender(collegeGender, studentGender) {
  const g = String(collegeGender || '').toLowerCase()
  const s = String(studentGender || '').toLowerCase()
  if (g.includes('co-ed')) return true
  if (g.includes('female') || g.includes('girls')) return s === 'female'
  if (g.includes('male') || g.includes('boys')) return s === 'male'
  return true
}

export function extractCutoffForCategory(cutoffs, categoryKey) {
  if (!cutoffs || typeof cutoffs !== 'object') return null
  const direct = cutoffs[categoryKey]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const fallback = cutoffs.UR
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return null
}

export function getSubjectPreferenceSignals(selectedSubjects) {
  const selectedNorm = selectedSubjects.map((s) => normalizeSubject(s))
  const has = (variants) => variants.some((v) => hasSubject(selectedNorm, v))
  return {
    hasMath: has(['Mathematics / Applied Mathematics']),
    hasCommerce: has(['Accountancy / Book Keeping', 'Business Studies']),
    hasEconomics: has(['Economics / Business Economics']),
    hasComputer: has(['Computer Science / Information Practices']),
    hasPoliticalScience: has(['Political Science']),
    hasHistory: has(['History']),
    hasPsychology: has(['Psychology']),
    hasGeography: has(['Geography / Geology']),
    hasLanguage: selectedSubjects.some((s) => languages.includes(s)),
  }
}

export function scoreCoursePreferenceOrder(course, selectedSubjects) {
  const signals = getSubjectPreferenceSignals(selectedSubjects)
  const nc = normalizeCourseName(course)
  let score = 0
  if (nc === normalizeCourseName('B.Com (Hons.)')) return 10000
  if (nc === normalizeCourseName('B.Com')) { score += 250; if (signals.hasCommerce) score += 180; if (signals.hasMath || signals.hasEconomics) score += 70 }
  if (nc.includes(normalizeCourseName('B.A. (Hons.) Economics'))) { score += 240; if (signals.hasEconomics) score += 200; if (signals.hasMath) score += 110 }
  if (nc.includes(normalizeCourseName('B.A. (Hons.) Business Economics'))) { score += 220; if (signals.hasEconomics || signals.hasCommerce) score += 180; if (signals.hasMath) score += 100 }
  if (nc.includes(normalizeCourseName('Bachelor of Management Studies'))) { score += 220; if (signals.hasCommerce || signals.hasMath) score += 140 }
  if (nc.includes(normalizeCourseName('Bachelor of Business Administration'))) { score += 210; if (signals.hasCommerce || signals.hasMath) score += 140 }
  if (nc.includes(normalizeCourseName('B.Sc (Hons.) Mathematics'))) { score += 180; if (signals.hasMath) score += 220 }
  if (nc.includes(normalizeCourseName('B.Sc (Hons.) Statistics'))) { score += 170; if (signals.hasMath) score += 200 }
  if (nc.includes(normalizeCourseName('B.Sc (Hons.) Computer Science'))) { score += 170; if (signals.hasMath || signals.hasComputer) score += 200 }
  if (nc.includes('baprogram')) {
    score += 80
    if (signals.hasCommerce && nc.includes('commerce')) score += 220
    if (signals.hasMath && nc.includes('mathematics')) score += 220
    if (signals.hasEconomics && nc.includes('economics')) score += 200
    if (signals.hasComputer && (nc.includes('computerapplications') || nc.includes('compapp'))) score += 190
    if (signals.hasPoliticalScience && nc.includes('politicalscience')) score += 160
    if (signals.hasHistory && nc.includes('history')) score += 150
    if (signals.hasPsychology && nc.includes('psychology')) score += 150
    if (signals.hasGeography && nc.includes('geography')) score += 150
  }
  if (signals.hasLanguage && /bahons|baprogram|bcom|economics|businesseconomics/.test(nc)) score += 25
  return score
}

export function classifyChance(studentScore, requiredCutoff) {
  return Math.max(1, Math.min(99, Math.round(50 + (studentScore - requiredCutoff) / 2)))
}

export function chanceBadgeClass(chance) {
  if (chance === null || chance === undefined) return 'na'
  if (chance >= 75) return 'safe'
  if (chance >= 45) return 'match'
  return 'dream'
}

export function sanitizeFileName(name) {
  return String(name || 'student').replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '') || 'student'
}

// Remove parenthetical suffixes like (Evening), (Day), (Morning) but keep (W)
export function cleanCollegeName(name) {
  return String(name || '')
    .replace(/\s*\((?!W\))[^)]*\)/g, '')
    .trim()
}

export function getCampusLabel(college, campus) {
  return ''
}

export function formatCollegeDisplay(college, campus) {
  return String(college || '')
}

export function campusPriority() {
  return 0
}

export function prioritizeGeneratedRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.collegeRank !== b.collegeRank) return a.collegeRank - b.collegeRank
    if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore
    if (b.requiredCutoff !== a.requiredCutoff) return b.requiredCutoff - a.requiredCutoff
    return a.college.localeCompare(b.college)
  })
}

export function prioritizeCourseFirstRows(rows, courseOrder) {
  const rankedRows = prioritizeGeneratedRows(rows)
  const fallback = Array.from(new Set(rankedRows.map((r) => r.course))).sort((a, b) => a.localeCompare(b))
  const orderedCourses = (courseOrder.length ? courseOrder : fallback).filter((c, i, arr) => arr.indexOf(c) === i)
  const grouped = []
  orderedCourses.forEach((course) => grouped.push(...rankedRows.filter((r) => r.course === course).slice(0, 15)))
  return grouped
}

export function getMaxMarksForSubject() {
  return 250
}

export function readSubjectEntries(subjects) {
  const entries = []
  const seen = new Set()
  for (let i = 0; i < subjects.length; i++) {
    const { subject, marks } = subjects[i]
    const hasSubjectValue = Boolean(subject)
    const hasMarks = marks !== ''

    // Skip completely empty rows
    if (!hasSubjectValue && !hasMarks) continue

    // If subject selected, marks must be present
    if (hasSubjectValue && !hasMarks) throw new Error(`Marks are required for Subject ${i + 1}.`)

    // If marks entered without subject, ignore the marks
    if (!hasSubjectValue && hasMarks) continue

    if (seen.has(subject)) throw new Error(`Subject ${subject} has been selected more than once.`)
    seen.add(subject)
    const numericMarks = Number(marks)
    const maxAllowed = getMaxMarksForSubject(subject)
    if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > maxAllowed) {
      throw new Error(`Marks for Subject ${i + 1} must be between 0 and ${maxAllowed}.`)
    }
    entries.push({ subject, marks: numericMarks })
  }
  if (!entries.length) throw new Error('Please select at least one subject with marks.')
  return entries
}

export function computeStudentScore(subjectEntries) {
  // Sum all subjects (max 1250 for 5 subjects × 250), then scale to 1000
  const totalRaw = subjectEntries.reduce((sum, e) => sum + e.marks, 0)
  const maxPossible = subjectEntries.length * 250
  return Math.round((totalRaw / maxPossible) * 1000)
}

export function computeStudentScoreMax(subjectEntries) {
  // Max possible is always 1000 after scaling
  return 1000
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(script)
  })
}

export function flattenOptions(options = []) {
  return options.flatMap((o) => (o?.type === 'group' ? o.options || [] : o))
}

export function filterDropdownOptions(options = [], query = '') {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.map((o) => {
    if (o?.type === 'group') {
      const filtered = (o.options || []).filter((item) => item.label.toLowerCase().includes(q))
      return filtered.length ? { ...o, options: filtered } : null
    }
    return o.label.toLowerCase().includes(q) ? o : null
  }).filter(Boolean)
}
