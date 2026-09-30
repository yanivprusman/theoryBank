// The teachers students see in the teachers tab: the ones who paid for a place
// there. The owner adds each one by hand after the payment (scripts/teachers.mjs),
// with the last day the listing runs; after that day it simply stops showing.
import fs from 'node:fs'
import path from 'node:path'
import { DATA_DIR } from './advertisers'

export const TEACHERS_FILE = () => path.join(DATA_DIR, 'teachers.json')

// What the browser gets. The phone is the point: a student calls or WhatsApps it.
export type Teacher = {
  id: string
  name: string
  phone: string
  area: string
  school: string
  licenses: string[]
  note: string
}

type Listing = Teacher & { until: string }

const isListing = (x: unknown): x is Listing => {
  const r = x as Record<string, unknown>
  return (
    typeof r === 'object' &&
    r !== null &&
    ['id', 'name', 'phone', 'area', 'school', 'note', 'until'].every((k) => typeof r[k] === 'string') &&
    Array.isArray(r.licenses) &&
    r.licenses.every((l) => typeof l === 'string')
  )
}

/** Listings running today (Israel time). No file yet means no teachers yet. A broken file throws. */
export function activeTeachers(now = new Date()): Teacher[] {
  let raw: string
  try {
    raw = fs.readFileSync(TEACHERS_FILE(), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error(`${TEACHERS_FILE()}: expected an array`)
  const bad = parsed.findIndex((x) => !isListing(x))
  if (bad !== -1) throw new Error(`${TEACHERS_FILE()}: entry ${bad} is not a listing`)
  const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
  return (parsed as Listing[])
    .filter((l) => l.until >= today)
    .map(({ id, name, phone, area, school, licenses, note }) => ({ id, name, phone, area, school, licenses, note }))
}
