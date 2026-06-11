import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import duCutoffsData from '../Data/DU_cutoffs_seats.json'
import courseRequirementsData from '../Data/course_requirements.json'

import { categoryToCutoffKey, initialForm, initialSubjects } from './utils/constants'
import {
  normalizeCourseName, formatProgram, inferStream, evaluateCombinationRule,
  extractCutoffForCategory, scoreCoursePreferenceOrder,
  classifyChance, prioritizeGeneratedRows, prioritizeCourseFirstRows,
  readSubjectEntries, sanitizeFileName, loadScript, cleanCollegeName,
} from './utils/helpers'
import { footerPrimaryButtonClass, footerSecondaryButtonClass, inputClass } from './utils/styles'
import { computeSmartScore, getScoreBreakdown } from './utils/scoreEngine'

import { MetricCard, PanelSection, Field, SiteFooter, SiteHeader } from './components/UI'
import { SelectField } from './components/CustomDropdown'
import { SubjectsSection } from './components/SubjectsSection'
import { CourseOrderingSection } from './components/CourseOrderingSection'
import { ResultsSection } from './components/ResultsSection'
import { supabase } from './utils/supabase'

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
  const [generatedScore, setGeneratedScore] = useState('--')
  const [isDirty, setIsDirty] = useState(false)
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

  const isCourseEligible = useMemo(() => (course) => {
    const validSubjects = subjects
      .filter((s) => s.subject)
      .map((s) => ({ subject: s.subject, marks: Number(s.marks) || 0 }))
      
    if (!validSubjects.length) return false
    if (!courseRequirements.length) return true

    const breakdown = getScoreBreakdown(validSubjects, course, courseRequirements)
    return breakdown.isEligible
  }, [subjects, courseRequirements])

  const availableCourses = useMemo(() => {
    return allCourses
      .filter((course) => isCourseEligible(course))
      .sort((a, b) => {
        const diff = scoreCoursePreferenceOrder(b, selectedSubjectNames) - scoreCoursePreferenceOrder(a, selectedSubjectNames)
        return diff !== 0 ? diff : a.localeCompare(b)
      })
  }, [allCourses, selectedSubjectNames, isCourseEligible])

  const remainingCourses = availableCourses.filter((c) => !preferences.includes(c))

  const selectedSubjectCount = selectedSubjectNames.length
  const profileReady = Boolean(form.name.trim()) && Boolean(form.gender) && Boolean(form.category) && Boolean(form.stream)
  const canBuildPreferences = profileReady && selectedSubjectCount > 0
  const hasMarksErrors = subjects.some(
    (s) => (s.subject && s.marks === '') || (s.marks !== '' && Number(s.marks) > 250)
  )
  const hasAtLeastOneSubject = subjects.some((s) => s.subject && s.marks !== '')
  const canGenerate = canBuildPreferences && preferences.length > 0 && !hasMarksErrors && hasAtLeastOneSubject

  // ── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setPreferences((prev) => {
      const next = prev.filter((c) => availableCourses.includes(c))
      const remaining = availableCourses.filter((c) => !next.includes(c))
      setSelectedCourse((current) => (
        current && remaining.includes(current) ? current : remaining[0] || ''
      ))
      return next
    })
  }, [availableCourses])

  useEffect(() => { mobileRef.current = lastMobileNumber }, [lastMobileNumber])

  useEffect(() => {
    async function init() {
      try {
        await Promise.allSettled([
          loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js'),
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
    if (field === 'stream') { setPreferences([]); setResultRows([]); setSummary(''); setExportReady(false); setLocked(false); setIsDirty(false) }
    else { setIsDirty((d) => resultRows.length > 0 ? true : d) }
  }

  function updateSubject(index, field, value) {
    setSubjects((current) => {
      const next = current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      return next
    })
    setLocked(false)
    setIsDirty((d) => resultRows.length > 0 ? true : d)
  }

  function handleGenerate(event) {
    if (event) event.preventDefault()
    let subjectEntries
    try { subjectEntries = readSubjectEntries(subjects) }
    catch (err) { window.alert(err.message); return }

    if (!form.stream) { window.alert('Please select a stream first.'); return }
    if (!duData.length || !courseRequirements.length) { window.alert('Final generation needs the DU cutoff and course requirement datasets.'); return }

    const selectedCourses = preferences.length ? preferences : streamCourses[form.stream] || []
    const categoryKey = categoryToCutoffKey[form.category] || 'UR'

    // Check if student has required subjects for each preference
    const ineligibleCourses = preferences.filter(
      (course) => !isCourseEligible(course)
    )
    if (ineligibleCourses.length > 0) {
      const list = ineligibleCourses.map((c) => `• ${c}`).join('\n')
      const proceed = window.confirm(
        `You do not have the required subjects for the following course(s):\n\n${list}\n\nThese will be skipped. Continue?`
      )
      if (!proceed) return
    }

    // Per-course smart score: compulsory locking + best-subject auto-selection
    const courseScoreCache = {}
    const getCourseScore = (course) => {
      if (courseScoreCache[course] === undefined) {
        courseScoreCache[course] = computeSmartScore(subjectEntries, course, courseRequirements)
      }
      return courseScoreCache[course]
    }
    // Flat fallback (no specific course) — used for display header & Supabase log
    const studentScore = computeSmartScore(subjectEntries)

    const possible = duData
      .filter((item) => selectedCourses.includes(formatProgram(item.program)))
      .filter((item) => isCourseEligible(formatProgram(item.program)))
      .filter((item) => {
        const g = String(item.gender || '').toLowerCase()
        const isMale = String(form.gender || '').toLowerCase() === 'male'
        const isFemale = String(form.gender || '').toLowerCase() === 'female'
        if (isMale) return g.includes('co-ed') || g === ''
        if (isFemale) return g.includes('co-ed') || g.includes('female') || g.includes('girls') || g === ''
        return true
      })
      .map((item) => {
        const requiredCutoff = extractCutoffForCategory(item.cutoffs, categoryKey)
        if (requiredCutoff === null) return null
        const course = formatProgram(item.program)
        const courseSmartScore = getCourseScore(course)
        const chance = classifyChance(courseSmartScore, requiredCutoff)
        const diffAbs = Math.abs(courseSmartScore - requiredCutoff)
        const prefIndex = preferences.length ? preferences.indexOf(course) : -1
        const normalizedPref = prefIndex === -1 ? 0.4 : 1 - prefIndex / Math.max(1, preferences.length)
        const collegeRank = Number(item.rank) || 100
        const collegeQuality = 1 - (Math.min(Math.max(collegeRank, 1), 100) - 1) / 99
        const smartScore = collegeQuality * 0.45 + normalizedPref * 0.25 + Math.max(0, 1 - diffAbs / 180) * 0.2 + Math.min(requiredCutoff / 1000, 1) * 0.1
        return { college: cleanCollegeName(item.college), course, requiredCutoff, studentScore: courseSmartScore, chance, smartScore, collegeRank }
      })
      .filter(Boolean)
      .sort((a, b) => b.smartScore - a.smartScore || a.collegeRank - b.collegeRank || b.requiredCutoff - a.requiredCutoff || a.college.localeCompare(b.college))

    const orderedPossible = form.displayMode === 'course-first'
      ? prioritizeCourseFirstRows(possible, selectedCourses)
      : prioritizeGeneratedRows(possible)

    setGeneratedScore(`${studentScore}/1000`)
    setSummary(`${form.name} | Stream: ${form.stream} | Category: ${form.category} | Results: ${form.displayMode === 'course-first' ? 'Course First' : 'College First'} | Estimated CUET Score: ${studentScore}/1000`)
    setLastStudentName(form.name || 'student')
    setExportReady(orderedPossible.length > 0)
    setResultRows(orderedPossible)
    setIsDirty(false)

    // Save student details to Supabase
    if (supabase) {
      supabase.from('student_details').insert([{
        name: form.name || null,
        roll_number: form.rollNumber || null,
        gender: form.gender || null,
        category: form.category || null,
        stream: form.stream || null,
        display_mode: form.displayMode || null,
        estimated_score: studentScore,
        subjects: subjects.filter(s => s.subject && s.marks !== '').map(s => ({ subject: s.subject, marks: Number(s.marks) })),
        preferences: preferences.length ? preferences : null,
        created_at: new Date().toISOString(),
      }]).then(({ error }) => {
        if (error) console.error('Supabase student_details insert error:', error)
      })
    }
    
    // Auto-scroll to results logic
    setTimeout(() => {
      const resultsSection = document.getElementById('results-section')
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth' })
      }
    }, 100)
  }

  function handleReset() {
    setForm(initialForm); setSubjects(initialSubjects); setPreferences([])
    setSelectedCourse(''); setResultRows([]); setSummary('')
    setLastStudentName('student'); setLastMobileNumber(''); setExportReady(false)
    setLocked(false); setGeneratedScore('--'); setIsDirty(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-[1100px] space-y-8">
        <SiteHeader />

        {/* ── Metric cards row ── */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Subjects" value={`${selectedSubjectCount}/5`} icon="subjects" />
          <MetricCard label="Preferences" value={String(preferences.length)} icon="preferences" />
          <MetricCard label="Est. Score" value={generatedScore} icon="score" />
          <MetricCard label="Results" value={String(resultRows.length)} icon="generated-rows" />
        </section>

        <div className="grid gap-8">
          {/* ── Section: Student Profile ── */}
          <PanelSection title="Student Details" note="Personalises your course recommendations">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
                Student Name
                <input
                  className={inputClass}
                  required
                  placeholder="Enter full name"
                  value={form.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
                CUET Roll Number
                <input
                  className={inputClass}
                  placeholder="Enter CUET roll number"
                  value={form.rollNumber}
                  onChange={(e) => updateFormField('rollNumber', e.target.value)}
                />
              </label>
              <SelectField label="Gender" value={form.gender} onChange={(e) => updateFormField('gender', e.target.value)} required options={['Male', 'Female', 'Other']} />
              <SelectField label="Category" value={form.category} onChange={(e) => updateFormField('category', e.target.value)} required options={['GEN', 'OBC', 'EWS', 'SC', 'ST', 'PWD']} />
              <SelectField label="Stream" value={form.stream} onChange={(e) => updateFormField('stream', e.target.value)} required options={['Humanities', 'Commerce', 'Science']} />
              <SelectField label="Show Results As" value={form.displayMode} onChange={(e) => updateFormField('displayMode', e.target.value)} options={[{ label: 'College First', value: 'college-first' }, { label: 'Course First', value: 'course-first' }]} />
            </div>
          </PanelSection>

          {/* ── Section: CUET Subjects ── */}
          <SubjectsSection subjects={subjects} onUpdate={updateSubject} />

          {/* ── Section: Course Ordering ── */}
          <CourseOrderingSection
            remainingCourses={remainingCourses}
            selectedCourse={selectedCourse}
            onCourseChange={setSelectedCourse}
            locked={locked}
            statusMessage={statusMessage}
            selectedSubjectNames={selectedSubjectNames}
            preferences={preferences}
            onAdd={() => { if (selectedCourse) { setPreferences((c) => [...c, selectedCourse]); setIsDirty(resultRows.length > 0) } }}
            onAddManual={(courseName) => { if (courseName && !preferences.includes(courseName)) { setPreferences((c) => [...c, courseName]); setIsDirty(resultRows.length > 0) } }}
            onMoveUp={(i) => { setPreferences((c) => { const n = [...c]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n }); setIsDirty(resultRows.length > 0) }}
            onMoveDown={(i) => { setPreferences((c) => { const n = [...c]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n }); setIsDirty(resultRows.length > 0) }}
            onRemove={(i) => { setPreferences((c) => c.filter((_, idx) => idx !== i)); setIsDirty(resultRows.length > 0) }}
            canBuildPreferences={canBuildPreferences}
          />

          {/* Generate CTA */}
          <div className="rounded-[16px] bg-[#101828] px-5 py-5 text-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold sm:text-xl">Ready to generate?</p>
                <p className="mt-1 text-xs text-white/60 sm:text-sm">Make sure all subject marks are entered correctly.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={handleGenerate} className={`${footerPrimaryButtonClass} w-full sm:w-auto`} disabled={!canGenerate}>
                  Generate Sheet
                </button>
                <button type="button" className={`${footerSecondaryButtonClass} w-full sm:w-auto`} onClick={handleReset}>
                  Reset All
                </button>
              </div>
            </div>
          </div>

          {/* ── Section: Results ── */}
          <div id="results-section" className="grid gap-5">
            {isDirty && (
              <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-medium text-amber-700">
                <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-5a1 1 0 00-1 1v2a1 1 0 002 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                You have unsaved changes. Click <strong className="mx-1">Generate Sheet</strong> to update results.
              </div>
            )}

            {!resultRows.length && !summary ? (
              <div className="rounded-[16px] border border-dashed border-[#dbe3f0] bg-white px-5 py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f5fb] text-2xl text-[#c7d2e6]">≋</div>
                <p className="text-base font-medium text-[#101828]">No results yet</p>
                <p className="mt-1.5 text-sm text-[#98a2b3]">Complete all steps and click Generate Sheet to see your preference list.</p>
              </div>
            ) : (
              <ResultsSection
                resultRows={resultRows}
                setResultRows={setResultRows}
                summary={summary}
                exportReady={exportReady}
                studentName={lastStudentName}
                isDirty={false}
                onRegenerateClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
