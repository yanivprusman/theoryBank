import { NextResponse } from 'next/server'
import { listedTeachers } from '@/lib/accounts'

export const dynamic = 'force-dynamic'

// The teachers tab's list: approved teachers whose listing runs today.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, teachers: await listedTeachers() })
  } catch (e) {
    console.error('[theoryBank] teachers list failed:', e)
    return NextResponse.json({ ok: false, message: 'רשימת המורים לא נטענה בגלל תקלה אצלנו.' }, { status: 500 })
  }
}
