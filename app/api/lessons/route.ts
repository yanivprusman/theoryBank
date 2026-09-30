import { NextResponse } from 'next/server'
import { currentUserId, isApprovedTeacher } from '@/lib/accounts'
import { israelToUtc } from '@/lib/israel-time'
import { cancelLesson, LessonError, moveLesson, scheduleLesson, upcomingLessons } from '@/lib/lessons'

export const dynamic = 'force-dynamic'

const NOTE_MAX = 300
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status })

// GET: the signed-in user's upcoming lessons, as teacher or as student.
export async function GET() {
  const userId = await currentUserId()
  if (userId === null) return fail('צריך להתחבר קודם.', 401)
  return NextResponse.json({ ok: true, lessons: await upcomingLessons(userId) })
}

async function teacher(): Promise<number | NextResponse> {
  const userId = await currentUserId()
  if (userId === null) return fail('צריך להתחבר קודם.', 401)
  if (!(await isApprovedTeacher(userId))) return fail('רק מורה מאושר יכול לקבוע שיעורים.', 403)
  return userId
}

function when(body: Record<string, unknown>): Date | NextResponse {
  const at = typeof body.date === 'string' && typeof body.time === 'string' ? israelToUtc(body.date, body.time) : null
  return at ?? fail('צריך תאריך ושעה תקינים.')
}

async function run(action: () => Promise<unknown>) {
  try {
    await action()
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof LessonError) return fail(e.message)
    console.error('[theoryBank] lesson change failed:', e)
    return fail('השינוי לא נשמר בגלל תקלה אצלנו.', 500)
  }
}

// POST {studentId, date, time, note}: schedule (date/time in Israel time).
export async function POST(req: Request) {
  const t = await teacher()
  if (t instanceof NextResponse) return t
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const at = when(body)
  if (at instanceof NextResponse) return at
  if (typeof body.studentId !== 'number') return fail('לא נבחר תלמיד.')
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, NOTE_MAX) : ''
  return run(() => scheduleLesson(t, body.studentId as number, at, note))
}

// PATCH {id, date, time}: move a lesson.
export async function PATCH(req: Request) {
  const t = await teacher()
  if (t instanceof NextResponse) return t
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const at = when(body)
  if (at instanceof NextResponse) return at
  if (typeof body.id !== 'number') return fail('לא נבחר שיעור.')
  return run(() => moveLesson(t, body.id as number, at))
}

// DELETE {id}: cancel a lesson.
export async function DELETE(req: Request) {
  const t = await teacher()
  if (t instanceof NextResponse) return t
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.id !== 'number') return fail('לא נבחר שיעור.')
  return run(() => cancelLesson(t, body.id as number))
}
