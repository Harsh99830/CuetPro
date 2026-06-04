import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import duCutoffsData from '../Data/DU_cutoffs_seats.json'
import courseRequirementsData from '../Data/course_requirements.json'

import { categoryToCutoffKey, initialForm, initialSubjects } from './utils/constants'
import {
  normalizeCourseName, formatProgram, inferStream, evaluateCombinationRule,
  isProgramAllowedForGender, extractCutoffForCategory, scoreCoursePreferenceOrder,
  classifyChance, matchesCampusPreference, prioritizeGeneratedRows, prioritizeCourseFirstRows,
  readSubjectEntries, computeStudentScore, formatCollegeDisplay, sanitizeFileName, loadScript,
} from './utils/helpers'
import { footerPrimaryButtonClass, footerSecondaryButtonClass, inputClass } from './utils/styles'

import { SiteHeader, MetricCard, PanelSection, Field, WhatsAppButton, SiteFooter } from './components/UI'
import { SelectField } from './components/CustomDropdown'
import { SubjectsSection } from './components/SubjectsSection'
import { CourseOrderingSection } from './components/CourseOrderingSection'
import { ResultsSection } from './components/ResultsSection'

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
  const [lastStudentName, setLastStudentName] = useState('student')
  const [lastMobileNumber, setLastMobileNumber] = useState('')
  const [exportReady, setExportReady] = useState(false)
  const mobileRef = useRef('')

  // ── Derived data ────────────────────────────────────────────────────────────

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
    () => Array.from(new Set([...streamCourses.Humanities, ...streamCourses.Commerce, ...streamCourses.Science])).sort(),
    [streamCourses],
  )

  function isCourseEligible(course, subjectNames) {
    if (!subjectNames.length) return false
    if (!courseRequirementIndex.size) return true
    const eligibility = courseRequirementIndex.get(normalizeCourseName(course))
    if (!eligibility) return false
    const segments = String(eligibility).replace(/\s+/g, ' ').trim()
      .split(/\s+OR\s+/i)
      .map((seg) => seg.replace(/Combination\s+[IVX0-9]+:?\s*/gi, '').trim())
      .filter(Boolean)
    if (!segments.length) return false
    return segments.some((seg) => evaluateCombinationRule(seg, subjectNames))
  }

  const availableCourses = useMemo(() => {
    const base = form.stream && streamCourses[form.stream]?.length ? streamCourses[form.stream] : allCourses
    return base
      .filter((course) => isCourseEligible(course, selectedSubjectNames))
      .sort((a, b) => {
        const diff = scoreCoursePreferenceOrder(b, selectedSubjectNames) - scoreCoursePreferenceOrder(a, selectedSubjectNames)
        return diff !== 0 ? diff : a.localeCompare(b)
      })
  }, [allCourses, form.stream, selectedSubjectNames, streamCourses, courseRequirementIndex])

  const remainingCourses = availableCourses.filter((c) => !preferences.includes(c))

  const selectedSubjectCount = selectedSubjectNames.length
  const profileReady = Boolean(form.name.trim()) && Boolean(form.gender) && Boolean(form.category) && Boolean(form.stream)
  const canBuildPreferences = profileReady && selectedSubjectCount > 0
  const canGenerate = canBuildPreferences && preferences.length > 0

  const estimatedScore = useMemo(() => {
    try { return `${computeStudentScore(readSubjectEntries(subjects))}/1000` }
    catch { return '--' }
  }, [subjects])

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const nextAvailable = availableCourses.filter((c) => !preferences.includes(c))
    setSelectedCourse((current) => (current && nextAvailable.includes(current) ? current : nextAvailable[0] || ''))
  }, [availableCourses, preferences])

  useEffect(() => { mobileRef.current = lastMobileNumber }, [lastMobileNumber])

  useEffect(() => {
    async function init() {
      try {
        await Promise.allSettled([
          loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'),
        ])
        const requirementData = Array.isArray(courseRequirementsData) ? courseRequirementsData : null
        const cutoffData = Array.isArray(duCutoffsData) ? duCutoffsData : null
        if (requirementData) setCourseRequirements(requirementData)
        if (cutoffData) setDuData(cutoffData)
        setStatusMessage(!requirementData || !cutoffData ? 'Data load failed' : 'Ready')
      } finally {
        setLocked(false)
      }
    }
    init()
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function updateFormField(field, value) {
    setForm((c) => ({ ...c, [field]: value }))
    if (field === 'stream') { setPreferences([]); setResultRows([]); setSummary(''); setExportReady(false); setLocked(false) }
  }

  function updateSubject(index, field, value) {
    setSubjects((current) => {
      const next = current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      if (field === 'subject') {
        const valid = next.map((item) => item.subject).filter(Boolean)
        setPreferences((existing) => existing.filter((c) => isCourseEligible(c, valid)))
      }
      return next
    })
    setLocked(false)
  }

  function requestMobileNumber() {
    const input = window.prompt('Enter your mobile number to continue with the download.', mobileRef.current)
    if (input === null) return null
    const num = input.trim()
    if (!/^\d{10}$/.test(num)) { window.alert('Please enter a valid 10-digit mobile number.'); return null }
    setLastMobileNumber(num)
    return num
  }

  function exportToExcel() {
    if (!resultRows.length || !window.XLSX || !requestMobileNumber()) return
    const sheetRows = resultRows.map((row, idx) => ({
      'Preference No.': idx + 1,
      College: formatCollegeDisplay(row.college, row.campus),
      Course: row.course,
      'Required Cutoff': Number(row.requiredCutoff.toFixed(2)),
      Chance: `${row.chance}%`,
    }))
    const ws = window.XLSX.utils.json_to_sheet(sheetRows)
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'Preferences')
    window.XLSX.writeFile(wb, `${sanitizeFileName(lastStudentName)}_du_preference_sheet.xlsx`)
  }

  function exportToPdf() {
    if (!resultRows.length || !window.jspdf?.jsPDF || !requestMobileNumber()) return
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFontSize(12); doc.text('DU Preference Sheet', 40, 32)
    doc.setFontSize(10); doc.text(summary, 40, 50)
    doc.autoTable({
      head: [['Preference No.', 'College', 'Course', 'Required Cutoff', 'Chance']],
      body: resultRows.map((row, idx) => [idx + 1, formatCollegeDisplay(row.college, row.campus), row.course, row.requiredCutoff.toFixed(2), `${row.chance}%`]),
      startY: 64, styles: { fontSize: 8 },
    })
    doc.save(`${sanitizeFileName(lastStudentName)}_du_preference_sheet.pdf`)
  }

  function handleGenerate(event) {
    event.preventDefault()
    let subjectEntries
    try { subjectEntries = readSubjectEntries(subjects) }
    catch (err) { window.alert(err.message); return }

    if (!form.stream) { window.alert('Please select a stream first.'); return }
    if (!duData.length || !courseRequirements.length) { window.alert('Final generation needs the DU cutoff and course requirement datasets.'); return }

    const studentScore = computeStudentScore(subjectEntries)
    const selectedCourses = preferences.length ? preferences : streamCourses[form.stream] || []
    const categoryKey = categoryToCutoffKey[form.category] || 'UR'

    const possible = duData
      .filter((item) => selectedCourses.includes(formatProgram(item.program)))
      .filter((item) => isCourseEligible(formatProgram(item.program), subjectEntries.map((e) => e.subject)))
      .filter((item) => isProgramAllowedForGender(item.gender, form.gender))
      .filter((item) => matchesCampusPreference(item.college, item.campus, form.campusPreference))
      .map((item) => {
        const requiredCutoff = extractCutoffForCategory(item.cutoffs, categoryKey)
        if (requiredCutoff === null) return null
        const course = formatProgram(item.program)
        const chance = classifyChance(studentScore, requiredCutoff)
        const diffAbs = Math.abs(studentScore - requiredCutoff)
        const prefIndex = preferences.length ? preferences.indexOf(course) : -1
        const normalizedPref = prefIndex === -1 ? 0.4 : 1 - prefIndex / Math.max(1, preferences.length)
        const collegeRank = Number(item.rank) || 100
        const collegeQuality = 1 - (Math.min(Math.max(collegeRank, 1), 100) - 1) / 99
        const smartScore = collegeQuality * 0.45 + normalizedPref * 0.25 + Math.max(0, 1 - diffAbs / 180) * 0.2 + Math.min(requiredCutoff / 800, 1) * 0.1
        return { college: item.college, campus: item.campus, course, requiredCutoff, studentScore, chance, smartScore, collegeRank }
      })
      .filter(Boolean)
      .sort((a, b) => b.smartScore - a.smartScore || a.collegeRank - b.collegeRank || b.requiredCutoff - a.requiredCutoff || a.college.localeCompare(b.college))

    const orderedPossible = form.displayMode === 'course-first'
      ? prioritizeCourseFirstRows(possible, selectedCourses)
      : prioritizeGeneratedRows(possible)

    const campusLabel = form.campusPreference === 'both' ? 'Both' : `${form.campusPreference.charAt(0).toUpperCase()}${form.campusPreference.slice(1)}`
    setSummary(`${form.name} | Stream: ${form.stream} | Category: ${form.category} | Results: ${form.displayMode === 'course-first' ? 'Course First' : 'College First'} | Campus: ${campusLabel} | Estimated CUET Score: ${studentScore}/1000`)
    setLastStudentName(form.name || 'student')
    setExportReady(orderedPossible.length > 0)
    setLocked(orderedPossible.length > 0)
    setResultRows(orderedPossible)
  }

  function handleReset() {
    setForm(initialForm); setSubjects(initialSubjects); setPreferences([])
    setSelectedCourse(''); setResultRows([]); setSummary('')
    setLastStudentName('student'); setLastMobileNumber(''); setExportReady(false); setLocked(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f5f7fa] px-3 py-6 text-[#101828] sm:px-4 sm:py-8 lg:px-6">
      <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6">

        <SiteHeader />

        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Subjects" value={`${selectedSubjectCount}/5`} icon="subjects" />
          <MetricCard label="Preferences" value={String(preferences.length)} icon="preferences" />
          <MetricCard label="Estimated Score" value={estimatedScore} icon="score" />
          <MetricCard label="Generated Rows" value={String(resultRows.length)} icon="generated-rows" />
        </section>

        <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.05)]">
          <form className="grid gap-6 p-5 sm:p-6" onSubmit={handleGenerate}>

            <PanelSection title="Student Details" note="This data personalises your course recommendations">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
                  Student Name
                  <input className={inputClass} required placeholder="Enter full name" value={form.name} onChange={(e) => updateFormField('name', e.target.value)} />
                </label>
                <SelectField label="Gender" value={form.gender} onChange={(e) => updateFormField('gender', e.target.value)} required options={['Male', 'Female', 'Other']} />
                <SelectField label="Category" value={form.category} onChange={(e) => updateFormField('category', e.target.value)} required options={['GEN', 'OBC', 'EWS', 'SC', 'ST', 'PWD']} />
                <SelectField label="Stream" value={form.stream} onChange={(e) => updateFormField('stream', e.target.value)} required options={['Humanities', 'Commerce', 'Science']} />
                <SelectField label="Show Results As" value={form.displayMode} onChange={(e) => updateFormField('displayMode', e.target.value)} options={[{ label: 'College First', value: 'college-first' }, { label: 'Course First', value: 'course-first' }]} />
                <SelectField label="Campus Preference" value={form.campusPreference} onChange={(e) => updateFormField('campusPreference', e.target.value)} options={[{ label: 'Both', value: 'both' }, { label: 'North', value: 'north' }, { label: 'South', value: 'south' }]} />
              </div>
            </PanelSection>

            <SubjectsSection subjects={subjects} onUpdate={updateSubject} />

            <CourseOrderingSection
              remainingCourses={remainingCourses}
              selectedCourse={selectedCourse}
              onCourseChange={setSelectedCourse}
              locked={locked}
              statusMessage={statusMessage}
              selectedSubjectNames={selectedSubjectNames}
              preferences={preferences}
              onAdd={() => { if (selectedCourse) setPreferences((c) => [...c, selectedCourse]) }}
              onMoveUp={(i) => setPreferences((c) => { const n = [...c]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n })}
              onMoveDown={(i) => setPreferences((c) => { const n = [...c]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n })}
              onRemove={(i) => setPreferences((c) => c.filter((_, idx) => idx !== i))}
              canBuildPreferences={canBuildPreferences}
            />

            <div className="rounded-[24px] bg-[#101828] px-5 py-5 text-white shadow-[0_18px_36px_rgba(16,24,40,0.18)] sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-2xl font-semibold">Ready to generate?</p>
                  <p className="mt-1 text-sm text-white/70">Please ensure all subject marks are entered correctly.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className={footerPrimaryButtonClass} disabled={!canGenerate}>Generate Sheet</button>
                  <button type="button" className={footerSecondaryButtonClass} onClick={handleReset}>Reset All</button>
                </div>
              </div>
            </div>

          </form>
        </section>

        <ResultsSection
          resultRows={resultRows}
          setResultRows={setResultRows}
          summary={summary}
          exportReady={exportReady}
          onExcelExport={exportToExcel}
          onPdfExport={exportToPdf}
        />

        <WhatsAppButton />
        <SiteFooter />

      </div>
    </main>
  )
}

export default App
