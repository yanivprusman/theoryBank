'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Lesson } from '@/lib/lessons'
import { useAction } from './account'
import { useReminders } from './reminders'
import { BUTTON, BUTTON_TONE } from './ui'

const ZONE = 'Asia/Jerusalem'

// "יום שלישי 14.10 · 16:00", in Israel time whatever the device's zone.
function when(iso: string) {
  const at = new Date(iso)
  const day = new Intl.DateTimeFormat('he-IL', { timeZone: ZONE, weekday: 'long', day: 'numeric', month: 'numeric' }).format(at)
  const time = new Intl.DateTimeFormat('he-IL', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
  return `${day} · ${time}`
}

// Israel date/time fields of an instant, for the inputs.
function israelFields(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

const tomorrow = () => israelFields(new Date(Date.now() + 24 * 60 * 60 * 1000)).date

type Loaded = { lessons: Lesson[] | null; failed: boolean }

async function loadLessons(): Promise<Loaded> {
  try {
    const reply = (await (await fetch('/api/lessons', { cache: 'no-store' })).json()) as { ok: boolean; lessons?: Lesson[] }
    if (!reply.ok || !reply.lessons) throw new Error('lessons')
    return { lessons: reply.lessons, failed: false }
  } catch {
    return { lessons: null, failed: true }
  }
}

export function useLessons() {
  const [loaded, setLoaded] = useState<Loaded>({ lessons: null, failed: false })
  useEffect(() => {
    let live = true
    void loadLessons().then((next) => {
      if (live) setLoaded(next)
    })
    return () => {
      live = false
    }
  }, [])
  const reload = useCallback(async () => setLoaded(await loadLessons()), [])
  return { ...loaded, reload }
}

const INPUT =
  't-body-lg mt-1 block h-11 w-full rounded-xl border border-line-strong bg-white px-3 text-ink transition-[border-color,box-shadow] duration-150 ease-rise hover:border-ink-soft focus:border-road focus:shadow-[inset_0_0_0_1px_var(--color-road)] focus:outline-none'

// ── Reminders on this device ────────────────────────────────────────────────

const REMINDER_LINE = {
  checking: '',
  on: 'תזכורות לשיעורים פועלות במכשיר הזה: ערב לפני ושעתיים לפני.',
  off: 'רוצה תזכורת לפני כל שיעור? הפעל התראות במכשיר הזה.',
  denied: 'ההתראות לאתר הזה חסומות בדפדפן. כדי לקבל תזכורות, אפשר אותן בהגדרות האתר.',
  'ios-install': 'באייפון, תזכורות עובדות רק מהאפליקציה במסך הבית: שתף ← "הוסף למסך הבית", ופתח משם.',
  unsupported: 'הדפדפן הזה לא תומך בתזכורות. נסה ב-Chrome.',
}

export function RemindersRow() {
  const { state, error, turnOn, turnOff } = useReminders()
  const [busy, setBusy] = useState(false)
  if (state === 'checking') return null
  const act = async (f: () => Promise<unknown>) => {
    setBusy(true)
    await f()
    setBusy(false)
  }
  return (
    <div data-id="reminders" className={`mt-4 rounded-xl px-3.5 py-3 ${state === 'on' ? 'bg-ok-soft' : 'bg-page'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <p className="t-body min-w-0 flex-1 text-ink">{REMINDER_LINE[state]}</p>
        {state === 'off' && (
          <button type="button" data-id="reminders-on" disabled={busy} onClick={() => act(turnOn)} className={`${BUTTON} ${BUTTON_TONE.road} h-10 px-4`}>
            הפעל תזכורות
          </button>
        )}
        {state === 'on' && (
          <button
            type="button"
            data-id="reminders-off"
            disabled={busy}
            onClick={() => act(turnOff)}
            className="t-label cursor-pointer rounded-lg px-2 py-1.5 text-ink-soft transition-colors duration-150 ease-rise hover:bg-white hover:text-bad-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            כבה
          </button>
        )}
      </div>
      {error && <p className="t-body mt-1 text-bad-ink">{error}</p>}
    </div>
  )
}

// ── Student ─────────────────────────────────────────────────────────────────

export function StudentLessons({ lessons }: { lessons: Lesson[] }) {
  if (lessons.length === 0) return <p className="t-body-lg mt-3 text-ink-soft">עוד לא נקבעו לך שיעורים. המורה קובע אותם, והם יופיעו כאן.</p>
  return (
    <>
      <p className="t-label-lg mt-4">השיעורים הקרובים</p>
      <ul className="mt-2 space-y-2">
        {lessons.map((l) => (
          <li key={l.id} data-id={`lesson-${l.id}`} className="rounded-xl border border-line px-3.5 py-2.5">
            <p className="t-title-sm">{when(l.startsAt)}</p>
            {l.note && <p className="t-body text-ink-soft">{l.note}</p>}
          </li>
        ))}
      </ul>
    </>
  )
}

// ── Teacher ─────────────────────────────────────────────────────────────────

type Student = { id: number; name: string }

export function TeacherLessons({ students, lessons, reload }: { students: Student[]; lessons: Lesson[]; reload: () => Promise<void> }) {
  return (
    <>
      <ScheduleForm students={students} reload={reload} />
      <p className="t-label-lg mt-5">{lessons.length === 0 ? 'אין שיעורים קרובים' : 'השיעורים הקרובים'}</p>
      {lessons.length > 0 && (
        <ul className="mt-2 space-y-2">
          {lessons.map((l) => (
            <TeacherLessonRow key={l.id} lesson={l} reload={reload} />
          ))}
        </ul>
      )}
    </>
  )
}

function ScheduleForm({ students, reload }: { students: Student[]; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction()
  const [done, setDone] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setDone(false)
    const ok = await run('/api/lessons', 'POST', {
      studentId: Number(data.get('student')),
      date: String(data.get('date')),
      time: String(data.get('time')),
      note: String(data.get('note') ?? ''),
    })
    if (ok) {
      setDone(true)
      form.reset()
      await reload()
    }
  }
  return (
    <form onSubmit={submit} className="mt-4 rounded-xl bg-page p-3.5">
      <p className="t-label-lg">קביעת שיעור</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-[2fr_1.3fr_1fr]">
        <label className="t-label block">
          תלמיד
          <select name="student" required data-id="lesson-student" className={`${INPUT} cursor-pointer`}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="t-label block">
          תאריך
          <input name="date" type="date" required defaultValue={tomorrow()} data-id="lesson-date" className={INPUT} />
        </label>
        <label className="t-label block">
          שעה
          <input name="time" type="time" required defaultValue="16:00" step={300} data-id="lesson-time" className={INPUT} />
        </label>
      </div>
      <label className="t-label mt-3 block">
        הערה <span className="text-ink-soft">(לא חובה, למשל מקום איסוף)</span>
        <input name="note" maxLength={300} data-id="lesson-note" className={INPUT} />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" data-id="lesson-schedule" disabled={busy} className={`${BUTTON} ${BUTTON_TONE.road} h-11`}>
          {busy ? 'קובע…' : 'קבע שיעור'}
        </button>
        {done && <p className="t-body text-ok-ink">נקבע. התלמיד קיבל הודעה אם הפעיל תזכורות.</p>}
        {error && <p className="t-body text-bad-ink">{error}</p>}
      </div>
    </form>
  )
}

function TeacherLessonRow({ lesson, reload }: { lesson: Lesson; reload: () => Promise<void> }) {
  const { busy, error, run } = useAction()
  const [moving, setMoving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const current = israelFields(new Date(lesson.startsAt))

  async function move(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    if (await run('/api/lessons', 'PATCH', { id: lesson.id, date: String(data.get('date')), time: String(data.get('time')) })) {
      setMoving(false)
      await reload()
    }
  }

  return (
    <li data-id={`lesson-${lesson.id}`} className="rounded-xl border border-line px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="t-title-sm">
            {when(lesson.startsAt)} · {lesson.student.name}
          </p>
          {lesson.note && <p className="t-body text-ink-soft">{lesson.note}</p>}
        </div>
        {!moving && !confirmCancel && (
          <>
            <button type="button" data-id={`lesson-move-${lesson.id}`} onClick={() => setMoving(true)} className={`${BUTTON} ${BUTTON_TONE.quiet} h-9 px-3`}>
              שנה שעה
            </button>
            <button
              type="button"
              data-id={`lesson-cancel-${lesson.id}`}
              onClick={() => setConfirmCancel(true)}
              className="t-label cursor-pointer rounded-lg px-3 py-2 text-ink-soft transition-colors duration-150 ease-rise hover:bg-bad-soft hover:text-bad-ink"
            >
              בטל
            </button>
          </>
        )}
      </div>
      {confirmCancel && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="t-body min-w-0 flex-1">לבטל את השיעור? התלמיד יקבל הודעה.</p>
          <button
            type="button"
            data-id={`lesson-cancel-confirm-${lesson.id}`}
            disabled={busy}
            onClick={async () => {
              if (await run('/api/lessons', 'DELETE', { id: lesson.id })) await reload()
            }}
            className={`${BUTTON} h-9 bg-bad-ink px-4 text-white hover:bg-bad`}
          >
            כן, בטל
          </button>
          <button type="button" data-id={`lesson-cancel-keep-${lesson.id}`} onClick={() => setConfirmCancel(false)} className={`${BUTTON} ${BUTTON_TONE.outline} h-9 px-4`}>
            השאר
          </button>
        </div>
      )}
      {moving && (
        <form onSubmit={move} className="mt-2 flex flex-wrap items-end gap-2">
          <input name="date" type="date" required defaultValue={current.date} data-id={`lesson-move-date-${lesson.id}`} className={`${INPUT} w-auto`} />
          <input name="time" type="time" required defaultValue={current.time} step={300} data-id={`lesson-move-time-${lesson.id}`} className={`${INPUT} w-auto`} />
          <button type="submit" data-id={`lesson-move-save-${lesson.id}`} disabled={busy} className={`${BUTTON} ${BUTTON_TONE.road} h-11`}>
            שמור
          </button>
          <button type="button" data-id={`lesson-move-back-${lesson.id}`} onClick={() => setMoving(false)} className={`${BUTTON} ${BUTTON_TONE.outline} h-11`}>
            חזור
          </button>
        </form>
      )}
      {error && <p className="t-body mt-1 text-bad-ink">{error}</p>}
    </li>
  )
}
