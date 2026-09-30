import { NextResponse } from 'next/server'
import { askTeacher, currentUserId, leaveTeacher, LinkError } from '@/lib/accounts'

// A student's link to their teacher: POST {teacherId} asks, DELETE leaves.
export async function POST(req: Request) {
  const studentId = await currentUserId()
  if (studentId === null) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  const { teacherId } = (await req.json().catch(() => ({}))) as { teacherId?: unknown }
  if (typeof teacherId !== 'number') return NextResponse.json({ ok: false, message: 'לא נבחר מורה.' }, { status: 400 })
  try {
    await askTeacher(studentId, teacherId)
  } catch (e) {
    if (e instanceof LinkError) return NextResponse.json({ ok: false, message: e.message }, { status: 400 })
    console.error('[theoryBank] ask teacher failed:', e)
    return NextResponse.json({ ok: false, message: 'הבקשה לא נשמרה בגלל תקלה אצלנו.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const studentId = await currentUserId()
  if (studentId === null) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  await leaveTeacher(studentId)
  return NextResponse.json({ ok: true })
}
