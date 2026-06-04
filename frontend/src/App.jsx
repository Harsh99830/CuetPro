import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const languages = [
  'Assamese',
  'Bengali',
  'English',
  'Gujarati',
  'Hindi',
  'Kannada',
  'Malayalam',
  'Marathi',
  'Odia',
  'Punjabi',
  'Sanskrit',
  'Tamil',
  'Telugu',
  'Urdu',
]

const domainSubjects = [
  'Accountancy / Book Keeping',
  'Agriculture',
  'Anthropology',
  'Biology / Biological Studies / Biotechnology / Biochemistry',
  'Business Studies',
  'Chemistry',
  'Computer Science / Information Practices',
  'Economics / Business Economics',
  'Environmental Studies / Environmental Science',
  'Fine Arts / Visual Arts / Commercial Arts',
  'Geography / Geology',
  'History',
  'Home Science',
  'Knowledge Tradition - Practices in India',
  'Mass Media / Mass Communication',
  'Mathematics / Applied Mathematics',
  'Performing Arts (Dance, Drama, Music)',
  'Physical Education (Yoga, Sports)',
  'Physics',
  'Political Science',
  'Psychology',
  'Sociology',
]

const generalTests = ['General Aptitude Test']

const categoryToCutoffKey = {
  GEN: 'UR',
  OBC: 'OBC',
  EWS: 'EWS',
  SC: 'SC',
  ST: 'ST',
  PWD: 'PwBD',
}

const northCampusColleges = new Set([
  "St. Stephen's College",
  'Shri Ram College of Commerce',
  'Hindu College',
  'Hansraj College',
  'Miranda House',
  'Kirori Mal College',
  'Ramjas College',
  'Daulat Ram College',
  'Sri Guru Tegh Bahadur Khalsa College',
])

const initialForm = {
  name: '',
  gender: '',
  category: '',
  stream: '',
  displayMode: 'college-first',
  campusPreference: 'both',
}

const initialSubjects = Array.from({ length: 5 }, (_, index) => ({
  subject: '',
  marks: '',
  label: `Subject ${index + 1}${index === 0 ? '*' : ''}`,
}))

function normalizeTextForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeCourseName(course) {
  return normalizeTextForMatch(String(course || '').replace(/\s+/g, ' '))
}

function normalizeSubject(subject) {
  return normalizeTextForMatch(subject)
}

function formatProgram(program) {
  return String(program || '').replace(/\s+/g, ' ').trim()
}

function inferStream(program) {
  const p = String(program || '').toLowerCase()
  if (
    p.includes('b.com') ||
    p.includes('bms') ||
    p.includes('bba') ||
    p.includes('financial')
  ) {
    return 'Commerce'
  }
  if (
    p.includes('b.sc') ||
    p.includes('science') ||
    p.includes('computer') ||
    p.includes('statistics')
  ) {
    return 'Science'
  }
  return 'Humanities'
}

function hasSubject(selectedNorm, subjectName) {
  const targetNorm = normalizeSubject(subjectName)
  return selectedNorm.some(
    (value) =>
      value === targetNorm || value.includes(targetNorm) || targetNorm.includes(value),
  )
}

function hasAnySubjectVariant(selectedNorm, variants) {
  return variants.some((variant) => hasSubject(selectedNorm, variant))
}

function countByList(subjects) {
  const languageNormSet = new Set(languages.map((item) => normalizeSubject(item)))
  const selectedNorm = subjects.map((item) => normalizeSubject(item))
  const listACount = selectedNorm.filter((item) => languageNormSet.has(item)).length
  const listBCount = selectedNorm.length - listACount
  return { listACount, listBCount, selectedNorm }
}

function includesToken(containerNorm, tokenRaw) {
  const token = normalizeTextForMatch(tokenRaw)
  return token && containerNorm.includes(token)
}

function parseRequiredCount(segmentNorm, type) {
  const patterns =
    type === 'A'
      ? [
          { re: /anyonelanguagefromlista/, count: 1 },
          { re: /anytwolanguagesfromlista/, count: 2 },
        ]
      : [
          { re: /anyone(?:other)?subjectfromlistb/, count: 1 },
          { re: /anytwo(?:other)?subjectsfromlistb/, count: 2 },
          { re: /anythree(?:other)?subjectsfromlistb/, count: 3 },
        ]

  for (const pattern of patterns) {
    if (pattern.re.test(segmentNorm)) {
      return pattern.count
    }
  }

  return 0
}

function specificListARequirements(segmentNorm) {
  return languages.filter((lang) => includesToken(segmentNorm, `${lang}fromlista`))
}

function specificListBRequirements(segmentNorm) {
  return domainSubjects.filter((subject) =>
    includesToken(segmentNorm, `${subject}fromlistb`),
  )
}

function evaluateCombinationRule(segmentText, subjects) {
  const segmentNorm = normalizeTextForMatch(segmentText)
  const { listACount, listBCount, selectedNorm } = countByList(subjects)

  const minListA = parseRequiredCount(segmentNorm, 'A')
  const minListB = parseRequiredCount(segmentNorm, 'B')
  if (listACount < minListA || listBCount < minListB) {
    return false
  }

  const requiredListA = specificListARequirements(segmentNorm)
  if (requiredListA.some((item) => !hasSubject(selectedNorm, item))) {
    return false
  }

  const requiredListB = specificListBRequirements(segmentNorm)
  if (requiredListB.some((item) => !hasSubject(selectedNorm, item))) {
    return false
  }

  if (includesToken(segmentNorm, 'generalaptitudetest') && !hasAnySubjectVariant(selectedNorm, generalTests)) {
    return false
  }
  if (includesToken(segmentNorm, 'physics') && !hasAnySubjectVariant(selectedNorm, ['Physics'])) {
    return false
  }
  if (includesToken(segmentNorm, 'chemistry') && !hasAnySubjectVariant(selectedNorm, ['Chemistry'])) {
    return false
  }
  if (
    includesToken(segmentNorm, 'biology') &&
    !hasAnySubjectVariant(selectedNorm, [
      'Biology / Biological Studies / Biotechnology / Biochemistry',
    ])
  ) {
    return false
  }
  if (
    includesToken(segmentNorm, 'mathematics') &&
    !hasAnySubjectVariant(selectedNorm, ['Mathematics / Applied Mathematics'])
  ) {
    return false
  }
  if (
    includesToken(segmentNorm, 'massmedia') &&
    !hasAnySubjectVariant(selectedNorm, ['Mass Media / Mass Communication'])
  ) {
    return false
  }
  if (
    includesToken(segmentNorm, 'accountancy') &&
    !hasAnySubjectVariant(selectedNorm, ['Accountancy / Book Keeping'])
  ) {
    return false
  }

  return true
}

