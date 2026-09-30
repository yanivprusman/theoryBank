// Lessons: a teacher schedules them for their students; both are reminded.
//
// Reminders go out the evening before (20:00 Israel time) and two hours before.
// A change — a new lesson, a new time, a cancellation — is told to the student
// at once. A reminder is only sent if the lesson already existed when it fell
// due: whoever booked a lesson for in an hour does not need to be told about it.
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { db } from './db'
import { eveningBefore, fromSql, sayWhen, SOON_MS, toSql } from './israel-time'
import { pushToUser, type PushMessage } from './push'

export type Lesson = {
  id: number
  startsAt: string // ISO, UTC
  note: string
  teacher: { id: number; name: string; phone: string }
  student: { id: number; name: string }
}

export class LessonError extends Error {}

const URL = '/teachers'

const LESSON_COLUMNS = `l.id, DATE_FORMAT(l.starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at, l.note,
  l.teacher_id, t.display_name AS teacher_name, t.phone AS teacher_phone, l.student_id, u.name AS student_name`

const toLesson = (r: RowDataPacket): Lesson => ({
  id: r.id,
  startsAt: fromSql(r.starts_at).toISOString(),
  note: r.note,
  teacher: { id: r.teacher_id, name: r.teacher_name, phone: r.teacher_phone },
  student: { id: r.student_id, name: r.student_name },
})

async function lessonRow(id: number): Promise<Lesson | null> {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${LESSON_COLUMNS} FROM lessons l JOIN teachers t ON t.user_id = l.teacher_id JOIN users u ON u.id = l.student_id
      WHERE l.id = ? AND l.status = 'scheduled'`,
    [id],
  )
  return rows[0] ? toLesson(rows[0]) : null
}

/** Lessons from an hour ago on, where the user is the teacher or the student. */
export async function upcomingLessons(userId: number): Promise<Lesson[]> {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${LESSON_COLUMNS} FROM lessons l JOIN teachers t ON t.user_id = l.teacher_id JOIN users u ON u.id = l.student_id
      WHERE l.status = 'scheduled' AND l.starts_at >= UTC_TIMESTAMP() - INTERVAL 1 HOUR AND (l.teacher_id = ? OR l.student_id = ?)
      ORDER BY l.starts_at LIMIT 100`,
    [userId, userId],
  )
  return rows.map(toLesson)
}

const firstName = (name: string) => name.split(' ')[0]

function tell(userId: number, message: PushMessage) {
  // A notification that does not arrive must not undo the lesson that was saved.
  return pushToUser(userId, message).catch((e) => {
    console.error(`[theoryBank] could not notify user ${userId}:`, e)
    return 0
  })
}

async function assertStudentOf(teacherId: number, studentId: number) {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT 1 FROM student_teacher WHERE teacher_id = ? AND student_id = ? AND status = 'accepted'",
    [teacherId, studentId],
  )
  if (rows.length === 0) throw new LessonError('אפשר לקבוע שיעור רק לתלמיד שאישרת.')
}

function assertFuture(at: Date) {
  if (at.getTime() < Date.now() + 5 * 60 * 1000) throw new LessonError('השעה כבר עברה. בחר זמן עתידי.')
  if (at.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) throw new LessonError('אפשר לקבוע שיעורים עד שנה קדימה.')
}

export async function scheduleLesson(teacherId: number, studentId: number, at: Date, note: string): Promise<Lesson> {
  await assertStudentOf(teacherId, studentId)
  assertFuture(at)
  const pool = await db()
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO lessons (teacher_id, student_id, starts_at, note, scheduled_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
    [teacherId, studentId, toSql(at), note],
  )
  const lesson = (await lessonRow(result.insertId))!
  await tell(studentId, {
    title: 'נקבע לך שיעור נהיגה',
    body: `${sayWhen(at)} עם ${lesson.teacher.name}${note ? ` · ${note}` : ''}`,
    url: URL,
    tag: `lesson-${lesson.id}`,
  })
  return lesson
}

