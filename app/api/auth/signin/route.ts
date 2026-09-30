import { NextResponse, type NextRequest } from 'next/server'
import { authorizeUrl, googleFromEnv, publicOrigin, safeNext, SigninConfigError } from '@automatelinux/google-signin'
import { CALLBACK_PATH, OAUTH_NEXT_COOKIE, OAUTH_STATE_COOKIE, shortCookieOptions } from '@/lib/session'

// Sends the browser to Google. The random `state` goes to Google and into a
// short cookie; the callback proceeds only if they match, so nobody can hand a
// user a crafted callback link.
export async function GET(req: NextRequest) {
  const origin = publicOrigin(req.headers, req.url)
  let cfg
  try {
    cfg = googleFromEnv('THEORYBANK')
  } catch (e) {
    if (!(e instanceof SigninConfigError)) throw e
    console.error(`[theoryBank] sign-in is not configured: ${e.message}`)
    return NextResponse.redirect(`${origin}/teachers?signin=unconfigured`)
  }
  const state = crypto.randomUUID()
  const res = NextResponse.redirect(authorizeUrl(cfg, `${origin}${CALLBACK_PATH}`, state, req.nextUrl.searchParams.get('switch') === '1'))
  res.cookies.set(OAUTH_STATE_COOKIE, state, shortCookieOptions)
  // Back to where they were (the teachers tab, usually) — same-site paths only.
  const next = safeNext(req.nextUrl.searchParams.get('next'))
  if (next) res.cookies.set(OAUTH_NEXT_COOKIE, next, shortCookieOptions)
  return res
}
