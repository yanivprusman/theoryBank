import { NextResponse } from 'next/server'
import { activeTeachers } from '@/lib/teachers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The teachers tab's list: every listing that is running today.
export async function GET() {
  try {
    return NextResponse.json({ ok: true, teachers: activeTeachers() })
  } catch (e) {
    console.error('[theoryBank] teachers list unreadable:', e)
    return NextResponse.json({ ok: false, message: 'רשימת המורים לא נטענה בגלל תקלה אצלנו.' }, { status: 500 })
  }
}
