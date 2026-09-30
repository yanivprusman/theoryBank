// Tells the owner a teacher asked to be listed. The request itself is already
// in the database (lib/accounts.ts) before this runs, so a WhatsApp failure
// loses nothing: it is logged and recorded with delivered:false, never retried
// through another channel, and `scripts/teachers.mjs list` still shows it.
import fs from 'node:fs'
import path from 'node:path'
import { bridgeFromEnv, sendText, WaBridgeConfigError } from '@automatelinux/wa-bridge'
import type { TeacherRequest } from './accounts'

const DATA_DIR = process.env.THEORYBANK_DATA_DIR?.trim() || '/opt/automateLinux/data/theoryBank'
const NOTIFICATIONS_FILE = () => path.join(DATA_DIR, 'teacher-alerts.ndjson')

/** Israeli mobile or landline → digits starting with 0. Null for anything else. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (/^0\d{8,9}$/.test(d)) return d
  if (/^972\d{8,9}$/.test(d)) return `0${d.slice(3)}`
  return null
}

// A name goes into a line the owner pastes into a shell: nothing a shell acts on.
const shellSafe = (s: string) => s.replace(/["`$\\]/g, '')

/** What the owner reads — enough to call back, charge, and approve without opening anything. */
export function requestCard(userId: number, email: string, r: TeacherRequest): string {
  return [
    '🚗 מורה לנהיגה ביקש להופיע במאגר התאוריה',
    '',
    `👤 ${r.name} · ${email}`,
    `📞 ${r.phone} · https://wa.me/972${r.phone.slice(1)}`,
    r.area ? `📍 ${r.area}` : null,
    r.school ? `🏫 ${r.school}` : null,
    r.licenses.length > 0 ? `🪪 רישיונות: ${r.licenses.join(', ')}` : null,
    r.note ? `💬 ${r.note}` : null,
    '',
    `לגבייה: d charge --to ${r.phone} --amount <סכום> --for "הופעה במאגר התאוריה" --name "${shellSafe(r.name)}"`,
    `לאישור אחרי התשלום: scripts/teachers.mjs approve --id ${userId} --until <YYYY-MM-DD>`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

function record(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.appendFileSync(NOTIFICATIONS_FILE(), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch (e) {
    console.error('[theoryBank] could not record alert outcome:', e)
  }
}

/** Never throws; the outcome is returned and recorded. */
export async function alertOwner(userId: number, email: string, r: TeacherRequest): Promise<{ delivered: boolean }> {
  try {
    const cfg = bridgeFromEnv('THEORYBANK')
    const owner = process.env.THEORYBANK_OWNER_WA?.trim()
    if (!owner) throw new WaBridgeConfigError('THEORYBANK_OWNER_WA is not set')
    await sendText(cfg, owner, requestCard(userId, email, r))
    record({ teacherId: userId, delivered: true })
    return { delivered: true }
  } catch (e) {
    const error = (e as Error).message
    console.error(`[theoryBank] TEACHER REQUEST NOT ANNOUNCED — user ${userId} is saved but the owner was not told: ${error}`)
    record({ teacherId: userId, delivered: false, error })
    return { delivered: false }
  }
}
