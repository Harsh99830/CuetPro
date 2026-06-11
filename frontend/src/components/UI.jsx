import { useState } from 'react'

// ── Sidebar Navigation ───────────────────────────────────────────────────────

const navItems = [
  {
    id: 'profile',
    label: 'Student Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: 'subjects',
    label: 'CUET Subjects',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'courses',
    label: 'Course Ordering',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    id: 'results',
    label: 'Results',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
        <path d="M3 3v18h18" /><path d="M18 9l-5 5-3-3-5 5" />
      </svg>
    ),
  },
]

export function AppShell({ activeSection, onNavClick, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    // Key fix: h-screen + overflow-hidden on root so only main scrolls, not sidebar
    <div className="flex h-screen overflow-hidden bg-[#f5f7fa]">

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar — pinned, never scrolls ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col border-r border-[#e4e7ec] bg-white
          transition-transform duration-300
          lg:static lg:z-auto lg:translate-x-0
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex shrink-0 items-center justify-center border-b border-[#e4e7ec] px-5 py-4">
          <a href="https://cuetpro.com" target="_blank" rel="noopener noreferrer">
            <img
              src="/cuet-pro-logo.png"
              alt="CUET PRO — An initiative by DU Toppers"
              className="h-12 w-auto object-contain transition hover:opacity-80"
            />
          </a>
        </div>

        {/* Nav — no overflow, items just stack */}
        <nav className="shrink-0 px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#98a2b3]">Menu</p>
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => { onNavClick(item.id); setMobileOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      isActive
                        ? 'bg-[#0c2754] text-white'
                        : 'text-[#344054] hover:bg-[#f2f4f7] hover:text-[#101828]'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-[#667085]'}>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Pushes WhatsApp to bottom */}
        <div className="flex-1" />

        {/* WhatsApp CTA */}
        <div className="shrink-0 border-t border-[#e4e7ec] px-3 py-4">
          <a
            href="https://wa.me/917840010970"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-xl bg-[#ecfdf5] px-3 py-2.5 text-sm font-medium text-[#15803d] transition hover:bg-[#d1fae5]"
          >
            <svg viewBox="0 0 32 32" className="h-5 w-5 shrink-0 fill-[#16a34a]" aria-hidden="true">
              <path d="M16 0C7.163 0 0 7.163 0 16c0 2.823.738 5.469 2.031 7.769L0 32l8.469-2.009A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0Zm0 29.333a13.27 13.27 0 0 1-6.771-1.854l-.486-.289-5.026 1.192 1.214-4.899-.317-.502A13.267 13.267 0 0 1 2.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333Zm7.27-9.878c-.398-.199-2.354-1.162-2.719-1.294-.365-.133-.631-.199-.897.199-.265.398-1.029 1.294-1.261 1.56-.232.266-.465.299-.863.1-.398-.199-1.681-.62-3.202-1.977-1.183-1.056-1.982-2.36-2.214-2.758-.232-.398-.025-.613.175-.811.179-.178.398-.465.597-.698.199-.232.265-.398.398-.664.133-.265.066-.498-.033-.697-.1-.199-.897-2.162-1.229-2.96-.324-.777-.653-.672-.897-.684l-.764-.013c-.265 0-.697.1-1.063.498-.365.398-1.394 1.362-1.394 3.322s1.428 3.853 1.627 4.119c.199.265 2.81 4.291 6.809 6.018.952.411 1.695.657 2.274.841.955.304 1.825.261 2.512.158.766-.114 2.354-.962 2.687-1.891.332-.929.332-1.726.232-1.891-.099-.166-.365-.265-.763-.464Z" />
            </svg>
            Need help? Chat
          </a>
        </div>
      </aside>

      {/* ── Main area — this column scrolls, sidebar doesn't ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">

        {/* Top bar — sticky inside the scrolling column */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between border-b border-[#e4e7ec] bg-white px-5 py-3.5 lg:px-7">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e4e7ec] text-[#667085] transition hover:bg-[#f2f4f7] lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <p className="hidden text-base font-semibold text-[#101828] lg:block">
            DU Preference Sheet Generator
          </p>
          <p className="text-base font-semibold text-[#101828] lg:hidden">CuetPro</p>

          <span className="rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-semibold text-[#15803d]">
            Free Tool
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 px-5 py-6 lg:px-7 lg:py-6">
          {children}
        </main>

      </div>
    </div>
  )
}

// ── Shared components ────────────────────────────────────────────────────────

export function SiteHeader() {
  return (
    <div className="rounded-[16px] border border-[#e4e7ec] bg-white px-4 py-4 shadow-[0_2px_8px_rgba(16,24,40,0.05)] sm:px-5 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-['Georgia',_serif] text-base font-bold leading-snug text-[#101828] sm:text-2xl">
          DU Preference Sheet Generator
        </h1>
        <a href="https://cuetpro.com" target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img
            src="/cuet-pro-logo.png"
            alt="CUET PRO"
            className="h-10 w-auto object-contain sm:h-16"
          />
        </a>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#667085] sm:text-sm">
        Fill in your profile, subjects, and course preferences — we'll generate a smart preference list based on last year's DU cutoffs.
      </p>
    </div>
  )
}

export function PanelSection({ title, note, children }) {
  return (
    <section className="min-w-0 rounded-[16px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.02)]">
      <div className="flex flex-col gap-1 border-b border-[#eef2f6] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-base font-semibold text-[#101828] sm:text-lg">{title}</h3>
        {note ? <p className="text-xs text-[#98a2b3] sm:text-sm lg:max-w-[55%] lg:text-right">{note}</p> : null}
      </div>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  )
}

export function Field({ label, children }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[#667085]">
      {label}
      {children}
    </label>
  )
}

function MetricIcon({ type }) {
  if (type === 'subjects') return <svg className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
  if (type === 'preferences') return <svg className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
  if (type === 'score') return <svg className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  if (type === 'generated-rows') return <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-5 5"/></svg>
  
  return <div className="h-5 w-5 bg-gray-200 rounded-full" />
}

export function MetricCard({ label, value, icon }) {
  return (
    <article className="rounded-[16px] border border-[#e4e7ec] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.02)] sm:px-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 border border-slate-100 shrink-0">
          <MetricIcon type={icon} />
        </div>
        <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#667085] truncate">{label}</span>
      </div>
      <strong className="block text-xl font-bold leading-none text-[#101828] sm:text-2xl">{value}</strong>
    </article>
  )
}

export function ChanceBadge({ chance, tone }) {
  if (chance === null || chance === undefined) {
    return (
      <span className="inline-flex min-w-[72px] items-center justify-center rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
        NA
      </span>
    )
  }
  const classes = {
    safe: 'bg-emerald-100 text-emerald-700',
    match: 'bg-amber-100 text-amber-700',
    dream: 'bg-rose-100 text-rose-700',
  }
  const labels = { safe: 'High', match: 'Moderate', dream: 'Low' }
  return (
    <span className={`inline-flex min-w-[72px] items-center justify-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${classes[tone]}`}>
      {labels[tone]}
    </span>
  )
}

function CollegeNameWithWomenMarker({ college }) {
  const markerIndex = String(college || '').lastIndexOf('(W)')
  if (markerIndex === -1) return college
  return (
    <>
      {college.slice(0, markerIndex)}
      <span className="font-semibold text-red-600">(W)</span>
      {college.slice(markerIndex + 3)}
    </>
  )
}

export function CollegeCell({ college }) {
  return (
    <span className="break-words">
      <CollegeNameWithWomenMarker college={college} />
    </span>
  )
}

export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-[#0c2754] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55"
      {...props}
    >
      {children}
    </button>
  )
}

export function WhatsAppButton() {
  return null
}

export function SiteFooter() {
  return (
    <footer className="mt-4 pb-6">
      <div className="flex flex-col items-center gap-2 rounded-[16px] border border-[#e4e7ec] bg-white px-5 py-3 sm:flex-row sm:justify-between">
        <p className="text-xs text-[#98a2b3]">&copy; 2024 CUET PRO Portal &mdash; DU Admissions Assistance</p>
        <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-wider">
          <a href="#" className="text-[#667085] transition hover:text-[#0c2754]">Privacy Policy</a>
          <a href="#" className="text-[#667085] transition hover:text-[#0c2754]">User Guide</a>
          <a href="#" className="text-[#667085] transition hover:text-[#0c2754]">Contact Support</a>
        </div>
      </div>
    </footer>
  )
}