async function ownLesson(teacherId: number, lessonId: number): Promise<Lesson> {
  const lesson = await lessonRow(lessonId)
  if (!lesson || lesson.teacher.id !== teacherId) throw new LessonError('השיעור הזה לא נמצא.')
  return lesson
}

export async function moveLesson(teacherId: number, lessonId: number, at: Date): Promise<void> {
  const lesson = await ownLesson(teacherId, lessonId)
  assertFuture(at)
  const pool = await db()
  // Moving it counts as booking it now: reminders already past their new due time are not sent late.
  await pool.execute('UPDATE lessons SET starts_at = ?, scheduled_at = UTC_TIMESTAMP() WHERE id = ?', [toSql(at), lessonId])
  await tell(lesson.student.id, {
    title: 'שיעור הנהיגה שלך הוזז',
    body: `השיעור עם ${lesson.teacher.name} עבר ל${sayWhen(at)}`,
    url: URL,
    tag: `lesson-${lessonId}`,
  })
}

export async function cancelLesson(teacherId: number, lessonId: number): Promise<void> {
  const lesson = await ownLesson(teacherId, lessonId)
  const pool = await db()
  await pool.execute("UPDATE lessons SET status = 'cancelled' WHERE id = ?", [lessonId])
  await tell(lesson.student.id, {
    title: 'שיעור הנהיגה שלך בוטל',
    body: `השיעור עם ${lesson.teacher.name} ב${sayWhen(new Date(lesson.startsAt))} בוטל`,
    url: URL,
    tag: `lesson-${lessonId}`,
  })
}

// ── The reminder sweep ─────────────────────────────────────────────────────

type Kind = 'evening' | 'soon'

/** The timed reminders due now. Runs every minute (instrumentation.ts). */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const pool = await db()
  // Every lesson whose evening reminder could be due: it starts within about a day and a half.
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT ${LESSON_COLUMNS}, DATE_FORMAT(l.scheduled_at, '%Y-%m-%d %H:%i:%s') AS booked
       FROM lessons l JOIN teachers t ON t.user_id = l.teacher_id JOIN users u ON u.id = l.student_id
      WHERE l.status = 'scheduled' AND l.starts_at > ? AND l.starts_at <= ? + INTERVAL 30 HOUR`,
    [toSql(now), toSql(now)],
  )
  let sent = 0
  for (const row of rows) {
    const lesson = toLesson(row)
    const start = new Date(lesson.startsAt)
    const booked = fromSql(row.booked)
    const soon = new Date(start.getTime() - SOON_MS)
    const evening = eveningBefore(start)
    const due: [Kind, Date][] = []
    if (now >= evening && now < soon && booked <= evening) due.push(['evening', evening])
    if (now >= soon && booked <= soon) due.push(['soon', soon])
    for (const [kind, at] of due) {
      // Claim first: whoever inserts the row sends; a duplicate key means it went already.
      const [claim] = await pool.execute<ResultSetHeader>('INSERT IGNORE INTO reminders_sent (lesson_id, kind, due) VALUES (?, ?, ?)', [
        lesson.id,
        kind,
        toSql(at),
      ])
      if (claim.affectedRows !== 1) continue
      const when = kind === 'evening' ? `מחר, ${sayWhen(start)}` : `בעוד שעתיים, ${sayWhen(start)}`
      await tell(lesson.student.id, {
        title: 'תזכורת: שיעור נהיגה',
        body: `${when} עם ${lesson.teacher.name}${lesson.note ? ` · ${lesson.note}` : ''}`,
        url: URL,
        tag: `lesson-${lesson.id}`,
      })
      await tell(lesson.teacher.id, {
        title: 'תזכורת: שיעור עם תלמיד',
        body: `${when} עם ${firstName(lesson.student.name)}${lesson.note ? ` · ${lesson.note}` : ''}`,
        url: URL,
        tag: `lesson-${lesson.id}`,
      })
      sent++
    }
  }
  return sent
}