function isProgramAllowedForGender(collegeGender, studentGender) {
  const g = String(collegeGender || '').toLowerCase()
  if (g.includes('co-ed')) return true
  if (g.includes('girls')) return studentGender === 'Female'
  if (g.includes('boys')) return studentGender === 'Male'
  return true
}

function extractCutoffForCategory(cutoffs, categoryKey) {
  if (!cutoffs || typeof cutoffs !== 'object') return null
  const direct = cutoffs[categoryKey]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const fallback = cutoffs.UR
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return null
}

function getSubjectPreferenceSignals(selectedSubjects) {
  const selectedNorm = selectedSubjects.map((subject) => normalizeSubject(subject))
  const has = (variants) => variants.some((variant) => hasSubject(selectedNorm, variant))

  return {
    hasMath: has(['Mathematics / Applied Mathematics']),
    hasCommerce: has(['Accountancy / Book Keeping', 'Business Studies']),
    hasEconomics: has(['Economics / Business Economics']),
    hasComputer: has(['Computer Science / Information Practices']),
    hasPoliticalScience: has(['Political Science']),
    hasHistory: has(['History']),
    hasPsychology: has(['Psychology']),
    hasGeography: has(['Geography / Geology']),
    hasLanguage: selectedSubjects.some((subject) => languages.includes(subject)),
  }
}

function scoreCoursePreferenceOrder(course, selectedSubjects) {
  const signals = getSubjectPreferenceSignals(selectedSubjects)
  const normalizedCourse = normalizeCourseName(course)
  let score = 0

  if (normalizedCourse === normalizeCourseName('B.Com (Hons.)')) return 10000
  if (normalizedCourse === normalizeCourseName('B.Com')) {
    score += 250
    if (signals.hasCommerce) score += 180
    if (signals.hasMath || signals.hasEconomics) score += 70
  }
  if (normalizedCourse.includes(normalizeCourseName('B.A. (Hons.) Economics'))) {
    score += 240
    if (signals.hasEconomics) score += 200
    if (signals.hasMath) score += 110
  }
  if (normalizedCourse.includes(normalizeCourseName('B.A. (Hons.) Business Economics'))) {
    score += 220
    if (signals.hasEconomics || signals.hasCommerce) score += 180
    if (signals.hasMath) score += 100
  }
  if (normalizedCourse.includes(normalizeCourseName('Bachelor of Management Studies'))) {
    score += 220
    if (signals.hasCommerce || signals.hasMath) score += 140
  }
  if (normalizedCourse.includes(normalizeCourseName('Bachelor of Business Administration'))) {
    score += 210
    if (signals.hasCommerce || signals.hasMath) score += 140
  }
  if (normalizedCourse.includes(normalizeCourseName('B.Sc (Hons.) Mathematics'))) {
    score += 180
    if (signals.hasMath) score += 220
  }
  if (normalizedCourse.includes(normalizeCourseName('B.Sc (Hons.) Statistics'))) {
    score += 170
    if (signals.hasMath) score += 200
  }
  if (normalizedCourse.includes(normalizeCourseName('B.Sc (Hons.) Computer Science'))) {
    score += 170
    if (signals.hasMath || signals.hasComputer) score += 200
  }
  if (normalizedCourse.includes('baprogram')) {
    score += 80
    if (signals.hasCommerce && normalizedCourse.includes('commerce')) score += 220
    if (signals.hasMath && normalizedCourse.includes('mathematics')) score += 220
    if (signals.hasEconomics && normalizedCourse.includes('economics')) score += 200
    if (
      signals.hasComputer &&
      (normalizedCourse.includes('computerapplications') ||
        normalizedCourse.includes('compapp'))
    ) {
      score += 190
    }
    if (signals.hasPoliticalScience && normalizedCourse.includes('politicalscience')) score += 160
    if (signals.hasHistory && normalizedCourse.includes('history')) score += 150
    if (signals.hasPsychology && normalizedCourse.includes('psychology')) score += 150
    if (signals.hasGeography && normalizedCourse.includes('geography')) score += 150
  }
  if (
    signals.hasLanguage &&
    /bahons|baprogram|bcom|economics|businesseconomics/.test(normalizedCourse)
  ) {
    score += 25
  }

  return score
}

function classifyChance(studentScore, requiredCutoff) {
  const diff = studentScore - requiredCutoff
  const percentage = 50 + diff / 2
  return Math.max(1, Math.min(99, Math.round(percentage)))
}

function chanceBadgeClass(chance) {
  if (chance >= 75) return 'safe'
  if (chance >= 45) return 'match'
  return 'dream'
}

function sanitizeFileName(name) {
  return (
    String(name || 'student')
      .replace(/[^a-z0-9-_]+/gi, '_')
      .replace(/^_+|_+$/g, '') || 'student'
  )
}

