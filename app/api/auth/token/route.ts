import { NextResponse } from 'next/server'
import { googleFromEnv, signSession, verifyIdToken } from '@automatelinux/google-signin'
import { upsertUser } from '@/lib/accounts'
import { SESSION_MAX_AGE, sessionSecret } from '@/lib/session'

// The Android app signs in with Google on the phone (Credential Manager), which
// hands it an id_token for our web client. Google checks that token here; the
// app gets back the same signed session a browser keeps in its cookie, and sends
// it as `Authorization: Bearer`.
export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: unknown }
  if (typeof idToken !== 'string' || idToken.length > 4096) return NextResponse.json({ ok: false, message: 'חסר אישור מ-Google.' }, { status: 400 })
  let user
  try {
    user = await verifyIdToken(idToken, googleFromEnv('THEORYBANK').clientId)
    await upsertUser(user)
  } catch (e) {
    console.error('[theoryBank] app sign-in refused:', (e as Error).message)
    return NextResponse.json({ ok: false, message: 'הכניסה עם Google לא אושרה. נסה שוב.' }, { status: 401 })
  }
  return NextResponse.json({ ok: true, token: await signSession(user, sessionSecret(), SESSION_MAX_AGE) })
}
