// Lessons are given in Israel and typed in Israel time; the database keeps UTC.
// These convert between the two without a library, through Intl's own tz data,
// so a lesson on the far side of a DST change still lands on the hour typed.

const ZONE = 'Asia/Jerusalem'

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Israel wall-clock fields of an instant. */
function wall(at: Date) {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) }
}

/** The instant at which Israel's clock reads `date` `time` (YYYY-MM-DD, HH:MM). Null if malformed. */
export function israelToUtc(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  const asUtc = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2])
  // Two passes: the offset at the guess, then at the corrected instant.
  let at = asUtc - (wall(new Date(asUtc)).ms - asUtc)
  at = asUtc - (wall(new Date(at)).ms - at)
  const back = wall(new Date(at))
  return back.date === date && back.time === time ? new Date(at) : null
}

/** Israel date and time of an instant. */
export function utcToIsrael(at: Date): { date: string; time: string } {
  const { date, time } = wall(at)
  return { date, time }
}

/** MySQL DATETIME (UTC) ↔ Date. */
export const toSql = (at: Date) => at.toISOString().slice(0, 19).replace('T', ' ')
export const fromSql = (s: string) => new Date(`${s.replace(' ', 'T')}Z`)

/** 20:00 Israel time on the day before the lesson — when the evening reminder is due. */
export function eveningBefore(start: Date): Date {
  const { date } = wall(start)
  const day = new Date(`${date}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return israelToUtc(day.toISOString().slice(0, 10), '20:00')!
}

export const SOON_MS = 2 * 60 * 60 * 1000

/** "יום שלישי 14.10 בשעה 16:00" — how a lesson's time is said everywhere. */
export function sayWhen(at: Date): string {
  const day = new Intl.DateTimeFormat('he-IL', { timeZone: ZONE, weekday: 'long' }).format(at)
  const { date, time } = wall(at)
  const [, m, d] = date.split('-')
  return `${day} ${+d}.${+m} בשעה ${time}`
}
