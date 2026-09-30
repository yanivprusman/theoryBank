import { NextResponse, type NextRequest } from 'next/server'
import { exchangeCode, googleFromEnv, publicOrigin, safeNext, signSession } from '@automatelinux/google-signin'
import { upsertUser } from '@/lib/accounts'
import {
  CALLBACK_PATH,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionCookieOptions,
  sessionSecret,
} from '@/lib/session'

// Google sends the browser back here. Exchange the code, record the account,
// set the session cookie, and return to where sign-in started. A failure lands
// on the teachers tab with a reason it can show.
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req.headers, req.url)
  const params = req.nextUrl.searchParams
  const next = safeNext(req.cookies.get(OAUTH_NEXT_COOKIE)?.value) ?? '/teachers'
  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/teachers?signin=${reason}`)
    res.cookies.delete(OAUTH_STATE_COOKIE)
    res.cookies.delete(OAUTH_NEXT_COOKIE)
    return res
  }

  // "Cancel" on Google's screen is a choice, not an error.
  if (params.get('error')) return fail('cancelled')
  const code = params.get('code')
  const state = params.get('state')
  const expected = req.cookies.get(OAUTH_STATE_COOKIE)?.value
  if (!code || !state || !expected || state !== expected) return fail('state')

  let user
  try {
    user = await exchangeCode(googleFromEnv('THEORYBANK'), code, `${origin}${CALLBACK_PATH}`)
    await upsertUser(user)
  } catch (e) {
    console.error('[theoryBank] sign-in failed:', e)
    return fail('failed')
  }
  const res = NextResponse.redirect(`${origin}${next}`)
  res.cookies.set(SESSION_COOKIE, await signSession(user, sessionSecret(), SESSION_MAX_AGE), sessionCookieOptions)
  res.cookies.delete(OAUTH_STATE_COOKIE)
  res.cookies.delete(OAUTH_NEXT_COOKIE)
  return res
}
