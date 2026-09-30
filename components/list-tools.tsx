'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { ArrowUpIcon } from './icons'

// Search and filters: they stay in reach while the list scrolls under them.
export function StickyToolbar({ barRef, column, children }: { barRef?: RefObject<HTMLDivElement | null>; column: string; children: ReactNode }) {
  return (
    <div ref={barRef} className="sticky top-(--header-h) z-20 bg-page">
      <div className={`${column} pt-3.5`}>{children}</div>
    </div>
  )
}

const stickyTopOf = (bar: HTMLElement) => parseFloat(getComputedStyle(bar).top) || 0

// How far down the viewport the stuck toolbar reaches: the list's real top edge.
export const stuckBottomOf = (bar: HTMLElement) => stickyTopOf(bar) + bar.offsetHeight

// A new search or filter starts the list from its top. "Top" is where the
// toolbar has just become stuck — scrolling any further up would pull the
// header back in and move the search field from under the typing finger.
// [screen] is the element the toolbar is the first child of: its top is where
// the toolbar sits before it sticks.
export function useListTopOnChange(key: string, screen: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>) {
  const previous = useRef(key)
  useEffect(() => {
    if (previous.current === key) return
    previous.current = key
    if (!screen.current || !bar.current) return
    const listTop = screen.current.getBoundingClientRect().top + window.scrollY - stickyTopOf(bar.current)
    if (window.scrollY > listTop) window.scrollTo(0, listTop)
  }, [key, screen, bar])
}

// Back to the top of a long list; shows up once the top is far behind.
export function ScrollTopButton({ shown }: { shown: boolean }) {
  return (
    <button
      type="button"
      data-id="scroll-to-top"
      aria-label="לראש הרשימה"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed start-5 bottom-[calc(var(--nav-h)+1.25rem)] z-20 grid size-14 cursor-pointer place-items-center rounded-2xl bg-ink text-white shadow-lg transition-[opacity,transform,background-color,visibility] duration-200 ease-rise hover:bg-road-dark active:scale-[0.94] ${
        shown ? 'visible opacity-100' : 'invisible scale-90 opacity-0'
      }`}
    >
      <ArrowUpIcon size={28} />
    </button>
  )
}
