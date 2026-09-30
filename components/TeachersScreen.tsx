'use client'

import { useEffect, useMemo, useState } from 'react'
import { ALL } from '@/lib/bank'
import type { Teacher } from '@/lib/teachers'
import { useBank } from './bank-context'
import { CallIcon, ChatIcon, PersonIcon, SchoolIcon, TimerIcon, TrafficIcon } from './icons'
import TeacherForm from './TeacherForm'
import { BUTTON, BUTTON_TONE, ChipRow, type Chip } from './ui'

const WIDE = 'mx-auto w-full max-w-[1120px] px-4 md:px-6'

type Load = { state: 'loading' } | { state: 'failed'; reason: string } | { state: 'ready'; teachers: Teacher[] }

// The teachers tab has two readers. Students find a teacher near them — the
// teachers listed are the ones who paid for the place. Teachers find out how to
// be listed, and leave their details. Until the first teacher is listed the tab
// is mostly the second: an empty list tells a student nothing.
export default function TeachersScreen() {
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

  if (load.state === 'loading') {
    return <div className={`${WIDE} pt-6`} role="status" aria-label="טוען את רשימת המורים" />
  }
  if (load.state === 'failed') {
    return (
      <div className={`${WIDE} flex flex-1 flex-col items-center justify-center py-16 text-center`} role="alert">
        <p className="t-title">רשימת המורים לא נטענה</p>
        <p className="t-body-lg mt-1 text-ink-soft">{load.reason}</p>
        <button
          type="button"
          data-id="teachers-retry"
          onClick={() => {
            setLoad({ state: 'loading' })
            setAttempt(attempt + 1)
          }}
          className={`${BUTTON} ${BUTTON_TONE.road} mt-5 h-12`}
        >
          נסה שוב
        </button>
      </div>
    )
  }
  if (load.teachers.length === 0) {
    return (
      <div className={`${WIDE} py-6`}>
        <p data-id="teachers-coming" className="t-body-lg rounded-2xl bg-road-soft px-4 py-3 text-ink">
          <span className="font-medium">מחפשים מורה לנהיגה?</span> מורים יופיעו כאן בקרוב.
        </p>
        <ForTeachers first />
      </div>
    )
  }
  return <TeacherList teachers={load.teachers} />
}

// ── For students ────────────────────────────────────────────────────────────

function TeacherList({ teachers }: { teachers: Teacher[] }) {
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
    <div className={`${WIDE} pt-2 pb-10`}>
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
                <TeacherCard teacher={teacher} />
              </li>
            ))}
          </ul>
        </>
      )}
      <ForTeachers />
    </div>
  )
}

function TeacherCard({ teacher }: { teacher: Teacher }) {
  const intl = `972${teacher.phone.slice(1)}`
  const hello = encodeURIComponent(`שלום ${teacher.name.split(' ')[0]}, ראיתי אותך במאגר התאוריה ואשמח לשמוע על שיעורי נהיגה.`)
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
    </article>
  )
}

// ── For teachers ────────────────────────────────────────────────────────────

// Why a teacher would pay to be here — only what the app actually is.
const REASONS = [
  { Icon: SchoolIcon, title: 'תלמידים לפני השיעור הראשון', body: 'מי שפותח את המאגר מתכונן עכשיו לתאוריה. השלב הבא שלו הוא למצוא מורה לנהיגה.' },
  { Icon: TimerIcon, title: 'חוזרים שוב ושוב', body: 'תרגול ומבחנים כמו האמיתי: לומדים כאן כמה פעמים עד המבחן, לא נכנסים ויוצאים.' },
  { Icon: TrafficIcon, title: 'לפי סוג הרישיון', body: 'כל תלמיד בוחר רישיון, וכאן הוא רואה רק מורים שמלמדים אותו.' },
]

const STEPS = [
  { title: 'משאירים פרטים', body: 'בטופס כאן. לוקח דקה.' },
  { title: 'מדברים', body: 'אחזור אליך בטלפון או בוואטסאפ, ונסגור לכמה זמן ובאיזה מחיר.' },
  { title: 'משלמים ומופיעים', body: 'תקבל קישור לתשלום בביט או באשראי. אחרי התשלום אתה ברשימה.' },
]

// [first]: no teacher is listed yet, so this is the whole tab — the pitch and the form open.
function ForTeachers({ first = false }: { first?: boolean }) {
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
        <p className="t-body-lg mt-2 max-w-[56ch] text-white/85">
          התלמידים שלומדים כאן תאוריה הם אלה שעוד רגע מחפשים מורה. כאן הם מוצאים אותו.
        </p>

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
              <span className="t-title-sm flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight font-bold text-ink">
                {i + 1}
              </span>
              <div>
                <h3 className="t-title-sm font-semibold">{step.title}</h3>
                <p className="t-body text-white/80">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {!open && (
          <button
            type="button"
            data-id="teachers-open-form"
            onClick={() => setOpen(true)}
            className="t-label-lg mt-7 inline-flex h-12 cursor-pointer items-center rounded-xl bg-highlight px-6 text-ink transition-[filter,transform] duration-150 ease-rise hover:brightness-95 active:scale-[0.97]"
          >
            אני רוצה להופיע כאן
          </button>
        )}
      </div>
      {open && (
        <div className="bg-road-soft p-4 text-ink md:p-8">
          <h3 className="t-headline-sm">השאר פרטים ואחזור אליך</h3>
          <p className="t-body-lg mt-1 text-ink-soft">בלי התחייבות. המחיר נקבע אחרי שיחה קצרה, לפי האזור ומשך ההופעה.</p>
          <TeacherForm />
        </div>
      )}
    </section>
  )
}
