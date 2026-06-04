import { languages, domainSubjects, generalTests } from '../utils/constants'
import { marksInputClass } from '../utils/styles'
import { CustomDropdown } from './CustomDropdown'
import { PanelSection } from './UI'

export function SubjectsSection({ subjects, onUpdate }) {
  return (
    <PanelSection
      title="CUET Subjects"
      note="All 5 subjects and marks are required. Score is calculated out of 1000."
    >
      <div className="grid gap-0 rounded-[20px] border border-[#eef2f6]">
        {subjects.map((item, index) => {
          const selectedElsewhere = subjects
            .map((s, i) => (i === index ? '' : s.subject))
            .filter(Boolean)

          return (
            <div
              key={item.label}
              className="grid gap-3 border-b border-[#eef2f6] bg-white px-4 py-4 last:border-b-0 lg:grid-cols-[70px_minmax(0,1fr)_minmax(150px,170px)]"
            >
              <span className="self-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">
                S - 0{index + 1}
              </span>
              <label className="sr-only" htmlFor={`subject-${index + 1}`}>{item.label}</label>
              <CustomDropdown
                id={`subject-${index + 1}`}
                placeholder={index === 0 ? 'Select subject (Required*)' : 'Select subject'}
                required={true}
                value={item.subject}
                onChange={(e) => onUpdate(index, 'subject', e.target.value)}
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
              <input
                className={marksInputClass}
                type="number"
                min="0"
                max="250"
                placeholder="Marks (0-250)"
                required={true}
                value={item.marks}
                onChange={(e) => onUpdate(index, 'marks', e.target.value)}
              />
            </div>
          )
        })}
      </div>
    </PanelSection>
  )
}
