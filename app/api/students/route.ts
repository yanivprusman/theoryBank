import { NextResponse } from 'next/server'
import { answerStudent, currentUserId, isApprovedTeacher } from '@/lib/accounts'

// A teacher answers a student: POST {studentId, accept}. accept:false declines a
// request, or removes a student who was already theirs.
export async function POST(req: Request) {
  const teacherId = await currentUserId()
  if (teacherId === null) return NextResponse.json({ ok: false, message: 'צריך להתחבר קודם.' }, { status: 401 })
  if (!(await isApprovedTeacher(teacherId))) return NextResponse.json({ ok: false, message: 'רק מורה מאושר יכול לענות לתלמידים.' }, { status: 403 })
  const { studentId, accept } = (await req.json().catch(() => ({}))) as { studentId?: unknown; accept?: unknown }
  if (typeof studentId !== 'number' || typeof accept !== 'boolean') return NextResponse.json({ ok: false, message: 'בקשה לא תקינה.' }, { status: 400 })
  const changed = await answerStudent(teacherId, studentId, accept)
  if (!changed) return NextResponse.json({ ok: false, message: 'התלמיד כבר לא מחכה לתשובה.' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
