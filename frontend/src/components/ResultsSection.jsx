import { useState } from 'react'
import { ChanceBadge, CollegeCell } from './UI'
import { chanceBadgeClass, getCampusLabel } from '../utils/helpers'
import { softButtonClass, chipButtonClass } from '../utils/styles'

export function ResultsSection({ resultRows, setResultRows, summary, exportReady, onExcelExport, onPdfExport }) {
  const [draggedIndex, setDraggedIndex] = useState(null)

  if (!summary && !resultRows.length) return null

  return (
    <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white p-5 shadow-[0_8px_24px_rgba(16,24,40,0.05)] sm:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="font-['Georgia'] text-2xl font-bold text-[#101828]">Generated Preference Sheet</h2>
        <p className="min-w-0 text-sm text-[#98a2b3] lg:max-w-[55%]">{summary}</p>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-[#98a2b3]">Drag a college row to shift it up or down in your final preference order.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={chipButtonClass} disabled={!exportReady} onClick={onExcelExport}>
            Download Excel
          </button>
          <button type="button" className={softButtonClass} disabled={!exportReady} onClick={onPdfExport}>
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
                  onDragOver={(e) => e.preventDefault()}
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
                    <CollegeCell college={row.college} campus={row.campus} getCampusLabel={getCampusLabel} />
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
                  No matching records found for selected stream, courses, category, and gender.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
