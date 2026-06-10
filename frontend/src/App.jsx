import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import duCutoffsData from '../Data/DU_cutoffs_seats.json'
import courseRequirementsData from '../Data/course_requirements.json'

import { categoryToCutoffKey, initialForm, initialSubjects } from './utils/constants'
import {
  normalizeCourseName, formatProgram, inferStream, evaluateCombinationRule,
  extractCutoffForCategory, scoreCoursePreferenceOrder,
  classifyChance, prioritizeGeneratedRows, prioritizeCourseFirstRows,
  readSubjectEntries, computeStudentScore, sanitizeFileName, loadScript, cleanCollegeName,
} from './utils/helpers'
import { footerPrimaryButtonClass, footerSecondaryButtonClass, inputClass } from './utils/styles'

import { AppShell, MetricCard, PanelSection, Field, SiteFooter } from './components/UI'
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
  const [activeSection, setActiveSection] = useState('profile')
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

  const isCourseEligible = useMemo(() => (course, subjectNames) => {
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
  }, [courseRequirementIndex])

  const availableCourses = useMemo(() => {
    return allCourses
      .filter((course) => isCourseEligible(course, selectedSubjectNames))
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

    const studentScore = computeStudentScore(subjectEntries)
    const selectedCourses = preferences.length ? preferences : streamCourses[form.stream] || []
    const categoryKey = categoryToCutoffKey[form.category] || 'UR'

    const possible = duData
      .filter((item) => selectedCourses.includes(formatProgram(item.program)))
      .filter((item) => isCourseEligible(formatProgram(item.program), subjectEntries.map((e) => e.subject)))
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
        const chance = classifyChance(studentScore, requiredCutoff)
        const diffAbs = Math.abs(studentScore - requiredCutoff)
        const prefIndex = preferences.length ? preferences.indexOf(course) : -1
        const normalizedPref = prefIndex === -1 ? 0.4 : 1 - prefIndex / Math.max(1, preferences.length)
        const collegeRank = Number(item.rank) || 100
        const collegeQuality = 1 - (Math.min(Math.max(collegeRank, 1), 100) - 1) / 99
        const smartScore = collegeQuality * 0.45 + normalizedPref * 0.25 + Math.max(0, 1 - diffAbs / 180) * 0.2 + Math.min(requiredCutoff / 1000, 1) * 0.1
        return { college: cleanCollegeName(item.college), course, requiredCutoff, studentScore, chance, smartScore, collegeRank }
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

    setTimeout(() => setActiveSection('results'), 200)
  }

  function handleReset() {
    setForm(initialForm); setSubjects(initialSubjects); setPreferences([])
    setSelectedCourse(''); setResultRows([]); setSummary('')
    setLastStudentName('student'); setLastMobileNumber(''); setExportReady(false)
    setLocked(false); setGeneratedScore('--'); setIsDirty(false)
    setActiveSection('profile')
  }

  // ── Section progress indicator ───────────────────────────────────────────────

  const steps = [
    { id: 'profile', label: 'Profile', done: profileReady },
    { id: 'subjects', label: 'Subjects', done: hasAtLeastOneSubject && !hasMarksErrors },
    { id: 'courses', label: 'Courses', done: preferences.length > 0 },
    { id: 'results', label: 'Results', done: resultRows.length > 0 },
  ]

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppShell activeSection={activeSection} onNavClick={setActiveSection}>

      {/* ── Metric cards row ── */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Subjects" value={`${selectedSubjectCount}/5`} icon="subjects" />
        <MetricCard label="Preferences" value={String(preferences.length)} icon="preferences" />
        <MetricCard label="Est. Score" value={generatedScore} icon="score" />
        <MetricCard label="Results" value={String(resultRows.length)} icon="generated-rows" />
      </section>

      {/* ── Progress stepper ── */}
      <div className="mb-6 rounded-[16px] border border-[#e4e7ec] bg-white px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-1 items-center">
            <button
              type="button"
              onClick={() => setActiveSection(step.id)}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium transition sm:px-4 sm:py-2.5 ${
                activeSection === step.id
                  ? 'bg-[#0c2754] text-white'
                  : step.done
                  ? 'text-[#16a34a]'
                  : 'text-[#98a2b3]'
              }`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                activeSection === step.id
                  ? 'bg-white/20 text-white'
                  : step.done
                  ? 'bg-[#dcfce7] text-[#16a34a]'
                  : 'bg-[#f2f4f7] text-[#98a2b3]'
              }`}>
                {step.done && activeSection !== step.id ? '✓' : i + 1}
              </span>
              <span className={activeSection === step.id ? 'inline' : 'hidden sm:inline'}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="mx-1 h-px flex-1 bg-[#e4e7ec] sm:hidden" />
            )}
          </div>
        ))}
        </div>
      </div>

      {/* ── Section: Student Profile ── */}
      {activeSection === 'profile' && (
        <div className="grid gap-5">
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setActiveSection('subjects')}
              disabled={!profileReady}
              className="w-full rounded-2xl bg-[#0c2754] px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#0a2146] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Next: Add Subjects →
            </button>
          </div>
        </div>
      )}

      {/* ── Section: CUET Subjects ── */}
      {activeSection === 'subjects' && (
        <div className="grid gap-5">
          <SubjectsSection subjects={subjects} onUpdate={updateSubject} />
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setActiveSection('profile')} className="w-full rounded-2xl border border-[#e4e7ec] bg-white px-7 py-3.5 text-base font-semibold text-[#667085] transition hover:bg-[#f2f4f7] sm:w-auto">
              ← Back
            </button>
            <button type="button" onClick={() => setActiveSection('courses')} disabled={!canBuildPreferences} className="w-full rounded-2xl bg-[#0c2754] px-7 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#0a2146] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
              Next: Select Courses →
            </button>
          </div>
        </div>
      )}

      {/* ── Section: Course Ordering ── */}
      {activeSection === 'courses' && (
        <div className="grid gap-5">
          <CourseOrderingSection
            remainingCourses={remainingCourses}
            selectedCourse={selectedCourse}
            onCourseChange={setSelectedCourse}
            locked={locked}
            statusMessage={statusMessage}
            selectedSubjectNames={selectedSubjectNames}
            preferences={preferences}
            onAdd={() => { if (selectedCourse) { setPreferences((c) => [...c, selectedCourse]); setIsDirty(resultRows.length > 0) } }}
            onMoveUp={(i) => { setPreferences((c) => { const n = [...c]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n }); setIsDirty(resultRows.length > 0) }}
            onMoveDown={(i) => { setPreferences((c) => { const n = [...c]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n }); setIsDirty(resultRows.length > 0) }}
            onRemove={(i) => { setPreferences((c) => c.filter((_, idx) => idx !== i)); setIsDirty(resultRows.length > 0) }}
            canBuildPreferences={canBuildPreferences}
          />

          {/* Generate CTA */}
          <div className="rounded-[20px] bg-[#101828] px-6 py-6 text-white shadow-[0_12px_32px_rgba(16,24,40,0.16)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xl font-semibold sm:text-2xl">Ready to generate?</p>
                <p className="mt-1 text-sm text-white/60 sm:text-base">Make sure all subject marks are entered correctly.</p>
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

          <div className="flex justify-start">
            <button type="button" onClick={() => setActiveSection('subjects')} className="w-full rounded-2xl border border-[#e4e7ec] bg-white px-7 py-3.5 text-base font-semibold text-[#667085] transition hover:bg-[#f2f4f7] sm:w-auto">
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* ── Section: Results ── */}
      {activeSection === 'results' && (
        <div className="grid gap-5">
          {isDirty && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-medium text-amber-700">
              <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 fill-current" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-5a1 1 0 00-1 1v2a1 1 0 002 0V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              You have unsaved changes. Go to <button type="button" onClick={() => setActiveSection('courses')} className="mx-1 font-bold underline">Courses</button> and click <strong className="mx-1">Generate Sheet</strong> to update results.
            </div>
          )}

          {!resultRows.length && !summary ? (
            <div className="rounded-[20px] border border-dashed border-[#dbe3f0] bg-white px-6 py-20 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f5fb] text-3xl text-[#c7d2e6]">≋</div>
              <p className="text-lg font-medium text-[#101828]">No results yet</p>
              <p className="mt-2 text-base text-[#98a2b3]">Complete all steps and click Generate Sheet to see your preference list.</p>
              <button type="button" onClick={() => setActiveSection('profile')} className="mt-6 rounded-2xl bg-[#0c2754] px-7 py-3.5 text-base font-semibold text-white transition hover:bg-[#0a2146]">
                Start from Profile →
              </button>
            </div>
          ) : (
            <ResultsSection
              resultRows={resultRows}
              setResultRows={setResultRows}
              summary={summary}
              exportReady={exportReady}
              studentName={lastStudentName}
              isDirty={false}
              onRegenerateClick={() => setActiveSection('courses')}
            />
          )}
        </div>
      )}

      <SiteFooter />
    </AppShell>
  )
}

export default App