function getCampusLabel(college, campus) {
  const normalized = String(campus || '').trim().toLowerCase()
  if (normalized === 'north campus' && northCampusColleges.has(String(college || '').trim())) {
    return 'North Campus'
  }
  if (normalized === 'south campus') return 'South Campus'
  return ''
}

function matchesCampusPreference(college, campus, preference) {
  const normalizedPreference = String(preference || 'both').trim().toLowerCase()
  if (normalizedPreference === 'both') return true
  const campusLabel = getCampusLabel(college, campus).toLowerCase()
  if (normalizedPreference === 'north') return campusLabel === 'north campus'
  if (normalizedPreference === 'south') return campusLabel === 'south campus'
  return true
}

function campusPriority(college, campus) {
  const campusLabel = getCampusLabel(college, campus)
  if (campusLabel === 'North Campus') return 0
  if (campusLabel === 'South Campus') return 1
  return 2
}

function prioritizeGeneratedRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.collegeRank !== b.collegeRank) return a.collegeRank - b.collegeRank
    if (campusPriority(a.college, a.campus) !== campusPriority(b.college, b.campus)) {
      return campusPriority(a.college, a.campus) - campusPriority(b.college, b.campus)
    }
    if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore
    if (b.requiredCutoff !== a.requiredCutoff) return b.requiredCutoff - a.requiredCutoff
    return a.college.localeCompare(b.college)
  })
}

function prioritizeCourseFirstRows(rows, courseOrder) {
  const rankedRows = prioritizeGeneratedRows(rows)
  const fallbackCourseOrder = Array.from(new Set(rankedRows.map((row) => row.course))).sort(
    (a, b) => a.localeCompare(b),
  )
  const orderedCourses = (courseOrder.length ? courseOrder : fallbackCourseOrder).filter(
    (course, index, list) => list.indexOf(course) === index,
  )
  const groupedRows = []
  orderedCourses.forEach((course) => {
    const topRows = rankedRows.filter((row) => row.course === course).slice(0, 15)
    groupedRows.push(...topRows)
  })
  return groupedRows
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(script)
  })
}

