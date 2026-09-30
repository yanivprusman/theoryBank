import { NextResponse } from 'next/server'
import { currentUserId } from '@/lib/accounts'
import { scheduleLesson, upcomingLessons } from '@/lib/lessons'
import { fail, run, teacher, when } from '@/lib/lesson-route'

export const dynamic = 'force-dynamic'

const NOTE_MAX = 300

// GET: the signed-in user's upcoming lessons, as teacher or as student.
export async function GET() {
  const userId = await currentUserId()
  if (userId === null) return fail('צריך להתחבר קודם.', 401)
  return NextResponse.json({ ok: true, lessons: await upcomingLessons(userId) })
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
