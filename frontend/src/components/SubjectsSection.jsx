import { useState } from 'react'
import { languages, domainSubjects, generalTests } from '../utils/constants'
import { CustomDropdown } from './CustomDropdown'
import { PanelSection } from './UI'

const baseInputClass =
  'w-full min-w-0 rounded-2xl border px-3 py-3 text-[13px] normal-case tracking-normal text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:ring-4 sm:text-sm'

const validInputClass = `${baseInputClass} border-[#dbe3f0] bg-white focus:border-[#bfd2ee] focus:ring-[#3b82f6]/10`
const errorInputClass = `${baseInputClass} border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-100`

export function SubjectsSection({ subjects, onUpdate }) {
  // only show missing-marks error after user has left that entire row
  const [rowTouched, setRowTouched] = useState(() => Array(5).fill(false))

  function handleRowBlur(index, e) {
    // relatedTarget is the element receiving focus next
    // if it's still inside the same row div, don't mark as touched yet
    const row = e.currentTarget
    if (row.contains(e.relatedTarget)) return
    setRowTouched((prev) => {
      const next = [...prev]
      next[index] = true
      return next
    })
  }

  function handleSubjectChange(index, value) {
    onUpdate(index, 'subject', value)
    // reset touched when subject changes so error doesn't flash on re-selection
    setRowTouched((prev) => {
      const next = [...prev]
      next[index] = false
      return next
    })
  }

  return (
    <PanelSection
      title="CUET Subjects"
      note="Select at least 1 subject with marks. If a subject is selected, marks are required. Max 250 per subject."
    >
      <div className="grid gap-0 rounded-[20px] border border-[#eef2f6]">
        {subjects.map((item, index) => {
          const selectedElsewhere = subjects
            .map((s, i) => (i === index ? '' : s.subject))
            .filter(Boolean)

          const marksNum = Number(item.marks)
          const marksAboveMax = item.marks !== '' && marksNum > 250
          const marksMissing = item.subject && item.marks === '' && rowTouched[index]
          const marksHasError = marksAboveMax || marksMissing

          return (
            <div
              key={item.label}
              className="grid items-center gap-3 border-b border-[#eef2f6] bg-white px-3 py-3 last:border-b-0 sm:px-4 lg:grid-cols-[70px_minmax(0,1fr)_minmax(150px,200px)]"
              onBlur={(e) => handleRowBlur(index, e)}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                S - 0{index + 1}
              </span>

              <label className="sr-only" htmlFor={`subject-${index + 1}`}>{item.label}</label>
              <CustomDropdown
                id={`subject-${index + 1}`}
                placeholder={index === 0 ? 'Select subject (Required*)' : 'Select subject'}
                required={index === 0}
                value={item.subject}
                onChange={(e) => handleSubjectChange(index, e.target.value)}
                options={[
                  {
                    type: 'group', label: 'Languages',
                    options: languages
                      .filter((s) => s === item.subject || !selectedElsewhere.includes(s))
                      .map((s) => ({ label: s, value: s })),
                  },
                  {
                    type: 'group', label: 'Domain Subjects',
                    options: domainSubjects
                      .filter((s) => s === item.subject || !selectedElsewhere.includes(s))
                      .map((s) => ({ label: s, value: s })),
                  },
                  {
                    type: 'group', label: 'General Tests',
                    options: generalTests
                      .filter((s) => s === item.subject || !selectedElsewhere.includes(s))
                      .map((s) => ({ label: s, value: s })),
                  },
                ]}
              />

              <div className="grid gap-1">
                <input
                  className={marksHasError ? errorInputClass : validInputClass}
                  type="number"
                  min="0"
                  max="250"
                  placeholder="Marks (0-250)"
                  value={item.marks}
                  onChange={(e) => onUpdate(index, 'marks', e.target.value)}
                />
                {marksAboveMax && (
                  <p className="text-[11px] font-medium text-red-500">Max marks is 250</p>
                )}
                {marksMissing && (
                  <p className="text-[11px] font-medium text-red-500">Marks required for this subject</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PanelSection>
  )
}
