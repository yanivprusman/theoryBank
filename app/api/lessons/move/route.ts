import { NextResponse } from 'next/server'
import { moveLesson } from '@/lib/lessons'
import { fail, run, teacher, when } from '@/lib/lesson-route'

// POST {id, date, time}: move a lesson (date/time in Israel time). A route of its
// own rather than PATCH: Android's HttpURLConnection cannot send PATCH.
export async function POST(req: Request) {
  const t = await teacher()
  if (t instanceof NextResponse) return t
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const at = when(body)
  if (at instanceof NextResponse) return at
  if (typeof body.id !== 'number') return fail('לא נבחר שיעור.')
  return run(() => moveLesson(t, body.id as number, at))
}
