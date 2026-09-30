import { NextResponse } from 'next/server'
import { cancelLesson } from '@/lib/lessons'
import { fail, run, teacher } from '@/lib/lesson-route'

// POST {id}: cancel a lesson. POST, not DELETE with a body: Android's
// HttpURLConnection refuses to send a body with DELETE.
export async function POST(req: Request) {
  const t = await teacher()
  if (t instanceof NextResponse) return t
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  if (typeof body.id !== 'number') return fail('לא נבחר שיעור.')
  return run(() => cancelLesson(t, body.id as number))
}
