import { NextResponse } from 'next/server'
import { me } from '@/lib/accounts'

export const dynamic = 'force-dynamic'

// Who is signed in, and where they stand as a teacher or a student.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, me: await me() })
  } catch (e) {
    console.error('[theoryBank] /api/me failed:', e)
    return NextResponse.json({ ok: false, message: 'החשבון לא נטען בגלל תקלה אצלנו.' }, { status: 500 })
  }
}
