export function SiteHeader() {
  return (
    <header className="relative overflow-hidden rounded-[28px] border border-[#d1d5db] bg-white px-6 py-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:px-8 sm:py-7">
      <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-center gap-4">
          <img src="/cuet-pro-logo.png" alt="CUET PRO" className="h-11 w-auto object-contain sm:h-13" />
          <div className="h-10 w-px bg-[#d1d5db]" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-['Georgia',_serif] text-[clamp(1.5rem,3.5vw,2.4rem)] font-bold leading-tight tracking-tight text-[#101828]">
            DU Preference Sheet Generator
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#667085] sm:text-[0.9rem]">
            An initiative for DU aspirants to streamline college applications.
          </p>
        </div>
      </div>
    </header>
  )
}

export function PanelSection({ title, note, children }) {
  return (
    <section className="min-w-0 rounded-[24px] border border-[#e4e7ec] bg-white">
      <div className="flex flex-col gap-2 border-b border-[#eef2f6] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <h3 className="text-[22px] font-semibold text-[#101828]">{title}</h3>
        {note ? <p className="text-xs text-[#98a2b3]">{note}</p> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  )
}

export function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
      {label}
      {children}
    </label>
  )
}

function MetricIcon({ type }) {
  if (['subjects', 'preferences', 'score', 'generated-rows'].includes(type)) {
    return (
      <div className="mb-2 flex h-9 w-9 items-center justify-center">
        <img src={`/${type}-icon.png`} alt="" className="h-9 w-9 object-contain" aria-hidden />
      </div>
    )
  }
  const styles = {
    trend: { ring: 'bg-[#ecfdf3]', stroke: '#16a34a' },
    list: { ring: 'bg-[#fff7ed]', stroke: '#f97316' },
  }
  const { ring, stroke } = styles[type] || { ring: 'bg-gray-100', stroke: '#888' }
  return (
    <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full ${ring}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {type === 'trend' ? <><path d="M4 16 9 11l4 4 7-9" /><path d="M15 6h5v5" /></> : null}
        {type === 'list' ? <path d="M5 7h14M5 12h14M5 17h14" /> : null}
      </svg>
    </div>
  )
}

export function MetricCard({ label, value, icon }) {
  return (
    <article className="rounded-2xl border border-[#e4e7ec] bg-white px-3.5 py-3 shadow-[0_4px_12px_rgba(16,24,40,0.04)]">
      <MetricIcon type={icon} />
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-[0.16em] text-[#667085]">{label}</span>
      <strong className="block text-2xl font-semibold leading-none text-[#101828]">{value}</strong>
    </article>
  )
}

export function ChanceBadge({ chance, tone }) {
  const classes = {
    safe: 'bg-emerald-100 text-emerald-700',
    match: 'bg-amber-100 text-amber-700',
    dream: 'bg-rose-100 text-rose-700',
  }
  const labels = {
    safe: 'High',
    match: 'Moderate',
    dream: 'Low',
  }
  return (
    <span className={`inline-flex min-w-[64px] items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${classes[tone]}`}>
      {labels[tone]}
    </span>
  )
}

export function CollegeCell({ college, campus, getCampusLabel }) {
  const campusLabel = getCampusLabel(college, campus)
  if (!campusLabel) return <span className="break-words">{college}</span>
  const tone = campusLabel === 'North Campus' ? 'text-[#0c2754]' : 'text-emerald-700'
  return (
    <span className="break-words">
      {college} <span className={`font-semibold ${tone}`}>({campusLabel})</span>
    </span>
  )
}

export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-[#0c2754] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55"
      {...props}
    >
      {children}
    </button>
  )
}

export function WhatsAppButton() {
  return (
    <>
      <style>{`
        @keyframes wa-ping { 0% { transform: scale(1); opacity: 0.6; } 70% { transform: scale(1.9); opacity: 0; } 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes wa-bounce { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } 60% { transform: translateY(-3px); } }
        .wa-ping { animation: wa-ping 2s ease-out infinite; }
        .wa-bounce { animation: wa-bounce 3s ease-in-out infinite; animation-delay: 1s; }
        .wa-bounce:hover { animation: none; transform: scale(1.1); }
      `}</style>
      <a
        href="https://wa.me/917840010970"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="wa-bounce fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-[0_4px_20px_rgba(37,211,102,0.45)] transition-shadow active:scale-95"
      >
        <span className="wa-ping pointer-events-none absolute inset-0 rounded-full bg-[#25d366]" />
        <svg viewBox="0 0 32 32" className="relative h-7 w-7 fill-white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 2.823.738 5.469 2.031 7.769L0 32l8.469-2.009A15.93 15.93 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0Zm0 29.333a13.27 13.27 0 0 1-6.771-1.854l-.486-.289-5.026 1.192 1.214-4.899-.317-.502A13.267 13.267 0 0 1 2.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333Zm7.27-9.878c-.398-.199-2.354-1.162-2.719-1.294-.365-.133-.631-.199-.897.199-.265.398-1.029 1.294-1.261 1.56-.232.266-.465.299-.863.1-.398-.199-1.681-.62-3.202-1.977-1.183-1.056-1.982-2.36-2.214-2.758-.232-.398-.025-.613.175-.811.179-.178.398-.465.597-.698.199-.232.265-.398.398-.664.133-.265.066-.498-.033-.697-.1-.199-.897-2.162-1.229-2.96-.324-.777-.653-.672-.897-.684l-.764-.013c-.265 0-.697.1-1.063.498-.365.398-1.394 1.362-1.394 3.322s1.428 3.853 1.627 4.119c.199.265 2.81 4.291 6.809 6.018.952.411 1.695.657 2.274.841.955.304 1.825.261 2.512.158.766-.114 2.354-.962 2.687-1.891.332-.929.332-1.726.232-1.891-.099-.166-.365-.265-.763-.464Z" />
        </svg>
      </a>
    </>
  )
}

export function SiteFooter() {
  return (
    <footer className="pb-6 text-center text-xs text-[#98a2b3]">
      <p>&copy; 2024 CUET PRO Portal. Designed for DU Admissions Assistance.</p>
      <p className="mt-2">Privacy Policy &nbsp; User Guide &nbsp; Contact Support</p>
    </footer>
  )
}
