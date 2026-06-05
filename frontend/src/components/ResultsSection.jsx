import { useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ChanceBadge, CollegeCell } from './UI'
import { chanceBadgeClass, sanitizeFileName } from '../utils/helpers'
import { addToListButtonClass } from '../utils/styles'
import { supabase } from '../utils/supabase'

const PAGE_SIZE = 30

export function ResultsSection({ resultRows, setResultRows, summary, exportReady, studentName }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [page, setPage] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [mobile, setMobile] = useState('')
  const [mobileError, setMobileError] = useState('')
  const [userName, setUserName] = useState('')
  const [nameError, setNameError] = useState('')

  if (!summary && !resultRows.length) return null

  const totalPages = Math.ceil(resultRows.length / PAGE_SIZE)
  const pageRows = resultRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function goTo(p) {
    setPage(p)
    document.getElementById('results-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleDownloadClick() {
    setMobile('')
    setMobileError('')
    setUserName('')
    setNameError('')
    setShowModal(true)
  }

  function handleMobileChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setMobile(val)
    if (mobileError) setMobileError('')
  }

  async function handleConfirm() {
    let hasError = false
    if (!userName.trim()) {
      setNameError('Please enter your name.')
      hasError = true
    }
    if (!/^\d{10}$/.test(mobile)) {
      setMobileError('Please enter a valid 10-digit mobile number.')
      hasError = true
    }
    if (hasError) return

    setIsDownloading(true)
    setShowModal(false)

    // Save lead to Supabase
    if (supabase) {
      try {
        await supabase.from('pdf_leads').insert([{
          name: userName.trim(),
          mobile,
          student_name: studentName || null,
          downloaded_at: new Date().toISOString(),
        }])
      } catch (err) {
        console.error('Supabase insert error:', err)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 600))
    await triggerPdfDownload()
    setIsDownloading(false)
  }

  function addWatermarkToAllPages(doc, watermark) {
    if (!watermark) return
    const totalPdfPages = doc.internal.getNumberOfPages()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    for (let i = 1; i <= totalPdfPages; i++) {
      doc.setPage(i)
      // Place the pre-rotated canvas image perfectly centred on the page
      doc.addImage(
        watermark.dataUrl, 'PNG',
        pageWidth / 2 - watermark.width / 2,
        pageHeight / 2 - watermark.height / 2,
        watermark.width,
        watermark.height
      )
    }
  }

  async function triggerPdfDownload() {
    // Pre-render the rotated logo onto a canvas so it centres perfectly on every page
    let watermark = null
    try {
      watermark = await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const angle = 45 * Math.PI / 180
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const scale = 2 // 2× for print sharpness
          const imgW = 380 * scale
          const imgH = Math.round(imgW * img.naturalHeight / img.naturalWidth)
          // Canvas must be big enough to contain the rotated image
          const canvasW = Math.ceil(imgW * cos + imgH * sin)
          const canvasH = Math.ceil(imgW * sin + imgH * cos)
          const canvas = document.createElement('canvas')
          canvas.width = canvasW
          canvas.height = canvasH
          const ctx = canvas.getContext('2d')
          ctx.globalAlpha = 0.1
          ctx.translate(canvasW / 2, canvasH / 2)
          ctx.rotate(angle)
          ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH)
          resolve({ dataUrl: canvas.toDataURL('image/png'), width: canvasW / scale, height: canvasH / scale })
        }
        img.onerror = () => resolve(null)
        img.src = '/cuet-pro-logo.png'
      })
    } catch (e) {
      console.error('Failed to create watermark:', e)
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFontSize(13)
    doc.text('DU Preference Sheet', 40, 32)
    doc.setFontSize(10)
    doc.text(summary, 40, 50)
    autoTable(doc, {
      head: [['Preference No.', 'College', 'Course', 'Previous Cutoff', 'Admission Chances']],
      body: resultRows.map((row, idx) => [
        idx + 1,
        row.college,
        row.course,
        row.requiredCutoff.toFixed(2),
        row.chance === null ? 'NA' : chanceBadgeClass(row.chance) === 'safe' ? 'High' : chanceBadgeClass(row.chance) === 'match' ? 'Moderate' : 'Low',
      ]),
      startY: 64,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [12, 39, 84] },
    })
    addWatermarkToAllPages(doc, watermark)
    doc.save(`${sanitizeFileName(studentName || 'student')}_du_preference_sheet.pdf`)
  }

  return (
    <>
      {/* Mobile number overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-[24px] bg-white p-6 shadow-[0_24px_48px_rgba(0,0,0,0.18)]">
            <h3 className="mb-1 text-lg font-semibold text-[#101828]">Enter Your Details</h3>
            <p className="mb-5 text-sm text-[#667085]">Your details will be used for communication purposes only.</p>

            <div className="grid gap-3">
              <input
                type="text"
                placeholder="Your name"
                value={userName}
                onChange={(e) => { setUserName(e.target.value); if (nameError) setNameError('') }}
                className="w-full rounded-2xl border border-[#dbe3f0] bg-white px-4 py-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#bfd2ee] focus:ring-4 focus:ring-[#3b82f6]/10"
              />
              {nameError && <p className="-mt-2 text-[12px] font-medium text-red-500">{nameError}</p>}

              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={handleMobileChange}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                className="w-full rounded-2xl border border-[#dbe3f0] bg-white px-4 py-3 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#bfd2ee] focus:ring-4 focus:ring-[#3b82f6]/10"
              />
              {mobileError && <p className="-mt-2 text-[12px] font-medium text-red-500">{mobileError}</p>}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border border-[#e4e7ec] bg-[#f2f4f7] px-4 py-3 text-sm font-semibold text-[#667085] transition hover:bg-[#e9edf3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 items-center justify-center rounded-2xl bg-[#0c2754] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0a2146]"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white p-5 shadow-[0_8px_24px_rgba(16,24,40,0.05)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-['Georgia'] text-2xl font-bold text-[#101828]">Generated Preference Sheet</h2>
          <p className="min-w-0 text-sm text-[#98a2b3] lg:max-w-[55%]">{summary}</p>
        </div>

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-[#98a2b3]">Drag a college row to shift it up or down in your final preference order.</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`${addToListButtonClass} flex items-center gap-2`}
              disabled={!exportReady || isDownloading}
              onClick={handleDownloadClick}
            >
              {isDownloading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Preparing...
                </>
              ) : (
                'Download PDF'
              )}
            </button>
          </div>
        </div>

        <div id="results-table-wrap" className="overflow-x-auto rounded-[24px] border border-[#e4e7ec]">
          <table className="w-full min-w-0 border-collapse bg-white text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs uppercase tracking-[0.18em] text-[#667085]">
              <tr>
                <th className="px-4 py-3">Preference No.</th>
                <th className="px-4 py-3">College</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Previous Cutoff</th>
                <th className="px-4 py-3">Admission Chances</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((row, localIndex) => {
                  const globalIndex = page * PAGE_SIZE + localIndex
                  return (
                    <tr
                      key={`${row.college}-${row.course}-${globalIndex}`}
                      draggable
                      onDragStart={() => setDraggedIndex(globalIndex)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggedIndex === null || draggedIndex === globalIndex) return
                        setResultRows((current) => {
                          const next = [...current]
                          const [moved] = next.splice(draggedIndex, 1)
                          next.splice(globalIndex, 0, moved)
                          return next
                        })
                        setDraggedIndex(null)
                      }}
                      onDragEnd={() => setDraggedIndex(null)}
                      className="cursor-grab border-t border-[#eef2f6] hover:bg-[#f8fafc]"
                    >
                      <td className="px-4 py-3 text-[#667085]">{globalIndex + 1}</td>
                      <td className="px-4 py-3">
                        <CollegeCell college={row.college} />
                      </td>
                      <td className="px-4 py-3">{row.course}</td>
                      <td className="px-4 py-3">{row.requiredCutoff.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <ChanceBadge chance={row.chance} tone={chanceBadgeClass(row.chance)} />
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-center text-[#98a2b3]" colSpan="5">
                    No matching records found for selected stream, courses, and category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[#667085]">
              Showing{' '}
              <span className="font-semibold text-[#101828]">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, resultRows.length)}</span>
              {' '}of{' '}
              <span className="font-semibold text-[#101828]">{resultRows.length}</span> results
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goTo(page - 1)}
                disabled={page === 0}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white text-[#667085] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M12.5 15 7.5 10l5-5 1.5 1.5L10.5 10l3.5 3.5z" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  className={`flex h-9 min-w-[36px] items-center justify-center rounded-xl border px-2 text-sm font-semibold transition ${
                    p === page
                      ? 'border-[#0c2754] bg-[#0c2754] text-white'
                      : 'border-[#e4e7ec] bg-white text-[#667085] hover:bg-[#f8fafc]'
                  }`}
                >
                  {p + 1}
                </button>
              ))}

              <button
                type="button"
                onClick={() => goTo(page + 1)}
                disabled={page === totalPages - 1}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e7ec] bg-white text-[#667085] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M7.5 5l5 5-5 5L6 13.5 9.5 10 6 6.5z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  )
}
