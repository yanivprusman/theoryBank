'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ALL, DEFAULT_LICENSE, LICENSES, SignBook, isFor, licenseLabel, type Bank, type Question, type Sign } from '@/lib/bank'
import { useSessions } from '@/lib/sessions'
import { readStored, writeStored } from '@/lib/storage'
import { MODES, modeAt, tabTitleOf } from '@/lib/modes'
import { offlineLine, useOfflineCopy, type OfflineCopy } from './offline-copy'
import AnswersScreen from './AnswersScreen'
import { BankCtx, useBank } from './bank-context'
import ExamScreen from './ExamScreen'
import { CheckIcon, ExpandMoreIcon, MenuBookIcon, SchoolIcon, SignMark, TimerIcon, TrafficIcon } from './icons'
import PracticeScreen from './PracticeScreen'
import { SignSheet } from './SignSheet'
import SignsScreen from './SignsScreen'
import { Button, COLUMN, Panel } from './ui'

const MODE_ICONS = { answers: MenuBookIcon, signs: TrafficIcon, practice: SchoolIcon, exam: TimerIcon }
const SCREENS = { answers: AnswersScreen, signs: SignsScreen, practice: PracticeScreen, exam: ExamScreen }

// The four screens are one page. Moving between them changes the address with
// the History API — Next keeps `usePathname` in step — and the shell draws the
// screen that address names. No request leaves the browser, so the practice
// score and a running exam survive the switch, and it works with no network.
function goTo(href: string) {
  window.history.pushState(null, '', href)
  window.scrollTo(0, 0)
}

// ── Licence ─────────────────────────────────────────────────────────────────
// Chosen once and rarely changed, so it is remembered between visits. Kept to
// this tab on purpose: a change in another tab must not restart an exam here.

const LICENSE_KEY = 'theoryBank.license'
let chosenLicense: string | null = null
const licenseListeners = new Set<() => void>()

function currentLicense(): string {
  if (chosenLicense === null) {
    const stored = readStored(LICENSE_KEY)
    chosenLicense = stored !== null && LICENSES.includes(stored) ? stored : DEFAULT_LICENSE
  }
  return chosenLicense
}

function chooseLicense(license: string) {
  chosenLicense = license
  writeStored(LICENSE_KEY, license)
  licenseListeners.forEach((listener) => listener())
}

function subscribeLicense(listener: () => void) {
  licenseListeners.add(listener)
  return () => {
    licenseListeners.delete(listener)
  }
}

// ── The app ─────────────────────────────────────────────────────────────────

type Load = { state: 'loading' } | { state: 'failed'; reason: string } | { state: 'ready'; bank: Bank }

