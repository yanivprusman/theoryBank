// Shared MySQL — accounts, teachers and who studies with whom.
//
// Studying needs none of this: the bank, practice and exams stay in the browser
// and work offline. What lives here is what has to be the same from every device
// and every peer — an account, a teacher's listing, a student's link to their
// teacher. The database is the shared MySQL on 127.0.0.1:3308 (on the leader the
// server itself, on a worker mysql-router), so the app never makes a remote TCP
// connection and a move between peers loses nothing.
import mysql from 'mysql2/promise'

// On globalThis, not a module binding: `next dev` re-evaluates an edited module,
// and each evaluation would open a new pool while the old one's connections
// stayed open — mysql-router allows the whole machine 20.
const globalForPool = globalThis as unknown as { theoryBankPool?: mysql.Pool }

function config(): mysql.PoolOptions {
  const password = process.env.THEORYBANK_DB_PASSWORD
  if (!password) throw new Error('THEORYBANK_DB_PASSWORD is not set')
  const database = process.env.THEORYBANK_DB_NAME
  if (!database) throw new Error('THEORYBANK_DB_NAME is not set')
  return {
    host: '127.0.0.1',
    port: 3308,
    user: process.env.THEORYBANK_DB_USER ?? 'theorybank_user',
    password,
    database,
    waitForConnections: true,
    // Small on purpose: every query is one indexed statement.
    connectionLimit: 4,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true,
  }
}

function pool(): mysql.Pool {
  if (!globalForPool.theoryBankPool) globalForPool.theoryBankPool = mysql.createPool(config())
  return globalForPool.theoryBankPool
}

// Memoized so a cold start's concurrent requests wait on one attempt; a failure
// clears it so the next request tries again.
let ready: Promise<void> | null = null

export async function db(): Promise<mysql.Pool> {
  if (!ready) {
    ready = createSchema().catch((e) => {
      ready = null
      throw e
    })
  }
  await ready
  return pool()
}

async function createSchema() {
  const p = pool()
  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      google_sub VARCHAR(191) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      picture VARCHAR(1024) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // A user who asked to be a teacher. `pending` until the owner approves; the
  // listing shows in the teachers tab while approved and listed_until has not
  // passed (listed_until is the payment's end, inclusive, Israel time).
  await p.execute(`
    CREATE TABLE IF NOT EXISTS teachers (
      user_id INT PRIMARY KEY,
      status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending',
      display_name VARCHAR(80) NOT NULL,
      phone VARCHAR(16) NOT NULL,
      area VARCHAR(80) NOT NULL DEFAULT '',
      school VARCHAR(80) NOT NULL DEFAULT '',
      licenses VARCHAR(64) NOT NULL DEFAULT '',
      note VARCHAR(1000) NOT NULL DEFAULT '',
      listed_until DATE NULL,
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // A student has one teacher at a time — the primary key says so. The student
  // asks (`pending`); the teacher accepts. A declined or left link is deleted.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS student_teacher (
      student_id INT PRIMARY KEY,
      teacher_id INT NOT NULL,
      status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME NULL,
      INDEX idx_teacher (teacher_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // A driving lesson a teacher scheduled for one of their students. starts_at is
  // UTC; the screens show and take Israel time. A cancelled lesson is kept, so
  // the cancellation can be told and the history stays.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teacher_id INT NOT NULL,
      student_id INT NOT NULL,
      starts_at DATETIME NOT NULL,
      note VARCHAR(300) NOT NULL DEFAULT '',
      status ENUM('scheduled', 'cancelled') NOT NULL DEFAULT 'scheduled',
      scheduled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_starts (status, starts_at),
      INDEX idx_teacher (teacher_id, starts_at),
      INDEX idx_student (student_id, starts_at),
      FOREIGN KEY (teacher_id) REFERENCES teachers(user_id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // One row per browser that turned reminders on. A push service answering 404
  // or 410 means the browser dropped it, and the row is deleted.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      endpoint VARCHAR(700) NOT NULL,
      p256dh VARCHAR(200) NOT NULL,
      auth VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_endpoint (endpoint(255)),
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // Which timed reminder went out for which lesson, and when it was due. The
  // row is claimed BEFORE sending, so two servers (or a restart) never send the
  // same reminder twice; `due` ties it to the lesson's time, so moving the
  // lesson makes its reminders due again.
  await p.execute(`
    CREATE TABLE IF NOT EXISTS reminders_sent (
      lesson_id INT NOT NULL,
      kind ENUM('evening', 'soon') NOT NULL,
      due DATETIME NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (lesson_id, kind, due),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
}
