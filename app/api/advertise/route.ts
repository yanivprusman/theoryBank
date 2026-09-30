import { NextResponse } from 'next/server'
import { LICENSES, ALL } from '@/lib/bank'
import { announceInquiry, FIELD_LIMITS, normalizePhone, saveInquiry } from '@/lib/advertisers'

export const runtime = 'nodejs'

const TEACHABLE = LICENSES.filter((l) => l !== ALL)

/**
 * POST JSON from the teachers page:
 *   name, phone   required
 *   area, school, message   optional free text
 *   licenses      optional, a subset of the bank's licence codes
 *   website       honeypot — a person never sees it, so it must be empty
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, message: 'הבקשה לא הגיעה כמו שצריך. נסה שוב.' }, { status: 400 })
  }
  const text = (key: keyof typeof FIELD_LIMITS) =>
    typeof body[key] === 'string' ? (body[key] as string).trim().slice(0, FIELD_LIMITS[key]) : ''

  if (typeof body.website === 'string' && body.website.trim() !== '') {
    // Only a bot fills the hidden field. It is told it worked and nothing is kept.
    return NextResponse.json({ ok: true })
  }

  const name = text('name')
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ ok: false, field: 'name', message: 'צריך שם פרטי ושם משפחה.' }, { status: 400 })
  }
  const phone = normalizePhone(typeof body.phone === 'string' ? body.phone : '')
  if (!phone) {
    return NextResponse.json({ ok: false, field: 'phone', message: 'צריך מספר טלפון ישראלי, למשל 050-1234567.' }, { status: 400 })
  }
  const licenses = Array.isArray(body.licenses)
    ? TEACHABLE.filter((l) => (body.licenses as unknown[]).includes(l))
    : []

  let inquiry
  try {
    inquiry = saveInquiry({
      name,
      phone,
      area: text('area'),
      school: text('school'),
      licenses,
      message: text('message'),
      userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200),
    })
  } catch (e) {
    console.error('[theoryBank] saveInquiry failed:', e)
    return NextResponse.json({ ok: false, message: 'הפנייה לא נשמרה בגלל תקלה אצלנו. נסה שוב בעוד רגע.' }, { status: 500 })
  }
  await announceInquiry(inquiry)
  return NextResponse.json({ ok: true, id: inquiry.id })
}