// The bank is the Android app's own three files, fetched as they are: static,
// compressed, and revalidated by the browser instead of downloaded again.
async function fetchBankFile<T>(file: string, signal: AbortSignal): Promise<T> {
  try {
    const response = await fetch(`/bank/${file}`, { signal })
    if (!response.ok) throw new Error(`השרת החזיר ${response.status}`)
    return (await response.json()) as T
  } catch (error) {
    // Says which of the three files it was: the browser's own message doesn't.
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

export default function BankApp({ pictures, children }: { pictures: Bank['pictures']; children: ReactNode }) {
  const license = useSyncExternalStore(subscribeLicense, currentLicense, () => DEFAULT_LICENSE)
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load>({ state: 'loading' })

  useEffect(() => {
    const request = new AbortController()
    Promise.all([
      fetchBankFile<Question[]>('questions.json', request.signal),
      fetchBankFile<Sign[]>('signs.json', request.signal),
      fetchBankFile<Bank['spots']>('sign-spots.json', request.signal),
    ])
      .then(([questions, signs, spots]) => setLoad({ state: 'ready', bank: { questions, signs, spots, pictures } }))
      .catch((error: unknown) => {
        if (request.signal.aborted) return
        setLoad({ state: 'failed', reason: error instanceof Error ? error.message : String(error) })
      })
    return () => request.abort()
  }, [attempt, pictures])

  if (load.state === 'ready') {
    return (
      <Ready bank={load.bank} license={license}>
        {children}
      </Ready>
    )
  }
  return (
    <Chrome license={license} count={null}>
      {load.state === 'loading' ? (
        <LoadingBank />
      ) : (
        <LoadFailed
          reason={load.reason}
          onRetry={() => {
            setLoad({ state: 'loading' })
            setAttempt(attempt + 1)
          }}
        />
      )}
    </Chrome>
  )
}

function Ready({ bank, license, children }: { bank: Bank; license: string; children: ReactNode }) {
  const questions = useMemo(() => bank.questions.filter((q) => isFor(q, license)), [bank, license])
  const book = useMemo(() => new SignBook(bank.signs, questions, bank.spots), [bank, questions])
  const { practice, exam } = useSessions(license, questions)
  const mode = modeAt(usePathname())
  const Screen = SCREENS[mode.id]
  // Mid-exam the chrome gets out of the way, like the real test.
  const focused = mode.id === 'exam' && exam.inProgress
  const count = mode.id === 'signs' ? `${bank.signs.length} תמרורים` : `${questions.length} שאלות`

  const offline = useOfflineCopy(bank)

  const openSign = useCallback((sign: Sign) => showSign(sign.n), [])
  const value = useMemo(
    () => ({ bank, license, questions, book, practice, exam, openSign }),
    [bank, license, questions, book, practice, exam, openSign],
  )

  return (
    <BankCtx.Provider value={value}>
      <Chrome license={license} count={count} focused={focused} offline={offline}>
        <Screen />
        {children}
      </Chrome>
      <Suspense fallback={null}>
        <OpenSign />
      </Suspense>
    </BankCtx.Provider>
  )
}

// ── The open sign ───────────────────────────────────────────────────────────
// Which sign's page is open lives in the address (?sign=117): Back closes it,
// and a sign can be linked to. The first sign adds a history entry; going from
// one sign to the next replaces it, so one Back always returns to the page.

const SIGN_PARAM = 'sign'
let signEntryIsOurs = false

function signUrl(n: string | null) {
  const url = new URL(window.location.href)
  if (n === null) url.searchParams.delete(SIGN_PARAM)
  else url.searchParams.set(SIGN_PARAM, n)
  return url
}

function showSign(n: string) {
  const alreadyOpen = new URL(window.location.href).searchParams.has(SIGN_PARAM)
  if (alreadyOpen) {
    window.history.replaceState(null, '', signUrl(n))
  } else {
    window.history.pushState(null, '', signUrl(n))
    signEntryIsOurs = true
  }
}

function hideSign() {
  if (signEntryIsOurs) {
    signEntryIsOurs = false
    window.history.back()
  } else {
    // Arrived on a link that already named a sign: there is nothing to go back to.
    window.history.replaceState(null, '', signUrl(null))
  }
}

function OpenSign() {
  const { book } = useBank()
  const n = useSearchParams().get(SIGN_PARAM)
  useEffect(() => {
    // Back (or Forward) moved between entries: the entry we are on now is not
    // one this visit's `showSign` just pushed.
    const onPop = () => {
      signEntryIsOurs = false
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const sign = n === null ? undefined : book.sign(n)
  if (!sign) return null
  return <SignSheet sign={sign} onDismiss={hideSign} />
}

// ── Chrome: header and tabs ─────────────────────────────────────────────────

type Offline = { copy: OfflineCopy; justSaved: boolean; retry: () => void }

function Chrome({
  license,
  count,
  focused = false,
  offline,
  children,
}: {
  license: string
  count: string | null
  focused?: boolean
  // Known only once the bank is here: the copy is asked for after it.
  offline?: Offline
  children: ReactNode
}) {
  const mode = modeAt(usePathname())
  // A hard load gets its tab title from the page's metadata; a switch gets it here.
  useEffect(() => {
    document.title = tabTitleOf(mode)
  }, [mode])
  const notice = !offline
    ? null
    : offline.justSaved
      ? 'נשמר · המאגר זמין עכשיו גם ללא רשת'
      : offline.copy.state === 'saving' || offline.copy.state === 'incomplete'
        ? offlineLine(offline.copy)
        : null
  return (
    <div className="flex min-h-dvh flex-col" data-chrome={focused ? 'focused' : 'shown'}>
      {!focused && (
        <header className="on-road z-30 bg-linear-to-b from-road-dark to-road text-white lg:sticky lg:top-0">
          <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 md:px-6 lg:h-(--header-h) lg:py-0">
            <SignMark size={40} />
            <div className="min-w-0 flex-1 lg:flex-none">
              <p className="t-title-lg">מאגר התאוריה</p>
              {/* While the offline copy is being saved — and for a moment after, or
                  while it is incomplete — the line under the title says so. */}
              <h1 className={notice ? 'sr-only' : 't-body-sm truncate text-white/80'}>
                {mode.title}
                {count && ` · ${count}`}
              </h1>
              {notice && (
                <p role="status" data-id="offline-notice" className="t-body-sm truncate text-white/80">
                  {notice}
                </p>
              )}
            </div>
            <nav className="mode-nav lg:ms-5" aria-label="מצבי לימוד">
              {MODES.map(({ id, href, label }) => {
                const active = href === mode.href
                const Icon = MODE_ICONS[id]
                return (
                  <a
                    key={id}
                    href={href}
                    data-id={`mode-${id}`}
                    data-active-tab={active ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className="mode-link"
                    onClick={(e) => {
                      // A plain click switches in place; anything else (new tab,
                      // new window, download) is the browser's to handle.
                      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                      e.preventDefault()
                      if (!active) goTo(href)
                    }}
                  >
                    <span className="mode-icon">
                      <Icon />
                    </span>
                    {label}
                  </a>
                )
              })}
            </nav>
            <span className="hidden flex-1 lg:block" />
            <LicensePicker license={license} offline={offline} />
          </div>
        </header>
      )}
      <main className="flex flex-1 flex-col pb-(--nav-h)">{children}</main>
    </div>
  )
}

// Licence is chosen once and rarely changed, so it lives in a compact pill
// rather than taking a row of the screen.
function LicensePicker({ license, offline }: { license: string; offline?: Offline }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-id="license-picker"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`סוג הרישיון: ${licenseLabel(license)}`}
        onClick={() => setOpen(!open)}
        className="t-label-lg flex h-11 cursor-pointer items-center gap-0.5 rounded-full bg-white/16 ps-4 pe-2.5 text-white transition-[background-color,transform] duration-150 ease-rise hover:bg-white/24 active:scale-[0.97]"
      >
        {license === ALL ? ALL : license}
        <ExpandMoreIcon size={20} className={`transition-transform duration-150 ease-rise ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="סוג הרישיון"
          className="absolute end-0 top-full z-40 mt-2 w-60 origin-top animate-pop rounded-2xl border border-line bg-white py-2 text-ink shadow-xl"
        >
          {LICENSES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === license}
              data-id={`license-${option === ALL ? 'all' : option.toLowerCase()}`}
              onClick={() => {
                chooseLicense(option)
                setOpen(false)
              }}
              className="t-body-lg flex h-11 w-full cursor-pointer items-center justify-between px-4 text-start transition-colors duration-150 ease-rise hover:bg-page active:bg-line"
            >
              {licenseLabel(option)}
              {option === license && <CheckIcon size={20} className="text-road" />}
            </button>
          ))}
          {offline && <OfflineRow {...offline} />}
        </div>
      )}
    </div>
  )
}

// Where the offline copy stands, always findable: a dot for the state, the
// words in ink, and a way to try again when it is incomplete.
const COPY_DOT = { unavailable: 'bg-line-strong', checking: 'bg-road', saving: 'bg-road', ready: 'bg-ok', incomplete: 'bg-bad' }

function OfflineRow({ copy, retry }: Offline) {
  return (
    <div data-id="offline-status" className="t-body-sm mt-2 flex items-start gap-2 border-t border-line px-4 pt-3 pb-1 text-ink-soft">
      <span className={`mt-[5px] size-2 shrink-0 rounded-full ${COPY_DOT[copy.state]}`} />
      <span className="min-w-0 flex-1">
        {offlineLine(copy)}
        {copy.state === 'saving' && ` (${copy.done} מתוך ${copy.total} תמונות)`}
        {copy.state === 'incomplete' && copy.missing !== null && ` · חסרים ${copy.missing} קבצים`}
      </span>
      {copy.state === 'incomplete' && (
        <button
          type="button"
          data-id="offline-retry"
          onClick={retry}
          className="t-label -my-1 cursor-pointer rounded-lg px-2 py-1.5 text-road transition-colors duration-150 ease-rise hover:bg-road-soft active:bg-road-tint"
        >
          נסה שוב
        </button>
      )}
    </div>
  )
}

// ── Before the bank is here ─────────────────────────────────────────────────

function LoadingBank() {
  return (
    <div className={`${COLUMN} pt-4`} role="status" aria-label="טוען את המאגר">
      <div className="space-y-3">
        {[72, 56, 64].map((width, i) => (
          <Panel key={i}>
            <Bone className="h-4 w-28" />
            <Bone className="mt-4 h-5" style={{ width: `${width}%` }} />
            <Bone className="mt-2 h-5 w-2/5" />
            <Bone className="mt-4 h-11 rounded-xl" />
          </Panel>
        ))}
      </div>
    </div>
  )
}

function Bone({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-line)_25%,var(--color-page)_50%,var(--color-line)_75%)] bg-[length:200%_100%] ${className}`}
      style={style}
    />
  )
}

function LoadFailed({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className={`${COLUMN} flex flex-1 flex-col items-center justify-center py-16 text-center`} role="alert">
      <SignMark size={72} />
      <p className="t-headline-sm mt-4">המאגר לא נטען</p>
      <p className="t-body-lg mt-1 text-ink-soft">השאלות והתמרורים לא הגיעו מהשרת.</p>
      <p dir="auto" className="t-body-sm mt-1 text-ink-soft">
        {reason}
      </p>
      <Button tone="road" id="retry-load" onClick={onRetry} className="mt-6 h-12">
        נסה שוב
      </Button>
    </div>
  )
}
