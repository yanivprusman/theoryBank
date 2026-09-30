'use client'

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { ALL } from '@/lib/bank'
import type { Me, Teacher } from '@/lib/accounts'
import { refreshMe, send, signInHref, useAccount } from './account'
import { useBank } from './bank-context'
import { CallIcon, ChatIcon, CheckIcon, PersonIcon, SchoolIcon, TimerIcon, TrafficIcon } from './icons'
import TeacherForm from './TeacherForm'
import { Avatar, BUTTON, BUTTON_TONE, ChipRow, type Chip } from './ui'

const WIDE = 'mx-auto w-full max-w-[1120px] px-4 md:px-6'
const HERE = '/teachers'

type SignedIn = Extract<Me, { signedIn: true }>
type Load = { state: 'loading' } | { state: 'failed'; reason: string } | { state: 'ready'; teachers: Teacher[] }

// The teachers tab has two readers. Students find a teacher and join them;
// teachers ask to be listed and, once listed, see who joined. What each sees
// depends on the account — studying itself never needs one.
export default function TeachersScreen() {
  const account = useAccount()
  const me = account.state === 'ready' && account.me.signedIn ? account.me : null
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const request = new AbortController()
    fetch('/api/teachers', { signal: request.signal })
      .then(async (response) => {
        const reply = (await response.json()) as { ok: boolean; teachers?: Teacher[]; message?: string }
        if (!reply.ok || !reply.teachers) throw new Error(reply.message ?? `השרת החזיר ${response.status}`)
        setLoad({ state: 'ready', teachers: reply.teachers })
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return
        setLoad({ state: 'failed', reason: error instanceof TypeError ? 'אין חיבור לרשת.' : String((error as Error).message) })
      })
    return () => request.abort()
  }, [attempt])

  const retry = () => {
    setLoad({ state: 'loading' })
    setAttempt(attempt + 1)
  }

  return (
    <div className={`${WIDE} pt-4 pb-10`}>
      <Suspense fallback={null}>
        <SignInNotice />
      </Suspense>
      {me?.teacher && <MyListing me={me} />}
      {me?.myTeacher && <MyTeacher teacher={me.myTeacher} />}
      {load.state === 'loading' && <div role="status" aria-label="טוען את רשימת המורים" className="h-24" />}
      {load.state === 'failed' && <LoadFailed reason={load.reason} onRetry={retry} />}
      {load.state === 'ready' &&
        (load.teachers.length === 0 ? (
          <p data-id="teachers-coming" className="t-body-lg rounded-2xl bg-road-soft px-4 py-3 text-ink">
            <span className="font-medium">מחפשים מורה לנהיגה?</span> מורים יופיעו כאן בקרוב.
          </p>
        ) : (
          <TeacherList teachers={load.teachers} me={me} signedOut={account.state === 'ready' && !account.me.signedIn} onJoined={retry} />
        ))}
      {!me?.teacher && <ForTeachers first={load.state === 'ready' && load.teachers.length === 0} me={me} />}
    </div>
  )
}

// Why sign-in came back without signing anyone in.
const SIGNIN_REASONS: Record<string, string> = {
  cancelled: 'הכניסה בוטלה.',
  state: 'הכניסה לא הושלמה. נסה שוב.',
  failed: 'הכניסה עם Google נכשלה. נסה שוב בעוד רגע.',
  unconfigured: 'הכניסה עם Google עוד לא פתוחה באתר הזה.',
}

function SignInNotice() {
  const reason = useSearchParams().get('signin')
  if (!reason) return null
  return (
    <p role="alert" data-id="signin-notice" className="t-body-lg mb-4 rounded-xl bg-bad-soft px-4 py-3 text-bad-ink">
      {SIGNIN_REASONS[reason] ?? 'הכניסה לא הושלמה.'}
    </p>
  )
}

function LoadFailed({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center" role="alert">
      <p className="t-title">רשימת המורים לא נטענה</p>
      <p className="t-body-lg mt-1 text-ink-soft">{reason}</p>
      <button type="button" data-id="teachers-retry" onClick={onRetry} className={`${BUTTON} ${BUTTON_TONE.road} mt-5 h-12`}>
        נסה שוב
      </button>
    </div>
  )
}

function Box({ children, id }: { children: ReactNode; id: string }) {
  return (
    <section data-id={id} className="mb-5 rounded-[18px] border border-line bg-white p-4 md:p-5">
      {children}
    </section>
  )
}

// Acts, then refreshes the account; a refusal is shown where the action was.
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (url: string, method: 'POST' | 'DELETE', body?: unknown) => {
    setBusy(true)
    setError(null)
    const reply = await send(url, method, body)
    if (!reply.ok) setError(reply.message)
    await refreshMe()
    setBusy(false)
    return reply.ok
  }
  return { busy, error, run }
}

