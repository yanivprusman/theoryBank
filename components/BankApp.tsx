'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ALL, DEFAULT_LICENSE, LICENSES, SignBook, isFor, licenseLabel, type Bank, type Question, type Sign } from '@/lib/bank'
import { useSessions } from '@/lib/sessions'
import { readStored, writeStored } from '@/lib/storage'
import { BankCtx, useBank } from './bank-context'
import { CheckIcon, ExpandMoreIcon, MenuBookIcon, SchoolIcon, SignMark, TimerIcon, TrafficIcon } from './icons'
import { SignSheet } from './SignSheet'
import { Button, COLUMN, Panel } from './ui'

// Three ways through the same official bank, and the sign table behind it:
//  Answers  — read every question with only the correct answer (the yellow one)
//  Signs    — every sign in the official table: picture, meaning, and the questions on it
//  Practice — shuffled questions, all four options, instant right/wrong
//  Exam     — the real test's rules: 30 questions, 40 minutes, 26 to pass
const MODES = [
  { id: 'answers', href: '/', label: 'תשובות', title: 'כל השאלות והתשובות', Icon: MenuBookIcon },
  { id: 'signs', href: '/signs', label: 'תמרורים', title: 'לוח התמרורים', Icon: TrafficIcon },
  { id: 'practice', href: '/practice', label: 'תרגול', title: 'תרגול עם משוב מיידי', Icon: SchoolIcon },
  { id: 'exam', href: '/exam', label: 'מבחן', title: 'מבחן כמו האמיתי', Icon: TimerIcon },
] as const

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
  const response = await fetch(`/bank/${file}`, { signal })
  if (!response.ok) throw new Error(`${file}: השרת החזיר ${response.status}`)
  return (await response.json()) as T
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
  const pathname = usePathname()
  // Mid-exam the chrome gets out of the way, like the real test.
  const focused = pathname === '/exam' && exam.inProgress
  const count = pathname === '/signs' ? `${bank.signs.length} תמרורים` : `${questions.length} שאלות`

  const openSign = useCallback((sign: Sign) => showSign(sign.n), [])
  const value = useMemo(
    () => ({ bank, license, questions, book, practice, exam, openSign }),
    [bank, license, questions, book, practice, exam, openSign],
  )

  return (
    <BankCtx.Provider value={value}>
      <Chrome license={license} count={count} focused={focused}>
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

function Chrome({
  license,
  count,
  focused = false,
  children,
}: {
  license: string
  count: string | null
  focused?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const mode = MODES.find((m) => m.href === pathname) ?? MODES[0]
  return (
    <div className="flex min-h-dvh flex-col" data-chrome={focused ? 'focused' : 'shown'}>
      {!focused && (
        <header className="on-road z-30 bg-linear-to-b from-road-dark to-road text-white md:sticky md:top-0">
          <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 md:h-(--header-h) md:px-6 md:py-0">
            <SignMark size={40} />
            <div className="min-w-0 flex-1 md:flex-none">
              <p className="t-title-lg">מאגר התאוריה</p>
              <h1 className="t-body-sm truncate text-white/80">
                {mode.title}
                {count && ` · ${count}`}
              </h1>
            </div>
            <nav className="mode-nav md:ms-5" aria-label="מצבי לימוד">
              {MODES.map(({ id, href, label, Icon }) => {
                const active = href === mode.href
                return (
                  <Link
                    key={id}
                    href={href}
                    data-id={`mode-${id}`}
                    data-active-tab={active ? label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className="mode-link"
                  >
                    <span className="mode-icon">
                      <Icon />
                    </span>
                    {label}
                  </Link>
                )
              })}
            </nav>
            <span className="hidden flex-1 md:block" />
            <LicensePicker license={license} />
          </div>
        </header>
      )}
      <main className="flex flex-1 flex-col pb-(--nav-h)">{children}</main>
    </div>
  )
}

// Licence is chosen once and rarely changed, so it lives in a compact pill
// rather than taking a row of the screen.
function LicensePicker({ license }: { license: string }) {
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
          className="absolute end-0 top-full z-40 mt-2 w-52 origin-top animate-pop rounded-2xl border border-line bg-white py-2 text-ink shadow-xl"
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
        </div>
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
