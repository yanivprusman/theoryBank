import { NextResponse } from 'next/server'
import { currentUserId } from '@/lib/accounts'
import { dropSubscription, isSubscription, saveSubscription, subscriptionCount, vapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

// GET: the key a browser subscribes with, and how many of the user's browsers get reminders.
export async function GET() {
  const userId = await currentUserId()
  return NextResponse.json({ ok: true, publicKey: vapidPublicKey(), devices: userId === null ? 0 : await subscriptionCount(userId) })
}

// POST {subscription}: this browser gets the signed-in user's reminders.
export async function POST(req: Request) {
  const userId = await currentUserId()
  if (userId === null) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  const { subscription } = (await req.json().catch(() => ({}))) as { subscription?: unknown }
  if (!isSubscription(subscription)) return NextResponse.json({ ok: false, message: 'הדפדפן לא מסר כתובת להתראות.' }, { status: 400 })
  await saveSubscription(userId, subscription)
  return NextResponse.json({ ok: true })
}

// DELETE {endpoint}: this browser stops getting them.
export async function DELETE(req: Request) {
  const userId = await currentUserId()
  if (userId === null) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown }
  if (typeof endpoint !== 'string') return NextResponse.json({ ok: false, message: 'בקשה לא תקינה.' }, { status: 400 })
  await dropSubscription(userId, endpoint)
  return NextResponse.json({ ok: true })
}
