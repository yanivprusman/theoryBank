'use client'

import { useEffect, useRef } from 'react'
import { LETTERS } from '@/lib/bank'

type AnswerKeys = {
  // 1–4, or the option's own letter (א–ד), picks the option in that position.
  onOption: (position: number) => void
  // Enter moves on.
  onAdvance: () => void
  // The arrow keys step between questions, where a screen has steps.
  onStep?: (direction: 1 | -1) => void
}

// Practice and exam from the keyboard. The keys are the page's, not an
// element's — but they stand down while typing, while a dialog is open, and
// whenever Enter already has a job on the focused control.
export function useAnswerKeys(keys: AnswerKeys) {
  const latest = useRef(keys)
  useEffect(() => {
    latest.current = keys
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('dialog[open]')) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      const position = '1234'.includes(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key)
      if (position >= 0) {
        latest.current.onOption(position)
      } else if (e.key === 'Enter') {
        if (target?.closest('button:enabled, a[href]')) return
        latest.current.onAdvance()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!latest.current.onStep) return
        // "Onward" is the reading direction: leftward in Hebrew.
        const onward = getComputedStyle(document.documentElement).direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
        latest.current.onStep(e.key === onward ? 1 : -1)
      } else {
        return
      }
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
