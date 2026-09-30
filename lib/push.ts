// Phone notifications through the browser's own push service (Web Push). No
// third party and no account beyond a key pair: the browser gives us an
// endpoint, and we sign each message with the VAPID key it was subscribed with.
import webpush from 'web-push'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import { db } from './db'

export type PushMessage = { title: string; body: string; url: string; tag: string }

let configured = false

export function vapidPublicKey(): string {
  const key = process.env.THEORYBANK_VAPID_PUBLIC_KEY?.trim()
  if (!key) throw new Error('THEORYBANK_VAPID_PUBLIC_KEY is not set')
  return key
}

function configure() {
  if (configured) return
  const priv = process.env.THEORYBANK_VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.THEORYBANK_VAPID_SUBJECT?.trim()
  if (!priv) throw new Error('THEORYBANK_VAPID_PRIVATE_KEY is not set')
  if (!subject) throw new Error('THEORYBANK_VAPID_SUBJECT is not set')
  webpush.setVapidDetails(subject, vapidPublicKey(), priv)
  configured = true
}

export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } }

export function isSubscription(x: unknown): x is Subscription {
  const s = x as Subscription
  return (
    typeof s?.endpoint === 'string' &&
    s.endpoint.startsWith('https://') &&
    s.endpoint.length <= 700 &&
    typeof s.keys?.p256dh === 'string' &&
    typeof s.keys?.auth === 'string'
  )
}

/** This browser now belongs to this user — whoever it belonged to before. */
export async function saveSubscription(userId: number, s: Subscription): Promise<void> {
  const pool = await db()
  await pool.execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [userId, s.endpoint, s.keys.p256dh, s.keys.auth],
  )
}

export async function dropSubscription(userId: number, endpoint: string): Promise<void> {
  const pool = await db()
  await pool.execute('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, endpoint])
}

export async function subscriptionCount(userId: number): Promise<number> {
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', [userId])
  return rows[0].n as number
}

/**
 * Send to every browser the user turned reminders on in. Returns how many took
 * it. A browser the push service says is gone (404/410) is forgotten; any other
 * failure is logged and left, since it may be the service having a bad minute.
 */
export async function pushToUser(userId: number, message: PushMessage): Promise<number> {
  configure()
  const pool = await db()
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId])
  let delivered = 0
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(message),
        { TTL: 60 * 60 * 6, urgency: 'high', topic: message.tag.slice(0, 32) },
      )
      delivered++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await pool.execute<ResultSetHeader>('DELETE FROM push_subscriptions WHERE id = ?', [row.id])
      } else {
        console.error(`[theoryBank] push to user ${userId} failed (${status ?? 'no status'}):`, (e as Error).message)
      }
    }
  }
  return delivered
}