// ── For students ────────────────────────────────────────────────────────────

function MyTeacher({ teacher }: { teacher: NonNullable<SignedIn['myTeacher']> }) {
  const { busy, error, run } = useAction()
  return (
    <Box id="my-teacher">
      <p className="t-label text-ink-soft">{teacher.accepted ? 'המורה שלך' : 'ביקשת להצטרף ל'}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <p className="t-title-lg min-w-0 flex-1">{teacher.name}</p>
        {teacher.accepted ? (
          <a href={`tel:${teacher.phone}`} data-id="my-teacher-call" className={`${BUTTON} ${BUTTON_TONE.outline} h-11`}>
            <CallIcon size={18} />
            {teacher.phone}
          </a>
        ) : (
          <span className="t-label rounded-full bg-highlight-soft px-3 py-1.5 text-ink">מחכה לאישור המורה</span>
        )}
      </div>
      <button
        type="button"
        data-id="my-teacher-leave"
        disabled={busy}
        onClick={() => run('/api/my-teacher', 'DELETE')}
        className="t-label mt-3 cursor-pointer rounded-lg px-2 py-1.5 text-ink-soft transition-colors duration-150 ease-rise hover:bg-page hover:text-bad-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {teacher.accepted ? 'לעזוב את המורה' : 'לבטל את הבקשה'}
      </button>
      {error && <p className="t-body mt-2 text-bad-ink">{error}</p>}
    </Box>
  )
}

