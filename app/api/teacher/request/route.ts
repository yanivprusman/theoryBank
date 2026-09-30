import { NextResponse } from 'next/server'
import { currentUserId, FIELD_LIMITS, requestTeacher, TEACHABLE } from '@/lib/accounts'
import { sessionUser } from '@/lib/session'
import { alertOwner, normalizePhone } from '@/lib/teacher-alert'

/**
 * A signed-in user asks to be listed as a teacher (or updates their details).
 * JSON: name, phone (required); area, school, note; licenses ⊆ TEACHABLE.
 * The owner is told on the first request only — an edit is not news.
 */
export async function POST(req: Request) {
  const user = await sessionUser()
  if (!user) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, message: 'הבקשה לא הגיעה כמו שצריך. נסה שוב.' }, { status: 400 })
  }
  const text = (key: keyof typeof FIELD_LIMITS) => (typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, FIELD_LIMITS[key]) : '')

  const name = text('name')
  // Two words: the payment link (Grow) refuses a single name.
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ ok: false, field: 'name', message: 'צריך שם פרטי ושם משפחה.' }, { status: 400 })
  }
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '')
  if (!phone) return NextResponse.json({ ok: false, field: 'phone', message: 'צריך מספר טלפון ישראלי, למשל 050-1234567.' }, { status: 400 })
  const licenses = Array.isArray(body.licenses) ? TEACHABLE.filter((l) => (body.licenses as unknown[]).includes(l)) : []
  const request = { name, phone, area: text('area'), school: text('school'), licenses, note: text('note') }

  let userId: number
  let firstRequest: boolean
  try {
    userId = (await currentUserId())!
    ;({ firstRequest } = await requestTeacher(userId, request))
  } catch (e) {
    console.error('[theoryBank] teacher request failed:', e)
    return NextResponse.json({ ok: false, message: 'הבקשה לא נשמרה בגלל תקלה אצלנו. נסה שוב בעוד רגע.' }, { status: 500 })
  }
  if (firstRequest) await alertOwner(userId, user.email, request)
  return NextResponse.json({ ok: true })
}
