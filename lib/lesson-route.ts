// What the lesson routes share: who may act, reading a time, and turning a
// refusal into the answer the screen shows.
import { NextResponse } from 'next/server'
import { currentUserId, isApprovedTeacher } from './accounts'
import { israelToUtc } from './israel-time'
import { LessonError } from './lessons'

export const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status })

export async function teacher(): Promise<number | NextResponse> {
  const userId = await currentUserId()
  if (userId === null) return fail('צריך להתחבר קודם.', 401)
  if (!(await isApprovedTeacher(userId))) return fail('רק מורה מאושר יכול לקבוע שיעורים.', 403)
  return userId
}

export function when(body: Record<string, unknown>): Date | NextResponse {
  const at = typeof body.date === 'string' && typeof body.time === 'string' ? israelToUtc(body.date, body.time) : null
  return at ?? fail('צריך תאריך ושעה תקינים.')
}

export async function run(action: () => Promise<unknown>) {
  try {
    await action()
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof LessonError) return fail(e.message)
    console.error('[theoryBank] lesson change failed:', e)
    return fail('השינוי לא נשמר בגלל תקלה אצלנו.', 500)
  }
}

