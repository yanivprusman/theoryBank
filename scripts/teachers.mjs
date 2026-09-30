#!/usr/bin/env -S node --env-file=.env.local
// Teachers who asked to be listed, and the owner's answer. Run from the app's
// directory, so .env.local picks the database (dev or prod) of that checkout.
//
//   scripts/teachers.mjs list                              who asked, who is listed, until when
//   scripts/teachers.mjs approve --id <id> --until 2026-12-31   after the payment: listed until that day
//   scripts/teachers.mjs extend  --id <id> --until 2027-03-31   another paid period
//   scripts/teachers.mjs decline --id <id>                 not listed; they may ask again
//
// --until is the last day the listing shows (Israel time), inclusive. The id is
// the one in the WhatsApp alert and in `list`.
import mysql from 'mysql2/promise'

function fail(message) {
  console.error(`teachers: ${message}`)
  process.exit(1)
}

function args(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`expected --name value pairs, got "${argv[i]}"`)
    out[argv[i].slice(2)] = argv[i + 1]
  }
  return out
}

const date = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') ? s : fail('--until must be YYYY-MM-DD'))
const id = (s) => (/^\d+$/.test(s ?? '') ? Number(s) : fail('--id must be a number'))

for (const key of ['THEORYBANK_DB_PASSWORD', 'THEORYBANK_DB_NAME']) if (!process.env[key]) fail(`${key} is not set — run from the app's directory`)

const [command, ...rest] = process.argv.slice(2)
const a = args(rest)
const db = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3308,
  user: process.env.THEORYBANK_DB_USER ?? 'theorybank_user',
  password: process.env.THEORYBANK_DB_PASSWORD,
  database: process.env.THEORYBANK_DB_NAME,
  dateStrings: true,
})

async function change(sql, params, done) {
  const [result] = await db.execute(sql, params)
  if (result.affectedRows !== 1) fail(`no teacher with id ${params.at(-1)}${command === 'extend' ? ' who is approved' : ''}`)
  console.log(done)
}

try {
  switch (command) {
    case 'list': {
      const [rows] = await db.execute(
        `SELECT t.user_id, t.status, t.display_name, t.phone, t.area, t.licenses, DATE_FORMAT(t.listed_until, '%Y-%m-%d') AS until,
                u.email, (SELECT COUNT(*) FROM student_teacher s WHERE s.teacher_id = t.user_id AND s.status = 'accepted') AS students
           FROM teachers t JOIN users u ON u.id = t.user_id ORDER BY t.status, t.requested_at`,
      )
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
      if (rows.length === 0) console.log(`no teachers yet (${process.env.THEORYBANK_DB_NAME})`)
      for (const t of rows) {
        const shown = t.status === 'approved' ? (t.until && t.until >= today ? `listed until ${t.until}` : `ended ${t.until ?? '-'}`) : t.status
        console.log(`${t.user_id}\t${shown}\t${t.display_name}\t${t.phone}\t${t.area || '-'}\t[${t.licenses}]\t${t.email}\t${t.students} students`)
      }
      break
    }
    case 'approve':
      await change(
        "UPDATE teachers SET status = 'approved', listed_until = ?, decided_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [date(a.until), id(a.id)],
        `approved ${a.id}, listed until ${a.until}`,
      )
      break
    case 'extend':
      await change("UPDATE teachers SET listed_until = ? WHERE status = 'approved' AND user_id = ?", [date(a.until), id(a.id)], `${a.id} listed until ${a.until}`)
      break
    case 'decline':
      await change(
        "UPDATE teachers SET status = 'declined', listed_until = NULL, decided_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [id(a.id)],
        `declined ${a.id}`,
      )
      break
    default:
      fail('usage: teachers.mjs list | approve --id --until | extend --id --until | decline --id')
  }
} finally {
  await db.end()
}
