import { useState } from 'react'
import { CustomDropdown } from './CustomDropdown'
import { IconButton, PanelSection } from './UI'
import { addToListButtonClass, inputClass } from '../utils/styles'

export function CourseOrderingSection({
  remainingCourses, selectedCourse, onCourseChange,
  locked, statusMessage, selectedSubjectNames,
  preferences, onAdd, onMoveUp, onMoveDown, onRemove,
  canBuildPreferences, onAddManual
}) {
  const [manualCourse, setManualCourse] = useState('')

  return (
    <PanelSection title="Course Selection & Ordering" note="Complete Student Details and select your subjects — eligible courses appear automatically.">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <CustomDropdown
          value={selectedCourse}
          onChange={(e) => onCourseChange(e.target.value)}
          disabled={!canBuildPreferences || locked || !remainingCourses.length}
          placeholder={!canBuildPreferences ? 'Complete Student Details first' : selectedSubjectNames.length ? 'No more eligible courses available' : statusMessage}
          options={remainingCourses.map((c) => ({ label: c, value: c }))}
        />
        <button
          type="button"
          className={addToListButtonClass}
          disabled={!canBuildPreferences || !selectedCourse || locked}
          onClick={onAdd}
        >
          Add To List
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] items-center border-t border-[#e4e7ec] pt-3">
        <input
          type="text"
          className={inputClass}
          placeholder="Can't find a course? Type it manually..."
          value={manualCourse}
          onChange={(e) => setManualCourse(e.target.value)}
          disabled={!canBuildPreferences || locked}
        />
        <button
          type="button"
          className={addToListButtonClass}
          disabled={!canBuildPreferences || locked || !manualCourse.trim()}
          onClick={() => {
            onAddManual(manualCourse.trim())
            setManualCourse('')
          }}
        >
          Add Manually
        </button>
      </div>

      <ul className="mt-4 grid gap-2">
        {preferences.length ? (
          <>
            <li className="flex items-center gap-2 rounded-2xl bg-[#f0f5ff] px-4 py-2.5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-[#0c2754] stroke-2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
              </svg>
              <p className="text-xs font-medium text-[#0c2754]">Use the <strong>↑ ↓</strong> arrows to rearrange your course preference order. Higher = more preferred.</p>
            </li>
            {preferences.map((course, index) => (
            <li
              key={`${course}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#e4e7ec] bg-[#fcfcfd] p-3"
            >
              <strong className="flex min-w-10 items-center justify-center rounded-xl bg-[#e8f1ff] px-2.5 py-2 text-sm font-bold text-[#2563eb]">
                #{index + 1}
              </strong>
              <span className="min-w-0 flex-1 self-center text-sm font-medium text-[#101828]">{course}</span>
              <div className="flex gap-1 shrink-0">
                <IconButton label="Move up" disabled={index === 0} onClick={() => onMoveUp(index)}>↑</IconButton>
                <IconButton label="Move down" disabled={index === preferences.length - 1} onClick={() => onMoveDown(index)}>↓</IconButton>
                <IconButton label="Remove preference" onClick={() => onRemove(index)}>×</IconButton>
              </div>
            </li>
            ))}
          </>
        ) : (
          <li className="rounded-[24px] border border-dashed border-[#dbe3f0] bg-[#fcfdff] px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f5fb] text-2xl text-[#c7d2e6]">≋</div>
            <p className="text-base font-medium text-[#101828]">No courses selected yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#98a2b3]">
              {canBuildPreferences
                ? 'Add your CUET subjects and marks to see personalised course recommendations based on last year cut-offs.'
                : 'Complete Student Details and select at least one subject to unlock course suggestions.'}
            </p>
          </li>
        )}
      </ul>
    </PanelSection>
  )
}
