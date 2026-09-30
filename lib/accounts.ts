// Accounts, teachers, and who studies with whom — every read and write of it.
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { SessionUser } from '@automatelinux/google-signin'
import { db } from './db'
import { sessionUser } from './session'

export const TEACHABLE = ['C1', 'C', 'B', 'A', 'D', '1']
export const FIELD_LIMITS = { name: 80, area: 80, school: 80, note: 1000 } as const

// ── Shapes the browser sees ─────────────────────────────────────────────────

// A listed teacher, as the teachers tab shows them.
export type Teacher = {
  id: number
  name: string
  phone: string
  area: string
  school: string
  licenses: string[]
  note: string
}

export type TeacherStatus = 'pending' | 'approved' | 'declined'

export type Me =
  | { signedIn: false }
  | {
      signedIn: true
      user: { id: number; name: string; email: string; picture: string }
      // Set once the user asked to be a teacher.
      teacher: null | { status: TeacherStatus; listedUntil: string | null; listed: boolean }
      // The teacher this user studies with, or asked to.
      myTeacher: null | { id: number; name: string; phone: string; accepted: boolean }
      // For an approved teacher: students who asked, and students who are theirs.
      students: { id: number; name: string; email: string; picture: string; accepted: boolean }[]
    }

// ── Reading ─────────────────────────────────────────────────────────────────

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

const splitLicenses = (s: string) => (s ? s.split(',') : [])

/** Record the sign-in and return the account id. */
export async function upsertUser(u: SessionUser): Promise<number> {
  const pool = await db()
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), email = VALUES(email), name = VALUES(name),
       picture = VALUES(picture), last_seen = CURRENT_TIMESTAMP`,
    [u.sub, u.email, u.name, u.picture],
  )
  return result.insertId
}

/** The signed-in account's id, or null. */
export async function currentUserId(): Promise<number | null> {
  const u = await sessionUser()
  if (!u) return null
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE google_sub = ?', [u.sub])
  // A valid session whose row is gone (deleted by hand): recreate rather than sign out.
  return rows.length > 0 ? (rows[0].id as number) : upsertUser(u)
}

export async function me(): Promise<Me> {
  const u = await sessionUser()
  if (!u) return { signedIn: false }
  const id = await currentUserId()
  const pool = await db()
  const [teacherRows] = await pool.execute<RowDataPacket[]>(
    'SELECT status, DATE_FORMAT(listed_until, "%Y-%m-%d") AS until FROM teachers WHERE user_id = ?',
    [id],
  )
  const [linkRows] = await pool.execute<RowDataPacket[]>(
    `SELECT t.user_id AS id, t.display_name AS name, t.phone, st.status
       FROM student_teacher st JOIN teachers t ON t.user_id = st.teacher_id WHERE st.student_id = ?`,
    [id],
  )
  const teacherRow = teacherRows[0]
  const approved = teacherRow?.status === 'approved'
  let students: Extract<Me, { signedIn: true }>['students'] = []
  if (approved) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.id, u.name, u.email, u.picture, st.status FROM student_teacher st JOIN users u ON u.id = st.student_id
        WHERE st.teacher_id = ? ORDER BY st.status = 'accepted', st.requested_at DESC`,
      [id],
    )
    students = rows.map((r) => ({ id: r.id, name: r.name, email: r.email, picture: r.picture, accepted: r.status === 'accepted' }))
  }
  const link = linkRows[0]
  return {
    signedIn: true,
    user: { id: id!, name: u.name, email: u.email, picture: u.picture },
    teacher: teacherRow
      ? { status: teacherRow.status, listedUntil: teacherRow.until, listed: approved && teacherRow.until !== null && teacherRow.until >= today() }
      : null,
    myTeacher: link ? { id: link.id, name: link.name, phone: link.phone, accepted: link.status === 'accepted' } : null,
    students,
  }
}

/** The teachers tab: approved teachers whose listing runs today. */
export async function listedTeachers(): Promise<Teacher[]> {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT user_id AS id, display_name AS name, phone, area, school, licenses, note FROM teachers
      WHERE status = 'approved' AND listed_until >= ? ORDER BY decided_at`,
    [today()],
  )
  return rows.map((r) => ({ id: r.id, name: r.name, phone: r.phone, area: r.area, school: r.school, licenses: splitLicenses(r.licenses), note: r.note }))
}

// ── Writing ─────────────────────────────────────────────────────────────────

export type TeacherRequest = { name: string; phone: string; area: string; school: string; licenses: string[]; note: string }

/**
 * Ask to be a teacher, or update a request/listing's details. Asking again after
 * a decline puts it back to pending; an approved teacher stays approved.
 */
export async function requestTeacher(userId: number, r: TeacherRequest): Promise<{ firstRequest: boolean }> {
  const pool = await db()
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO teachers (user_id, display_name, phone, area, school, licenses, note) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), phone = VALUES(phone), area = VALUES(area),
       school = VALUES(school), licenses = VALUES(licenses), note = VALUES(note),
       status = IF(status = 'declined', 'pending', status)`,
    [userId, r.name, r.phone, r.area, r.school, r.licenses.join(','), r.note],
  )
  // MySQL reports 1 affected row for an insert, 2 for an update.
  return { firstRequest: result.affectedRows === 1 }
}

export class LinkError extends Error {}

/** A student asks a listed teacher to take them on. Replaces any earlier teacher. */
export async function askTeacher(studentId: number, teacherId: number): Promise<void> {
  if (studentId === teacherId) throw new LinkError('אי אפשר להיות התלמיד של עצמך.')
  const listed = await listedTeachers()
  if (!listed.some((t) => t.id === teacherId)) throw new LinkError('המורה הזה לא מופיע כרגע ברשימה.')
  const pool = await db()
  await pool.execute(
    `INSERT INTO student_teacher (student_id, teacher_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE status = IF(teacher_id = VALUES(teacher_id), status, 'pending'),
       accepted_at = IF(teacher_id = VALUES(teacher_id), accepted_at, NULL),
       requested_at = IF(teacher_id = VALUES(teacher_id), requested_at, CURRENT_TIMESTAMP),
       teacher_id = VALUES(teacher_id)`,
    [studentId, teacherId],
  )
}

/** A student leaves their teacher (or withdraws a request). */
export async function leaveTeacher(studentId: number): Promise<void> {
  const pool = await db()
  await pool.execute('DELETE FROM student_teacher WHERE student_id = ?', [studentId])
}

/** A teacher accepts or declines a student who asked; or removes one of theirs. */
export async function answerStudent(teacherId: number, studentId: number, accept: boolean): Promise<boolean> {
  const pool = await db()
  const [result] = accept
    ? await pool.execute<ResultSetHeader>(
        `UPDATE student_teacher SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP
          WHERE student_id = ? AND teacher_id = ? AND status = 'pending'`,
        [studentId, teacherId],
      )
    : await pool.execute<ResultSetHeader>('DELETE FROM student_teacher WHERE student_id = ? AND teacher_id = ?', [studentId, teacherId])
  return result.affectedRows === 1
}

export async function isApprovedTeacher(userId: number): Promise<boolean> {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>("SELECT 1 FROM teachers WHERE user_id = ? AND status = 'approved'", [userId])
  return rows.length > 0
}
