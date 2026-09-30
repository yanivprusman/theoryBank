'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { Button } from './ui'

// A native modal <dialog>: the browser traps focus, makes the page behind inert
// and turns Escape (and Android's back gesture) into a `cancel`. It is opened
// here and closed by being removed — so it is dismissed exactly once, by
// whoever owns the state, never by the dialog's own `close` event.
function useModal(onDismiss: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    dialog.showModal()
    // Focus starts on the dialog itself, not on its first button: no button is
    // one stray Enter away, and Tab still walks them in order.
    dialog.focus()
  }, [])
  return {
    ref,
    tabIndex: -1,
    onCancel: (e: React.SyntheticEvent) => {
      e.preventDefault()
      onDismiss()
    },
    // The dialog box is fully covered by its content, so a click that lands on
    // the dialog element itself landed on the backdrop.
    onClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onDismiss()
    },
  }
}

// A sheet of content over the page: from the bottom edge on a phone, as in the
// Android app; a centred panel on a wide screen.
export function Sheet({
  id,
  label,
  onDismiss,
  children,
  scrollKey,
  tone = 'page',
}: {
  id: string
  label: string
  onDismiss: () => void
  children: ReactNode
  // Changing it swaps the content for something else: the sheet starts from the top again.
  scrollKey?: string
  tone?: 'page' | 'white'
}) {
  const modal = useModal(onDismiss)
  return (
    <dialog
      {...modal}
      data-id={id}
      aria-label={label}
      className={`mx-auto mt-auto mb-0 max-h-[92dvh] outline-none w-full max-w-none animate-rise flex-col overflow-hidden rounded-t-3xl text-ink shadow-2xl backdrop:bg-ink/45 open:flex md:mb-auto md:max-h-[86dvh] md:max-w-[600px] md:rounded-3xl ${
        tone === 'page' ? 'bg-page' : 'bg-white'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between ps-5 pe-2 pt-2">
        <span className="t-label text-ink-soft">{label}</span>
        <button
          type="button"
          data-id={`${id}-close`}
          aria-label="סגירה"
          onClick={onDismiss}
          className="grid size-11 cursor-pointer place-items-center rounded-full text-ink-soft transition-[background-color,color,transform] duration-150 ease-rise hover:bg-line hover:text-ink active:scale-[0.94]"
        >
          <CloseIcon />
        </button>
      </div>
      <div key={scrollKey} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </dialog>
  )
}

// A question that needs a yes or a no before anything is lost.
export function Confirm({
  id,
  title,
  text,
  confirmLabel,
  dismissLabel,
  danger = false,
  onConfirm,
  onDismiss,
}: {
  id: string
  title: string
  text: string
  confirmLabel: string
  dismissLabel: string
  danger?: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  const modal = useModal(onDismiss)
  return (
    <dialog
      {...modal}
      data-id={id}
      aria-labelledby={`${id}-title`}
      className="m-auto w-[calc(100%-2rem)] max-w-[400px] animate-pop outline-none rounded-3xl bg-white text-ink shadow-2xl backdrop:bg-ink/45"
    >
      <div className="p-6">
        <h2 id={`${id}-title`} className="t-title-lg">
          {title}
        </h2>
        <p className="t-body-lg mt-2 text-ink-soft">{text}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button tone="quiet" id={`${id}-dismiss`} onClick={onDismiss} className="h-11">
            {dismissLabel}
          </Button>
          <button
            type="button"
            data-id={`${id}-confirm`}
            onClick={onConfirm}
            className={`t-label-lg h-11 cursor-pointer rounded-xl px-5 text-white transition-[background-color,transform] duration-150 ease-rise active:scale-[0.97] ${
              danger ? 'bg-bad-ink hover:bg-bad-ink/90' : 'bg-road hover:bg-road-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
