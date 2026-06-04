import { useEffect, useRef, useState } from 'react'
import { flattenOptions, filterDropdownOptions } from '../utils/helpers'
import { dropdownTriggerClass, dropdownPanelClass } from '../utils/styles'

export function CustomDropdown({
  id, value, onChange, options, placeholder = 'Select',
  required = false, disabled = false, searchable = true,
}) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef(null)
  const searchInputRef = useRef(null)

  const flatOptions = flattenOptions(options)
  const filteredOptions = filterDropdownOptions(options, searchTerm)
  const filteredFlatOptions = flattenOptions(filteredOptions)
  const selectedOption = flatOptions.find((o) => o.value === value)

  useEffect(() => {
    function handleOutsideClick(e) { if (!wrapperRef.current?.contains(e.target)) setOpen(false) }
    function handleEscape(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('mousedown', handleOutsideClick); document.removeEventListener('keydown', handleEscape) }
  }, [])

  useEffect(() => { if (disabled) setOpen(false) }, [disabled])

  useEffect(() => {
    if (!open) { setSearchTerm(''); return }
    requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [open])

  function handleSelect(nextValue) { onChange({ target: { value: nextValue } }); setOpen(false) }

  return (
    <div ref={wrapperRef} className={`relative ${open ? 'z-[90]' : 'z-10'}`}>
      <input id={id} tabIndex={-1} className="sr-only" value={value} onChange={() => {}} required={required} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((c) => !c)}
        className={`${dropdownTriggerClass} ${open ? 'border-[#98b8f8] ring-4 ring-[#3b82f6]/10' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`truncate text-left ${selectedOption ? 'text-[#101828]' : 'text-[#98a2b3]'}`}>
          {selectedOption?.label || placeholder}
        </span>
        <span className={`shrink-0 text-[#98a2b3] transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M5.5 7.5 10 12l4.5-4.5 1.5 1.5-6 6-6-6z" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className={dropdownPanelClass}>
          <div className="max-h-72 overflow-y-auto p-2">
            {searchable ? (
              <div className="border-b border-[#eef2f6] p-2">
                <input
                  ref={searchInputRef}
                  className="w-full rounded-2xl border border-[#dbe3f0] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#101828] outline-none transition placeholder:text-[#98a2b3] focus:border-[#bfd2ee] focus:bg-white focus:ring-4 focus:ring-[#3b82f6]/10"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            ) : null}
            {filteredOptions.map((option) =>
              option?.type === 'group' ? (
                <div key={option.label} className="mb-2 last:mb-0">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#98a2b3]">{option.label}</div>
                  <div className="grid gap-1">
                    {option.options.map((item) => (
                      <DropdownOption key={item.value} selected={item.value === value} onClick={() => handleSelect(item.value)}>
                        {item.label}
                      </DropdownOption>
                    ))}
                  </div>
                </div>
              ) : (
                <DropdownOption key={option.value} selected={option.value === value} onClick={() => handleSelect(option.value)}>
                  {option.label}
                </DropdownOption>
              )
            )}
            {!flatOptions.length ? <div className="px-3 py-3 text-sm text-[#98a2b3]">{placeholder}</div> : null}
            {flatOptions.length && !filteredFlatOptions.length ? <div className="px-3 py-3 text-sm text-[#98a2b3]">No matching options</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DropdownOption({ children, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${selected ? 'bg-[#eff6ff] font-medium text-[#2563eb]' : 'text-[#101828] hover:bg-[#f8fafc]'}`}
    >
      <span className="truncate">{children}</span>
      {selected ? <span className="ml-3 text-xs font-semibold uppercase tracking-[0.12em]">Selected</span> : null}
    </button>
  )
}

export function SelectField({ label, value, onChange, options, required = false }) {
  const normalizedOptions = options.map((o) => typeof o === 'string' ? { label: o, value: o } : o)
  return (
    <label className="grid gap-2 text-sm font-medium uppercase tracking-[0.12em] text-[#667085]">
      {label}
      <CustomDropdown value={value} onChange={onChange} options={normalizedOptions} required={required} placeholder="Select" searchable={false} />
    </label>
  )
}
