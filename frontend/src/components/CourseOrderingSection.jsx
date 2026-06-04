import { CustomDropdown } from './CustomDropdown'
import { IconButton, PanelSection } from './UI'
import { addToListButtonClass } from '../utils/styles'

export function CourseOrderingSection({
  remainingCourses, selectedCourse, onCourseChange,
  locked, statusMessage, selectedSubjectNames,
  preferences, onAdd, onMoveUp, onMoveDown, onRemove,
  canBuildPreferences,
}) {
  return (
    <PanelSection title="Course Selection & Ordering" note="Search & select course">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <CustomDropdown
          value={selectedCourse}
          onChange={(e) => onCourseChange(e.target.value)}
          disabled={locked || !remainingCourses.length}
          placeholder={selectedSubjectNames.length ? 'No more eligible courses available' : statusMessage}
          options={remainingCourses.map((c) => ({ label: c, value: c }))}
        />
        <button
          type="button"
          className={addToListButtonClass}
          disabled={!selectedCourse || locked}
          onClick={onAdd}
        >
          Add To List
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
              <IconButton label="Move up" disabled={index === 0} onClick={() => onMoveUp(index)}>↑</IconButton>
              <IconButton label="Move down" disabled={index === preferences.length - 1} onClick={() => onMoveDown(index)}>↓</IconButton>
              <IconButton label="Remove preference" onClick={() => onRemove(index)}>×</IconButton>
            </li>
          ))
        ) : (
          <li className="rounded-[24px] border border-dashed border-[#dbe3f0] bg-[#fcfdff] px-6 py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f2f5fb] text-2xl text-[#c7d2e6]">≋</div>
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
  )
}
