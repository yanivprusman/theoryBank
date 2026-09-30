'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bank } from '@/lib/bank'

// Whether the app would open with no network, as the service worker
// (public/sw.js) reports it from the copy it keeps.
export type OfflineCopy =
  // No copy here. 'dev-build': a page served by `next dev` cannot start without
  // its dev server — measured: with the network cut it stayed an un-hydrated
  // skeleton although every file came from the copy — so only a production
  // build keeps one. 'insecure': service workers need https (or localhost).
  | { state: 'unavailable'; why: 'dev-build' | 'insecure' | 'unsupported' }
  | { state: 'checking' }
  | { state: 'saving'; done: number; total: number }
  | { state: 'ready' }
  // [missing] is how many files the copy lacks; null when the worker never got to count.
  | { state: 'incomplete'; missing: number | null; reason: string }

// The cache public/sw.js keeps the copy in.
const COPY = 'theorybank-offline-v1'

const pathOf = (path: string) => new URL(path, window.location.origin).pathname

// The build's own files this page loaded: scripts, styles, fonts — including
// the ones fetched late, which no HTML lists.
const loadedBuildFiles = () =>
  performance
    .getEntriesByType('resource')
    .map((entry) => new URL(entry.name))
    .filter((url) => url.origin === window.location.origin && url.pathname.startsWith('/_next/static/') && !url.pathname.includes('.hot-update.'))
    .map((url) => url.pathname)

const picturePaths = (bank: Bank) => [
  ...bank.questions.flatMap((q) => (q.i ? [pathOf(`/bank/img/${q.i}`)] : [])),
  ...bank.signs.map((s) => pathOf(`/bank/signs/${encodeURIComponent(s.i)}`)),
]

// The worker's report, as it posts it (see `tell` in public/sw.js).
function copyFrom(report: { state: string; done?: number; total?: number; missing?: number; reason?: string }): OfflineCopy {
  switch (report.state) {
    case 'checking':
      return { state: 'checking' }
    case 'saving':
      return { state: 'saving', done: report.done!, total: report.total! }
    case 'ready':
      return { state: 'ready' }
    case 'incomplete':
      return { state: 'incomplete', missing: report.missing!, reason: report.reason! }
    default:
      throw new Error(`offline copy: unknown report "${report.state}"`)
  }
}

const DEV_BUILD = process.env.NODE_ENV !== 'production'

function initial(): OfflineCopy {
  if (DEV_BUILD) return { state: 'unavailable', why: 'dev-build' }
  if (!('serviceWorker' in navigator)) return { state: 'unavailable', why: window.isSecureContext ? 'unsupported' : 'insecure' }
  return { state: 'checking' }
}

// A worker an earlier production build left on this address would answer a dev
// page from its copy whenever the dev server is down — a dead skeleton instead
// of the browser's own error. A dev build removes it, and its copy. The dev
// worker (/sw.js?mode=dev, registered for lesson notifications) keeps no copy
// and stays.
async function dropWorker() {
  for (const registration of await navigator.serviceWorker.getRegistrations()) {
    const script = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? registration.waiting?.scriptURL ?? ''
    if (!script.includes('mode=dev')) await registration.unregister()
  }
  await caches.delete(COPY)
}

// Registers the worker and, once the bank is here, asks it to keep the whole
// app. [justSaved] is true for a few seconds after a download finishes — the
// one moment worth telling the reader about.
export function useOfflineCopy(bank: Bank): { copy: OfflineCopy; justSaved: boolean; retry: () => void } {
  const [copy, setCopy] = useState<OfflineCopy>(initial)
  const [attempt, setAttempt] = useState(0)
  const [justSaved, setJustSaved] = useState(false)
  const wasSaving = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (DEV_BUILD) {
      void dropWorker()
      return
    }
    let live = true
    const onMessage = (event: MessageEvent) => {
      if (!live || event.data?.type !== 'offline-copy') return
      const status = copyFrom(event.data)
      if (status.state === 'ready' && wasSaving.current) setJustSaved(true)
      wasSaving.current = status.state === 'saving'
      setCopy(status)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    // A beat after the screen is up: the copy is not what the first paint waits for.
    const start = window.setTimeout(async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
        const registration = await navigator.serviceWorker.ready
        if (live) registration.active?.postMessage({ type: 'keep-offline', buildFiles: loadedBuildFiles(), pictures: picturePaths(bank) })
      } catch (error) {
        if (live) setCopy({ state: 'incomplete', missing: null, reason: error instanceof Error ? error.message : String(error) })
      }
    }, 1500)
    return () => {
      live = false
      window.clearTimeout(start)
      navigator.serviceWorker.removeEventListener('message', onMessage)
    }
  }, [bank, attempt])

  useEffect(() => {
    if (!justSaved) return
    const done = window.setTimeout(() => setJustSaved(false), 5000)
    return () => window.clearTimeout(done)
  }, [justSaved])

  const retry = useCallback(() => {
    setCopy({ state: 'checking' })
    setAttempt((n) => n + 1)
  }, [])

  // An incomplete copy is finished on its own when the network is back, or
  // when the tab is looked at again.
  const incomplete = copy.state === 'incomplete'
  useEffect(() => {
    if (!incomplete) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') retry()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [incomplete, retry])

  return { copy, justSaved, retry }
}

// One line on where the copy stands, for the header while something is
// happening and for the menu always.
export function offlineLine(copy: OfflineCopy): string {
  switch (copy.state) {
    case 'unavailable':
      return copy.why === 'dev-build'
        ? 'גרסת פיתוח: לא נפתחת ללא רשת'
        : copy.why === 'insecure'
          ? 'שימוש ללא רשת אפשרי רק בכתובת https'
          : 'הדפדפן הזה לא שומר עותק לשימוש ללא רשת'
    case 'checking':
      return 'בודק את העותק לשימוש ללא רשת'
    case 'saving':
      return `שומר לשימוש ללא רשת · ${Math.floor((copy.done * 100) / copy.total)}%`
    case 'ready':
      return 'זמין גם ללא רשת'
    case 'incomplete':
      return 'העותק לשימוש ללא רשת לא שלם'
  }
}