function TeacherList({ teachers, me, signedOut, onJoined }: { teachers: Teacher[]; me: SignedIn | null; signedOut: boolean; onJoined: () => void }) {
  const { license } = useBank()
  const [area, setArea] = useState(ALL)
  // A teacher who named no licences is shown for every licence.
  const forLicense = useMemo(
    () => teachers.filter((t) => license === ALL || t.licenses.length === 0 || t.licenses.includes(license)),
    [teachers, license],
  )
  const areas = useMemo(() => [...new Set(forLicense.map((t) => t.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [forLicense])
  const chips: Chip[] = [{ value: ALL, id: 'teacher-area-all' }, ...areas.map((a, i) => ({ value: a, id: `teacher-area-${i}` }))]
  const shown = forLicense.filter((t) => area === ALL || t.area === area)

  return (
    <>
      {areas.length > 1 && <ChipRow chips={chips} selected={areas.includes(area) ? area : ALL} label="אזור" onSelect={setArea} />}
      {shown.length === 0 ? (
        <p className="t-body-lg py-8 text-center text-ink-soft">
          {license === ALL ? 'אין עדיין מורים באזור הזה.' : `אין עדיין מורה שמלמד רישיון ${license}.`}
        </p>
      ) : (
        <>
          <p className="t-label pt-1 pb-3 text-ink-soft">
            {shown.length === 1 ? 'מורה אחד' : `${shown.length} מורים`}
            {license !== ALL && ` · מלמדים רישיון ${license}`}
          </p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((teacher) => (
              <li key={teacher.id}>
                <TeacherCard teacher={teacher} me={me} signedOut={signedOut} onJoined={onJoined} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

function TeacherCard({ teacher, me, signedOut, onJoined }: { teacher: Teacher; me: SignedIn | null; signedOut: boolean; onJoined: () => void }) {
  const { busy, error, run } = useAction()
  const intl = `972${teacher.phone.slice(1)}`
  const hello = encodeURIComponent(`שלום ${teacher.name.split(' ')[0]}, ראיתי אותך במאגר התאוריה ואשמח לשמוע על שיעורי נהיגה.`)
  const mine = me?.myTeacher?.id === teacher.id
  const self = me?.user.id === teacher.id
  return (
    <article className="flex h-full flex-col rounded-[18px] border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-road-soft text-road">
          <PersonIcon size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="t-title">{teacher.name}</h3>
          <p className="t-body text-ink-soft">{[teacher.area, teacher.school].filter(Boolean).join(' · ')}</p>
        </div>
        {mine && (
          <span className="t-label inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-ok-ink">
            <CheckIcon size={14} />
            {me?.myTeacher?.accepted ? 'המורה שלך' : 'ביקשת'}
          </span>
        )}
      </div>
      {teacher.licenses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {teacher.licenses.map((l) => (
            <span key={l} className="t-label rounded-full bg-page px-2.5 py-1 text-ink">
              {l}
            </span>
          ))}
        </div>
      )}
      {teacher.note && <p className="t-body-lg mt-3 text-ink">{teacher.note}</p>}
      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
        <a href={`tel:${teacher.phone}`} data-id={`teacher-call-${teacher.id}`} className={`${BUTTON} ${BUTTON_TONE.outline} h-11`}>
          <CallIcon size={18} />
          התקשר
        </a>
        <a
          href={`https://wa.me/${intl}?text=${hello}`}
          target="_blank"
          rel="noopener noreferrer"
          data-id={`teacher-whatsapp-${teacher.id}`}
          className={`${BUTTON} ${BUTTON_TONE.ok} h-11`}
        >
          <ChatIcon size={18} />
          וואטסאפ
        </a>
      </div>
      {!mine && !self && (
        <div className="mt-2">
          {signedOut ? (
            <a href={signInHref(HERE)} data-id={`teacher-join-signin-${teacher.id}`} className={`${BUTTON} ${BUTTON_TONE.quiet} h-11 w-full`}>
              אני לומד אצלו · כניסה עם Google
            </a>
          ) : me ? (
            <button
              type="button"
              data-id={`teacher-join-${teacher.id}`}
              disabled={busy}
              onClick={async () => {
                if (await run('/api/my-teacher', 'POST', { teacherId: teacher.id })) onJoined()
              }}
              className={`${BUTTON} ${BUTTON_TONE.quiet} h-11 w-full`}
            >
              {me.myTeacher ? 'לעבור למורה הזה' : 'אני לומד אצלו'}
            </button>
          ) : null}
          {error && <p className="t-body mt-1 text-bad-ink">{error}</p>}
        </div>
      )}
    </article>
  )
}

// ── For teachers ────────────────────────────────────────────────────────────

const STATUS_LINE = {
  pending: 'הבקשה שלך להופיע ברשימה התקבלה. אחזור אליך בטלפון לגבי המחיר, ואחרי התשלום תופיע כאן.',
  declined: 'הבקשה שלך להופיע ברשימה לא אושרה. אפשר ליצור קשר בוואטסאפ לפרטים.',
}

// The teacher's own corner: where the request stands, and once listed, who joined.
function MyListing({ me }: { me: SignedIn }) {
  const teacher = me.teacher!
  if (teacher.status !== 'approved') {
    return (
      <Box id="my-listing">
        <p className="t-label text-ink-soft">למורים</p>
        <p className="t-body-lg mt-1">{STATUS_LINE[teacher.status]}</p>
      </Box>
    )
  }
  const waiting = me.students.filter((s) => !s.accepted)
  const mine = me.students.filter((s) => s.accepted)
  return (
    <Box id="my-listing">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-headline-sm">התלמידים שלי</h2>
        <p className={`t-label rounded-full px-3 py-1 ${teacher.listed ? 'bg-ok-soft text-ok-ink' : 'bg-bad-soft text-bad-ink'}`}>
          {teacher.listed ? `מופיע ברשימה עד ${formatDate(teacher.listedUntil!)}` : 'לא מופיע ברשימה כרגע'}
        </p>
      </div>
      {waiting.length > 0 && (
        <>
          <p className="t-label-lg mt-4">מבקשים להצטרף</p>
          <ul className="mt-2 space-y-2">
            {waiting.map((s) => (
              <StudentRow key={s.id} student={s} />
            ))}
          </ul>
        </>
      )}
      <p className="t-label-lg mt-4">{mine.length === 0 ? 'עוד אין תלמידים' : `${mine.length} תלמידים`}</p>
      {mine.length === 0 ? (
        <p className="t-body-lg mt-1 text-ink-soft">תלמידים שלומדים אצלך מצטרפים מהכרטיס שלך ברשימה, ומופיעים כאן לאישור.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {mine.map((s) => (
            <StudentRow key={s.id} student={s} />
          ))}
        </ul>
      )}
    </Box>
  )
}

function StudentRow({ student }: { student: SignedIn['students'][number] }) {
  const { busy, error, run } = useAction()
  const answer = (accept: boolean) => run('/api/students', 'POST', { studentId: student.id, accept })
  return (
    <li className="rounded-xl border border-line p-3">
      <div className="flex items-center gap-3">
        <Avatar picture={student.picture} size={36} />
        <div className="min-w-0 flex-1">
          <p className="t-title-sm truncate">{student.name}</p>
          <p dir="ltr" className="t-body-sm truncate text-end text-ink-soft">
            {student.email}
          </p>
        </div>
        {student.accepted ? (
          <button
            type="button"
            data-id={`student-remove-${student.id}`}
            disabled={busy}
            onClick={() => answer(false)}
            className="t-label cursor-pointer rounded-lg px-2 py-1.5 text-ink-soft transition-colors duration-150 ease-rise hover:bg-page hover:text-bad-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            הסר
          </button>
        ) : (
          <div className="flex gap-2">
            <button type="button" data-id={`student-accept-${student.id}`} disabled={busy} onClick={() => answer(true)} className={`${BUTTON} ${BUTTON_TONE.ok} h-10 px-4`}>
              אשר
            </button>
            <button type="button" data-id={`student-decline-${student.id}`} disabled={busy} onClick={() => answer(false)} className={`${BUTTON} ${BUTTON_TONE.outline} h-10 px-4`}>
              דחה
            </button>
          </div>
        )}
      </div>
      {error && <p className="t-body mt-2 text-bad-ink">{error}</p>}
    </li>
  )
}

const formatDate = (iso: string) => iso.split('-').reverse().join('.')

// Why a teacher would pay to be here — only what the app actually is.
const REASONS = [
  { Icon: SchoolIcon, title: 'תלמידים לפני השיעור הראשון', body: 'מי שפותח את המאגר מתכונן עכשיו לתאוריה. השלב הבא שלו הוא למצוא מורה לנהיגה.' },
  { Icon: TimerIcon, title: 'חוזרים שוב ושוב', body: 'תרגול ומבחנים כמו האמיתי: לומדים כאן כמה פעמים עד המבחן, לא נכנסים ויוצאים.' },
  { Icon: TrafficIcon, title: 'לפי סוג הרישיון', body: 'כל תלמיד בוחר רישיון, וכאן הוא רואה רק מורים שמלמדים אותו.' },
]

const STEPS = [
  { title: 'נכנסים ושולחים בקשה', body: 'כניסה עם Google וטופס קצר. לוקח דקה.' },
  { title: 'מדברים', body: 'אחזור אליך בטלפון או בוואטסאפ, ונסגור לכמה זמן ובאיזה מחיר.' },
  { title: 'משלמים ומופיעים', body: 'תקבל קישור לתשלום בביט או באשראי. אחרי התשלום אתה ברשימה, והתלמידים שלך מצטרפים אליך.' },
]

// [first]: no teacher is listed yet, so this is most of the tab — the pitch, and the next step open.
function ForTeachers({ first, me }: { first: boolean; me: SignedIn | null }) {
  const [open, setOpen] = useState(first)
  return (
    <section
      id="for-teachers"
      aria-labelledby="for-teachers-title"
      className="on-road mt-8 overflow-hidden rounded-3xl bg-linear-to-b from-road-dark to-road text-white"
    >
      <div className="p-5 md:p-8">
        <p className="t-label-lg text-highlight">למורים לנהיגה</p>
        <h2 id="for-teachers-title" className="t-headline mt-1.5 max-w-[22ch] text-balance md:text-[30px] md:leading-[38px]">
          {first ? 'היה המורה הראשון שהתלמידים כאן רואים' : 'רוצה להופיע ברשימה?'}
        </h2>
        <p className="t-body-lg mt-2 max-w-[56ch] text-white/85">התלמידים שלומדים כאן תאוריה הם אלה שעוד רגע מחפשים מורה. כאן הם מוצאים אותו.</p>

        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {REASONS.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-2xl bg-white/10 p-4">
              <Icon />
              <h3 className="t-title mt-2">{title}</h3>
              <p className="t-body mt-0.5 text-white/80">{body}</p>
            </li>
          ))}
        </ul>

        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="t-title-sm flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight font-bold text-ink">{i + 1}</span>
              <div>
                <h3 className="t-title-sm font-semibold">{step.title}</h3>
                <p className="t-body text-white/80">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {!me ? (
          <a
            href={signInHref(`${HERE}#for-teachers`)}
            data-id="teachers-signin"
            className="t-label-lg mt-7 inline-flex h-12 cursor-pointer items-center rounded-xl bg-highlight px-6 text-ink transition-[filter,transform] duration-150 ease-rise hover:brightness-95 active:scale-[0.97]"
          >
            כניסה עם Google כדי להופיע כאן
          </a>
        ) : (
          !open && (
            <button
              type="button"
              data-id="teachers-open-form"
              onClick={() => setOpen(true)}
              className="t-label-lg mt-7 inline-flex h-12 cursor-pointer items-center rounded-xl bg-highlight px-6 text-ink transition-[filter,transform] duration-150 ease-rise hover:brightness-95 active:scale-[0.97]"
            >
              אני רוצה להופיע כאן
            </button>
          )
        )}
      </div>
      {me && open && (
        <div className="bg-road-soft p-4 text-ink md:p-8">
          <h3 className="t-headline-sm">הבקשה שלך</h3>
          <p className="t-body-lg mt-1 text-ink-soft">בלי התחייבות. המחיר נקבע אחרי שיחה קצרה, לפי האזור ומשך ההופעה.</p>
          <TeacherForm defaultName={me.user.name} onDone={() => void refreshMe()} />
        </div>
      )}
    </section>
  )
}
