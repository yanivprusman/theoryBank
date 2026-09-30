// Who is signed in. The session is a signed cookie holding the Google profile;
// the account row it maps to lives in the shared DB (lib/accounts.ts).
import { cookies } from 'next/headers'
import { verifySession, type SessionUser } from '@automatelinux/google-signin'

export const SESSION_COOKIE = 'theorybank_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180 // half a year: a learner signs in once

export const OAUTH_STATE_COOKIE = 'theorybank_oauth_state'
export const OAUTH_NEXT_COOKIE = 'theorybank_oauth_next'
export const CALLBACK_PATH = '/api/auth/callback'

export function sessionSecret(): string {
  const secret = process.env.THEORYBANK_AUTH_SECRET?.trim()
  if (!secret) throw new Error('THEORYBANK_AUTH_SECRET is not set — cannot sign sessions')
  return secret
}

const secure = process.env.NODE_ENV === 'production'

export const sessionCookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: SESSION_MAX_AGE }
export const shortCookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/', maxAge: 600 }

/** The signed-in Google profile, or null. */
export async function sessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySession(token, sessionSecret())
}