function readEmbeddedJson(id) {
  const el = document.getElementById(id)
  if (!el) return null
  try {
    const parsed = JSON.parse(el.textContent || 'null')
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function flattenOptions(options = []) {
  return options.flatMap((option) => {
    if (option?.type === 'group') {
      return option.options || []
    }
    return option
  })
}

function filterDropdownOptions(options = [], query = '') {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return options

  return options
    .map((option) => {
      if (option?.type === 'group') {
        const filteredGroupOptions = (option.options || []).filter((item) =>
          item.label.toLowerCase().includes(normalizedQuery),
        )
        return filteredGroupOptions.length ? { ...option, options: filteredGroupOptions } : null
      }

      return option.label.toLowerCase().includes(normalizedQuery) ? option : null
    })
    .filter(Boolean)
}

function App() {
  const [form, setForm] = useState(initialForm)
  const [subjects, setSubjects] = useState(initialSubjects)
  const [preferences, setPreferences] = useState([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [courseRequirements, setCourseRequirements] = useState([])
  const [duData, setDuData] = useState([])
  const [resultRows, setResultRows] = useState([])
  const [summary, setSummary] = useState('')
  const [statusMessage, setStatusMessage] = useState('Loading cutoffs...')
  const [locked, setLocked] = useState(true)
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [lastStudentName, setLastStudentName] = useState('student')
  const [lastMobileNumber, setLastMobileNumber] = useState('')
  const [exportReady, setExportReady] = useState(false)
  const mobileRef = useRef('')

  const courseRequirementIndex = useMemo(() => {
    const map = new Map()
    courseRequirements.forEach((entry) => {
      const key = normalizeCourseName(
        String(entry.course || '').replace(/\(Program\)/gi, '(Program)').replace(/\n/g, ' '),
      )
      if (key && entry.eligibility && !map.has(key)) map.set(key, entry.eligibility)
    })
    return map
  }, [courseRequirements])

  const selectedSubjectNames = useMemo(
    () => subjects.map((item) => item.subject).filter(Boolean),
    [subjects],
  )

  const streamCourses = useMemo(() => {
    const grouped = { Humanities: new Set(), Commerce: new Set(), Science: new Set() }
    duData.forEach((item) => {
      const program = formatProgram(item.program)
      if (!program) return
      grouped[inferStream(program)].add(program)
    })
    return {
      Humanities: Array.from(grouped.Humanities).sort(),
      Commerce: Array.from(grouped.Commerce).sort(),
      Science: Array.from(grouped.Science).sort(),
    }
  }, [duData])

  const allCourses = useMemo(
    () =>
      Array.from(
        new Set([
          ...streamCourses.Humanities,
          ...streamCourses.Commerce,
          ...streamCourses.Science,
        ]),
      ).sort(),
    [streamCourses],
  )

  function isCourseEligibleByRequirements(course, subjectNames) {
    if (!subjectNames.length) return false
    if (!courseRequirementIndex.size) return true
    const eligibility = courseRequirementIndex.get(normalizeCourseName(course))
    if (!eligibility) return false
    const normalized = String(eligibility).replace(/\s+/g, ' ').trim()
    const segments = normalized
      .split(/\s+OR\s+/i)
      .map((segment) => segment.replace(/Combination\s+[IVX0-9]+:?\s*/gi, '').trim())
      .filter(Boolean)
    if (!segments.length) return false
    return segments.some((segment) => evaluateCombinationRule(segment, subjectNames))
  }

  const availableCourses = useMemo(() => {
    const baseCourses =
      form.stream && streamCourses[form.stream]?.length ? streamCourses[form.stream] : allCourses

    const courses = baseCourses
      .filter((course) => isCourseEligibleByRequirements(course, selectedSubjectNames))
      .sort((a, b) => {
        const scoreDiff =
          scoreCoursePreferenceOrder(b, selectedSubjectNames) -
          scoreCoursePreferenceOrder(a, selectedSubjectNames)
        if (scoreDiff !== 0) return scoreDiff
        return a.localeCompare(b)
      })
    return courses
  }, [allCourses, form.stream, selectedSubjectNames, streamCourses, courseRequirementIndex])

  useEffect(() => {
    const nextAvailable = availableCourses.filter((course) => !preferences.includes(course))
    setSelectedCourse((current) => {
      if (current && nextAvailable.includes(current)) return current
      return nextAvailable[0] || ''
    })
  }, [availableCourses, preferences])

  const selectedSubjectCount = selectedSubjectNames.length
  const remainingCourses = availableCourses.filter((course) => !preferences.includes(course))
  const profileReady =
    Boolean(form.name.trim()) && Boolean(form.gender) && Boolean(form.category) && Boolean(form.stream)
  const canBuildPreferences = profileReady && selectedSubjectCount > 0
  const canGenerate = canBuildPreferences && preferences.length > 0
  const estimatedScore = useMemo(() => {
    try {
      const validEntries = readSubjectEntries(subjects)
      return `${computeStudentScore(validEntries)}/800`
    } catch {
      return '--'
    }
  }, [subjects])

  useEffect(() => {
    mobileRef.current = lastMobileNumber
  }, [lastMobileNumber])

  useEffect(() => {
    async function init() {
      try {
        await Promise.allSettled([
          loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
          loadScript(
            'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
          ),
        ])

        const requirementData = readEmbeddedJson('du-course-requirements-json')
        const cutoffData = readEmbeddedJson('du-cutoffs-seats-json')

        if (requirementData) setCourseRequirements(requirementData)
        if (cutoffData) setDuData(cutoffData)

        if (!requirementData || !cutoffData) {
          setStatusMessage('Embedded data missing')
        } else {
          setStatusMessage('Ready')
        }
      } finally {
        setLocked(false)
      }
    }

    init()
  }, [])

  function updateFormField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (field === 'stream') {
      setPreferences([])
      setResultRows([])
      setSummary('')
      setExportReady(false)
      setLocked(false)
    }
  }

  function updateSubject(index, field, value) {
    setSubjects((current) => {
      const next = current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      )
      if (field === 'subject') {
        const validSelected = next.map((item) => item.subject).filter(Boolean)
        setPreferences((existing) =>
          existing.filter((course) => isCourseEligibleByRequirements(course, validSelected)),
        )
      }
      return next
    })
    setLocked(false)
  }

  function movePreference(index, direction) {
    setPreferences((current) => {
      const next = [...current]
      const swapIndex = index + direction
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
  }

  function requestMobileNumber() {
    const input = window.prompt(
      'Enter your mobile number to continue with the download.',
      mobileRef.current,
    )
    if (input === null) return null
    const mobileNumber = input.trim()
    if (!/^\d{10}$/.test(mobileNumber)) {
      window.alert('Please enter a valid 10-digit mobile number.')
      return null
    }
    setLastMobileNumber(mobileNumber)
    return mobileNumber
  }

  function exportToExcel() {
    if (!resultRows.length || !window.XLSX) return
    if (!requestMobileNumber()) return
    const sheetRows = resultRows.map((row, idx) => ({
      'Preference No.': idx + 1,
      College: formatCollegeDisplay(row.college, row.campus),
      Course: row.course,
      'Required Cutoff': Number(row.requiredCutoff.toFixed(2)),
      Chance: `${row.chance}%`,
    }))
    const worksheet = window.XLSX.utils.json_to_sheet(sheetRows)
    const workbook = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Preferences')
    window.XLSX.writeFile(workbook, `${sanitizeFileName(lastStudentName)}_du_preference_sheet.xlsx`)
  }

  function exportToPdf() {
    if (!resultRows.length || !window.jspdf?.jsPDF) return
    if (!requestMobileNumber()) return
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFontSize(12)
    doc.text('DU Preference Sheet', 40, 32)
    doc.setFontSize(10)
    doc.text(summary, 40, 50)
    const tableBody = resultRows.map((row, idx) => [
      idx + 1,
      formatCollegeDisplay(row.college, row.campus),
      row.course,
      row.requiredCutoff.toFixed(2),
      `${row.chance}%`,
    ])
    doc.autoTable({
      head: [['Preference No.', 'College', 'Course', 'Required Cutoff', 'Chance']],
      body: tableBody,
      startY: 64,
      styles: { fontSize: 8 },
    })
    doc.save(`${sanitizeFileName(lastStudentName)}_du_preference_sheet.pdf`)
  }

  function handleAddPreference() {
    const course = selectedCourse
    if (!course) return
    setPreferences((current) => [...current, course])
  }

  function handleAddSuggestedPreferences(limit = 5) {
    if (!remainingCourses.length) return
    setPreferences((current) => [
      ...current,
      ...remainingCourses.slice(0, limit),
    ])
  }

  function handleGenerate(event) {
    event.preventDefault()

    let subjectEntries
    try {
      subjectEntries = readSubjectEntries(subjects)
    } catch (error) {
      window.alert(error.message)
      return
    }

    if (!form.stream) {
      window.alert('Please select a stream first.')
      return
    }

    if (!duData.length || !courseRequirements.length) {
      window.alert('Final generation needs the DU cutoff and course requirement datasets.')
      return
    }

    const studentScore = computeStudentScore(subjectEntries)
    const selectedCourses = preferences.length ? preferences : streamCourses[form.stream] || []
    const categoryKey = categoryToCutoffKey[form.category] || 'UR'

    const possible = duData
      .filter((item) => selectedCourses.includes(formatProgram(item.program)))
      .filter((item) =>
        isCourseEligibleByRequirements(
          formatProgram(item.program),
          subjectEntries.map((entry) => entry.subject),
        ),
      )
      .filter((item) => isProgramAllowedForGender(item.gender, form.gender))
      .filter((item) => matchesCampusPreference(item.college, item.campus, form.campusPreference))
      .map((item) => {
        const requiredCutoff = extractCutoffForCategory(item.cutoffs, categoryKey)
        if (requiredCutoff === null) return null
        const course = formatProgram(item.program)
        const chance = classifyChance(studentScore, requiredCutoff)
        const diffAbs = Math.abs(studentScore - requiredCutoff)
        const prefIndex = preferences.length ? preferences.indexOf(course) : -1
        const normalizedPref =
          prefIndex === -1 ? 0.4 : 1 - prefIndex / Math.max(1, preferences.length)
        const collegeRank = Number(item.rank) || 100
        const collegeQuality = 1 - (Math.min(Math.max(collegeRank, 1), 100) - 1) / 99
        const cutoffStrength = Math.min(requiredCutoff / 800, 1)
        const fitScore = Math.max(0, 1 - diffAbs / 180)
        const smartScore =
          collegeQuality * 0.45 +
          normalizedPref * 0.25 +
          fitScore * 0.2 +
          cutoffStrength * 0.1

        return {
          college: item.college,
          campus: item.campus,
          course,
          requiredCutoff,
          studentScore,
          chance,
          smartScore,
          collegeRank,
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore
        if (a.collegeRank !== b.collegeRank) return a.collegeRank - b.collegeRank
        if (b.requiredCutoff !== a.requiredCutoff) return b.requiredCutoff - a.requiredCutoff
        return a.college.localeCompare(b.college)
      })

    const orderedPossible =
      form.displayMode === 'course-first'
        ? prioritizeCourseFirstRows(possible, selectedCourses)
        : prioritizeGeneratedRows(possible)

    setSummary(
      `${form.name} | Stream: ${form.stream} | Category: ${form.category} | Results: ${
        form.displayMode === 'course-first' ? 'Course First' : 'College First'
      } | Campus: ${
        form.campusPreference === 'both'
          ? 'Both'
          : `${form.campusPreference.charAt(0).toUpperCase()}${form.campusPreference.slice(1)}`
      } | Estimated CUET Score: ${studentScore}/800`,
    )
    setLastStudentName(form.name || 'student')
    setExportReady(orderedPossible.length > 0)
    setLocked(orderedPossible.length > 0)
    setResultRows(orderedPossible)
  }

  function handleReset() {
    setForm(initialForm)
    setSubjects(initialSubjects)
    setPreferences([])
    setSelectedCourse('')
    setResultRows([])
    setSummary('')
    setLastStudentName('student')
    setLastMobileNumber('')
    setExportReady(false)
    setLocked(false)
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white px-3 py-6 text-[#101828] sm:px-4 sm:py-8 lg:px-6">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">
        <header className="flex min-w-0 items-start gap-4">
          <img
            src="/cuet-pro-logo.png"
            alt="CUET PRO — An Initiative by DU Toppers"
            className="h-12 w-auto shrink-0 object-contain sm:h-14"
          />
          <div className="min-w-0">
            <h1 className="font-['Georgia'] text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-tight tracking-tight text-[#101828]">
              DU Preference Sheet Generator
            </h1>
            <p className="mt-1 text-sm text-[#667085] sm:text-base">
              An initiative for DU aspirants to streamline college applications.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Subjects" value={`${selectedSubjectCount}/5`} icon="subjects" />
          <MetricCard label="Preferences" value={String(preferences.length)} icon="preferences" />
          <MetricCard label="Estimated Score" value={estimatedScore} icon="score" />
          <MetricCard label="Generated Rows" value={String(resultRows.length)} icon="generated-rows" />
        </section>

        <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.05)]">
          <form className="grid gap-6 p-5 sm:p-6" onSubmit={handleGenerate}>
              <PanelSection
                title="Student Details"
                note="This data personalises your course recommendations"
              >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Student Name">
                  <input
                    className={inputClass}
                    required
                    placeholder="Enter full name"
                    value={form.name}
                    onChange={(event) => updateFormField('name', event.target.value)}
                  />
                </Field>
                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={(event) => updateFormField('gender', event.target.value)}
                  required
                  options={['Male', 'Female', 'Other']}
                />
                <SelectField
                  label="Category"
                  value={form.category}
                  onChange={(event) => updateFormField('category', event.target.value)}
                  required
                  options={['GEN', 'OBC', 'EWS', 'SC', 'ST', 'PWD']}
                />
                <SelectField
                  label="Stream"
                  value={form.stream}
                  onChange={(event) => updateFormField('stream', event.target.value)}
                  required
                  options={['Humanities', 'Commerce', 'Science']}
                />
                <SelectField
                  label="Show Results As"
                  value={form.displayMode}
                  onChange={(event) => updateFormField('displayMode', event.target.value)}
                  options={[
                    { label: 'College First', value: 'college-first' },
                    { label: 'Course First', value: 'course-first' },
                  ]}
                />
                <SelectField
                  label="Campus Preference"
                  value={form.campusPreference}
                  onChange={(event) => updateFormField('campusPreference', event.target.value)}
                  options={[
                    { label: 'Both', value: 'both' },
                    { label: 'North', value: 'north' },
                    { label: 'South', value: 'south' },
                  ]}
                />
              </div>
              </PanelSection>

              <PanelSection
                title="CUET Subjects"
                note="Minimum 1 subject required for initial suggestions"
              >
              <div className="grid gap-0 rounded-[20px] border border-[#eef2f6]">
                {subjects.map((item, index) => {
                  const selectedElsewhere = subjects
                    .map((subjectItem, subjectIndex) =>
                      subjectIndex === index ? '' : subjectItem.subject,
                    )
                    .filter(Boolean)

                  return (
                    <div
                      key={item.label}
                      className="grid gap-3 border-b border-[#eef2f6] bg-white px-4 py-4 last:border-b-0 lg:grid-cols-[70px_minmax(0,1fr)_minmax(150px,170px)]"
                    >
                      <span className="self-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                        S - 0{index + 1}
                      </span>
                      <label className="sr-only" htmlFor={`subject-${index + 1}`}>
                        {item.label}
                      </label>
                      <CustomDropdown
                        id={`subject-${index + 1}`}
                        placeholder={index === 0 ? 'Select subject (Required*)' : 'Select subject'}
                        required={index === 0}
                        options={[
                          {
                            type: 'group',
                            label: 'Languages',
                            options: languages
                              .filter(
                                (subject) =>
                                  subject === item.subject || !selectedElsewhere.includes(subject),
                              )
                              .map((subject) => ({ label: subject, value: subject })),
                          },
                          {
                            type: 'group',
                            label: 'Domain Subjects',
                            options: domainSubjects
                              .filter(
                                (subject) =>
                                  subject === item.subject || !selectedElsewhere.includes(subject),
                              )
                              .map((subject) => ({ label: subject, value: subject })),
                          },
                          {
                            type: 'group',
                            label: 'General Tests',
                            options: generalTests
                              .filter(
                                (subject) =>
                                  subject === item.subject || !selectedElsewhere.includes(subject),
                              )
                              .map((subject) => ({ label: subject, value: subject })),
                          },
                        ]}
                        value={item.subject}
                        onChange={(event) => updateSubject(index, 'subject', event.target.value)}
                      />
                      <input
                        className={marksInputClass}
                        type="number"
                        min="0"
                        max="250"
                        placeholder="Marks (0-200)"
                        required={index === 0}
                        value={item.marks}
                        onChange={(event) => updateSubject(index, 'marks', event.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
              </PanelSection>

              <PanelSection
                title="Course Selection & Ordering"
                note="Search & select course"
              >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <CustomDropdown
                  value={selectedCourse}
                  onChange={(event) => setSelectedCourse(event.target.value)}
                  disabled={locked || !remainingCourses.length}
                  placeholder={
                    selectedSubjectNames.length
                      ? 'No more eligible courses available'
                      : statusMessage
                  }
                  options={remainingCourses.map((course) => ({ label: course, value: course }))}
                />
                <button
                  type="button"
                  className={softButtonClass}
                  disabled={!selectedCourse || locked}
                  onClick={handleAddPreference}
                >
                  Add To List
                </button>
                <button
                  type="button"
                  className={chipButtonClass}
                  disabled={locked || !remainingCourses.length}
                  onClick={() => handleAddSuggestedPreferences(5)}
                >
                  Top 5 Auto
                </button>
              </div>

              <ul className="mt-4 grid gap-2">
                {preferences.length ? (
                  preferences.map((course, index) => (
                    <li
                      key={`${course}-${index}`}
                      className="grid gap-2 rounded-2xl border border-[#e4e7ec] bg-[#fcfcfd] p-3 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
                    >
                      <strong className="flex min-w-12 items-center justify-center rounded-xl bg-[#e8f1ff] px-3 py-2 text-sm font-bold text-[#2563eb]">
                        #{index + 1}
                      </strong>
                      <span className="min-w-0 self-center text-sm font-medium text-[#101828]">{course}</span>
                      <IconButton
                        label="Move up"
                        disabled={index === 0}
                        onClick={() => movePreference(index, -1)}
                      >
                        ↑
                      </IconButton>
                      <IconButton
                        label="Move down"
                        disabled={index === preferences.length - 1}
                        onClick={() => movePreference(index, 1)}
                      >
                        ↓
                      </IconButton>
                      <IconButton
                        label="Remove preference"
                        onClick={() =>
                          setPreferences((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        ×
                      </IconButton>
                    </li>
                  ))
                ) : (
                  <li className="rounded-[24px] border border-dashed border-[#dbe3f0] bg-[#fcfdff] px-6 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f5fb] text-2xl text-[#c7d2e6]">
                      ≋
                    </div>
                    <p className="text-base font-medium text-[#101828]">No courses selected yet</p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-[#98a2b3]">
                      {canBuildPreferences
                        ? 'Add your CUET subjects and marks to see personalised course recommendations based on last year cut-offs.'
                        : 'Complete profile and add at least one subject to unlock course suggestions.'}
                    </p>
                  </li>
                )}
              </ul>
              </PanelSection>

            <div className="rounded-[24px] bg-[#101828] px-5 py-5 text-white shadow-[0_18px_36px_rgba(16,24,40,0.18)] sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-2xl font-semibold">Ready to generate?</p>
                  <p className="mt-1 text-sm text-white/70">
                    Please ensure all subject marks are entered correctly.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className={footerPrimaryButtonClass} disabled={!canGenerate}>
                    Generate Sheet
                  </button>
                  <button type="button" className={footerSecondaryButtonClass} onClick={handleReset}>
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          </form>
        </section>

        {summary || resultRows.length ? (
          <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white p-5 shadow-[0_8px_24px_rgba(16,24,40,0.05)] sm:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-['Georgia'] text-2xl font-bold text-[#101828]">
                  Generated Preference Sheet
                </h2>
              </div>
              <p className="min-w-0 text-sm text-[#98a2b3] lg:max-w-[55%]">{summary}</p>
            </div>

            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-[#98a2b3]">
                Drag a college row to shift it up or down in your final preference order.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={chipButtonClass}
                  disabled={!exportReady}
                  onClick={exportToExcel}
                >
                  Download Excel
                </button>
                <button
                  type="button"
                  className={softButtonClass}
                  disabled={!exportReady}
                  onClick={exportToPdf}
                >
                  Download PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[24px] border border-[#e4e7ec]">
              <table className="w-full min-w-0 border-collapse bg-white text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs uppercase tracking-[0.18em] text-[#667085]">
                  <tr>
                    <th className="px-4 py-3">Preference No.</th>
                    <th className="px-4 py-3">College</th>
                    <th className="px-4 py-3">Course</th>
                    <th className="px-4 py-3">Required Cutoff</th>
                    <th className="px-4 py-3">Chance</th>
                  </tr>
                </thead>
                <tbody>
                  {resultRows.length ? (
                    resultRows.map((row, index) => (
                      <tr
                        key={`${row.college}-${row.course}-${index}`}
                        draggable
                        onDragStart={() => setDraggedIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (draggedIndex === null || draggedIndex === index) return
                          setResultRows((current) => {
                            const next = [...current]
                            const [moved] = next.splice(draggedIndex, 1)
                            next.splice(index, 0, moved)
                            return next
                          })
                          setDraggedIndex(null)
                        }}
                        onDragEnd={() => setDraggedIndex(null)}
                        className="cursor-grab border-t border-[#eef2f6] hover:bg-[#f8fafc]"
                      >
                        <td className="px-4 py-3 text-[#667085]">{index + 1}</td>
                        <td className="px-4 py-3">
                          <CollegeCell college={row.college} campus={row.campus} />
                        </td>
                        <td className="px-4 py-3">{row.course}</td>
                        <td className="px-4 py-3">{row.requiredCutoff.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <ChanceBadge chance={row.chance} tone={chanceBadgeClass(row.chance)} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-[#98a2b3]" colSpan="5">
                        No matching records found for selected stream, courses, category, and
                        gender.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <footer className="pb-6 text-center text-xs text-[#98a2b3]">
          <p>&copy; 2024 CUET PRO Portal. Designed for DU Admissions Assistance.</p>
          <p className="mt-2">Privacy Policy   User Guide   Contact Support</p>
        </footer>
      </div>
    </main>
  )
}

function readSubjectEntries(subjects) {
  const entries = []
  const selectedSubjects = new Set()

  for (let i = 0; i < subjects.length; i += 1) {
    const { subject, marks } = subjects[i]
    const hasSubjectValue = Boolean(subject)
    const hasMarks = marks !== ''

    if (i === 0 && (!hasSubjectValue || !hasMarks)) {
      throw new Error('Subject 1 and its marks are compulsory.')
    }
    if (hasSubjectValue !== hasMarks) {
      throw new Error(`For Subject ${i + 1}, select both subject and marks.`)
    }
    if (!hasSubjectValue) continue
    if (selectedSubjects.has(subject)) {
      throw new Error(`Subject ${subject} has been selected more than once.`)
    }
    selectedSubjects.add(subject)
    const numericMarks = Number(marks)
    if (!Number.isFinite(numericMarks) || numericMarks < 0 || numericMarks > 250) {
      throw new Error(`Marks for Subject ${i + 1} must be between 0 and 250.`)
    }
    entries.push({ subject, marks: numericMarks })
  }

  return entries
}

function computeStudentScore(subjectEntries) {
  const sortedMarks = subjectEntries.map((item) => item.marks).sort((a, b) => b - a)
  const topMarks = sortedMarks.slice(0, 4)
  const average = topMarks.reduce((sum, value) => sum + value, 0) / topMarks.length
  return Math.round(average * 3.2)
}

function formatCollegeDisplay(college, campus) {
  const campusLabel = getCampusLabel(college, campus)
  return campusLabel ? `${college} (${campusLabel})` : college
}

function MetricIcon({ type }) {
  if (type === 'subjects') {
    return (
      <div className="mb-2 flex h-9 w-9 items-center justify-center">
        <img
          src="/subjects-icon.png"
          alt=""
          className="h-9 w-9 object-contain"
          aria-hidden
        />
      </div>
    )
  }

  if (type === 'preferences') {
    return (
      <div className="mb-2 flex h-9 w-9 items-center justify-center">
        <img
          src="/preferences-icon.png"
          alt=""
          className="h-9 w-9 object-contain"
          aria-hidden
        />
      </div>
    )
  }

  if (type === 'score') {
    return (
      <div className="mb-2 flex h-9 w-9 items-center justify-center">
        <img
          src="/score-icon.png"
          alt=""
          className="h-9 w-9 object-contain"
          aria-hidden
        />
      </div>
    )
  }

  if (type === 'generated-rows') {
    return (
      <div className="mb-2 flex h-9 w-9 items-center justify-center">
        <img
          src="/generated-rows-icon.png"
          alt=""
          className="h-9 w-9 object-contain"
          aria-hidden
        />
      </div>
    )
  }

  const styles = {
    trend: { ring: 'bg-[#ecfdf3]', stroke: '#16a34a' },
    list: { ring: 'bg-[#fff7ed]', stroke: '#f97316' },
  }
  const { ring, stroke } = styles[type]

  return (
    <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${ring}`}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {type === 'trend' ? (
          <>
            <path d="M4 16 9 11l4 4 7-9" />
            <path d="M15 6h5v5" />
          </>
        ) : null}
        {type === 'list' ? (
          <>
            <path d="M5 7h14M5 12h14M5 17h14" />
          </>
        ) : null}
      </svg>
    </div>
  )
}

function MetricCard({ label, value, icon }) {
  return (
    <article className="rounded-2xl border border-[#e4e7ec] bg-white px-3.5 py-3 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
      <MetricIcon type={icon} />
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-[#667085]">
        {label}
      </span>
      <strong className="block text-2xl font-semibold leading-none text-[#101828]">
        {value}
      </strong>
    </article>
  )
}

function PanelSection({ title, note, children }) {
  return (
    <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#eef2f6] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-[22px] font-semibold text-[#101828]">{title}</h3>
        {note ? <p className="text-xs text-[#98a2b3]">{note}</p> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
      {label}
      {children}
    </label>
  )
}

function SelectField({ label, value, onChange, options, required = false }) {
  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  )

  return (
    <Field label={label}>
      <CustomDropdown
        value={value}
        onChange={onChange}
        options={normalizedOptions}
        required={required}
        placeholder="Select"
      />
    </Field>
  )
}

function CustomDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select',
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef(null)
  const searchInputRef = useRef(null)
  const flatOptions = flattenOptions(options)
  const filteredOptions = filterDropdownOptions(options, searchTerm)
  const filteredFlatOptions = flattenOptions(filteredOptions)
  const selectedOption = flatOptions.find((option) => option.value === value)

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (disabled) {
      setOpen(false)
    }
  }, [disabled])

  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      return
    }

    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [open])

  function handleSelect(nextValue) {
    onChange({ target: { value: nextValue } })
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className={`relative ${open ? 'z-[90]' : 'z-10'}`}>
      <input id={id} tabIndex={-1} className="sr-only" value={value} onChange={() => {}} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`${dropdownTriggerClass} ${open ? 'border-[#98b8f8] ring-4 ring-[#3b82f6]/10' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate text-left ${selectedOption ? 'text-[#101828]' : 'text-[#98a2b3]'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className={`shrink-0 text-[#98a2b3] transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M5.5 7.5 10 12l4.5-4.5 1.5 1.5-6 6-6-6z" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className={dropdownPanelClass}>
          <div className="border-b border-[#eef2f6] p-2">
            <input
              ref={searchInputRef}
              className="w-full rounded-2xl border border-[#dbe3f0] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#bfd2ee] focus:bg-white focus:ring-4 focus:ring-[#3b82f6]/10"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {filteredOptions.map((option) =>
              option?.type === 'group' ? (
                <div key={option.label} className="mb-2 last:mb-0">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">
                    {option.label}
                  </div>
                  <div className="grid gap-1">
                    {option.options.map((item) => (
                      <DropdownOption
                        key={item.value}
                        selected={item.value === value}
                        onClick={() => handleSelect(item.value)}
                      >
                        {item.label}
                      </DropdownOption>
                    ))}
                  </div>
                </div>
              ) : (
                <DropdownOption
                  key={option.value}
                  selected={option.value === value}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </DropdownOption>
              ),
            )}
            {!flatOptions.length ? (
              <div className="px-3 py-3 text-sm text-[#98a2b3]">{placeholder}</div>
            ) : null}
            {flatOptions.length && !filteredFlatOptions.length ? (
              <div className="px-3 py-3 text-sm text-[#98a2b3]">No matching options</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DropdownOption({ children, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
        selected
          ? 'bg-[#eff6ff] font-medium text-[#2563eb]'
          : 'text-[#101828] hover:bg-[#f8fafc]'
      }`}
    >
      <span className="truncate">{children}</span>
      {selected ? <span className="ml-3 text-xs font-semibold uppercase tracking-[0.12em]">Selected</span> : null}
    </button>
  )
}

function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={secondaryIconButtonClass}
      {...props}
    >
      {children}
    </button>
  )
}

function ChanceBadge({ chance, tone }) {
  const classes = {
    safe: 'bg-emerald-100 text-emerald-700',
    match: 'bg-amber-100 text-amber-700',
    dream: 'bg-rose-100 text-rose-700',
  }

  return (
    <span
      className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${classes[tone]}`}
    >
      {chance}%
    </span>
  )
}

function CollegeCell({ college, campus }) {
  const campusLabel = getCampusLabel(college, campus)
  if (!campusLabel) return <span className="break-words">{college}</span>
  const tone =
    campusLabel === 'North Campus' ? 'text-[#0c2754]' : 'text-emerald-700'

  return (
    <span className="break-words">
      {college} <span className={`font-semibold ${tone}`}>({campusLabel})</span>
    </span>
  )
}

const inputClass =
  'w-full min-w-0 rounded-2xl border border-[#dbe3f0] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[#101828] outline-none transition focus:border-[#bfd2ee] focus:ring-4 focus:ring-[#3b82f6]/10'

const marksInputClass =
  'w-full min-w-0 rounded-2xl border border-[#dbe3f0] bg-white px-3 py-3 text-[13px] normal-case tracking-normal text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#bfd2ee] focus:ring-4 focus:ring-[#3b82f6]/10 sm:text-sm'

const dropdownTriggerClass =
  'flex min-h-[50px] w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#dbe3f0] bg-white px-4 py-3 text-sm normal-case tracking-normal text-[#101828] shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition hover:border-[#bfd2ee] hover:bg-[#fcfdff] focus:outline-none'

const dropdownPanelClass =
  'absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-[20px] border border-[#344054] bg-white shadow-[0_20px_40px_rgba(16,24,40,0.12)]'

const primaryButtonClass =
  'rounded-xl bg-[#0c2754] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.15)] transition hover:bg-[#0a2146] disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none'

const secondaryButtonClass =
  'rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-[#0c2754] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55'

const secondaryIconButtonClass =
  'rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0c2754] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55'

const softButtonClass =
  'rounded-2xl border border-[#eaecf0] bg-[#f2f4f7] px-5 py-3 text-sm font-semibold text-[#98a2b3] transition hover:bg-[#e9edf3] disabled:cursor-not-allowed disabled:opacity-55'

const chipButtonClass =
  'rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-5 py-3 text-sm font-semibold text-[#2563eb] transition hover:bg-[#dbeafe] disabled:cursor-not-allowed disabled:opacity-55'

const footerPrimaryButtonClass =
  'rounded-2xl bg-[#3b82f6] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(59,130,246,0.3)] transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-55'

const footerSecondaryButtonClass =
  'rounded-2xl bg-white/10 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/15'

export default App
