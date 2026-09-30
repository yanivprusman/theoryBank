// A driving teacher who wants to advertise here. The inquiry is the whole point
// of the teachers page, so it is written to disk FIRST (append-only ndjson) and
// announced SECOND (WhatsApp to the owner through the shared bridge). An
// announcement that cannot be delivered is logged and recorded with
// delivered:false — the inquiry itself is never lost, and nothing retries
// through some other channel.
import fs from 'node:fs'
import path from 'node:path'
import { bridgeFromEnv, sendText, WaBridgeConfigError } from '@automatelinux/wa-bridge'

export const DATA_DIR = process.env.THEORYBANK_DATA_DIR?.trim() || '/opt/automateLinux/data/theoryBank'
const INQUIRIES_FILE = () => path.join(DATA_DIR, 'advertiser-inquiries.ndjson')
const NOTIFICATIONS_FILE = () => path.join(DATA_DIR, 'advertiser-notifications.ndjson')

export const FIELD_LIMITS = { name: 60, area: 60, school: 80, message: 1000 } as const

export type Inquiry = {
  id: string
  ts: string
  name: string
  phone: string
  area: string
  school: string
  licenses: string[]
  message: string
  userAgent: string
}

/** Israeli mobile or landline → digits starting with 0. Null for anything else. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '')
  if (/^0\d{8,9}$/.test(d)) return d
  if (/^972\d{8,9}$/.test(d)) return `0${d.slice(3)}`
  return null
}

function newId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `${stamp}-${Math.random().toString(36).slice(2, 6)}`
}

/** Persist the inquiry. Throws on I/O failure — the route answers 500. */
export function saveInquiry(input: Omit<Inquiry, 'id' | 'ts'>): Inquiry {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const inquiry: Inquiry = { id: newId(), ts: new Date().toISOString(), ...input }
  fs.appendFileSync(INQUIRIES_FILE(), JSON.stringify(inquiry) + '\n')
  return inquiry
}

function waLink(phone: string): string {
  return `https://wa.me/972${phone.slice(1)}`
}

/** What the owner reads on WhatsApp — enough to call back without opening anything.
 *  The last line is a ready `d charge` for the payment link once a price is agreed;
 *  the name is stripped of anything a shell would act on, since it gets pasted. */
export function inquiryCard(q: Inquiry): string {
  return [
    '🚗 מורה לנהיגה רוצה לפרסם במאגר התאוריה',
    '',
    `👤 ${q.name}`,
    `📞 ${q.phone} · ${waLink(q.phone)}`,
    q.area ? `📍 ${q.area}` : null,
    q.school ? `🏫 ${q.school}` : null,
    q.licenses.length > 0 ? `🪪 רישיונות: ${q.licenses.join(', ')}` : null,
    q.message ? `💬 ${q.message}` : null,
    '',
    `לגבייה: d charge --to ${q.phone} --amount <סכום> --for "פרסום במאגר התאוריה" --name "${q.name.replace(/["`$\\]/g, '')}"`,
    `🆔 ${q.id}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

function recordNotification(entry: Record<string, unknown>) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.appendFileSync(NOTIFICATIONS_FILE(), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch (e) {
    console.error('[theoryBank] could not record notification outcome:', e)
  }
}

/** Tell the owner. Never throws; the outcome is returned and recorded. */
export async function announceInquiry(q: Inquiry): Promise<{ delivered: boolean; error?: string }> {
  let cfg
  let owner
  try {
    cfg = bridgeFromEnv('THEORYBANK')
    owner = process.env.THEORYBANK_OWNER_WA?.trim()
    if (!owner) throw new WaBridgeConfigError('THEORYBANK_OWNER_WA is not set')
  } catch (e) {
    const error = (e as Error).message
    console.error(`[theoryBank] INQUIRY NOT ANNOUNCED — ${q.id} saved but the owner was NOT told: ${error}`)
    recordNotification({ inquiryId: q.id, delivered: false, error })
    return { delivered: false, error }
  }
  try {
    await sendText(cfg, owner, inquiryCard(q))
    recordNotification({ inquiryId: q.id, delivered: true })
    return { delivered: true }
  } catch (e) {
    const error = (e as Error).message
    console.error(`[theoryBank] INQUIRY ANNOUNCEMENT FAILED — ${q.id} saved but not delivered: ${error}`)
    recordNotification({ inquiryId: q.id, delivered: false, error })
    return { delivered: false, error }
  }
}
