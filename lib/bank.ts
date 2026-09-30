// The question bank and the sign table, as the Android app models them
// (mobile/shared/.../data/model) — the same three JSON files, read from the
// same place, so the two apps can never disagree about a question.

// One question from the Ministry of Transport's official theory bank
// (data.gov.il dataset "tqhe"): the question, its four options in the official
// order, the index of the correct one (the one gov.il highlights in yellow), its
// topic, the licence types it is asked for, and an optional picture.
export type Question = {
  n: number
  q: string
  o: string[]
  k: number
  c: string
  l: string[]
  i?: string
}

// One sign from the official sign table (לוח התמרורים, consolidated September
// 2022): its number ("117", "127פ"), the table's part, the official meaning
// (פירושו), where it applies (כוחו יפה; empty for road markings) and its
// picture. [s] is a per-sign wording, present only where the table gives
// several signs one shared meaning ("... בהתאמה").
export type Sign = {
  n: string
  p: string
  t: string
  w: string
  i: string
  s?: string
}

// Where one sign sits inside a question's picture, as fractions of the
// picture's width and height, measured from its LEFT edge.
export type SignSpot = { n: string; x: number; y: number; w: number; h: number }

// Everything the app works on: the three bundled files, plus each question
// picture's pixel size so the page can hold its place before the picture arrives.
export type Bank = {
  questions: Question[]
  signs: Sign[]
  spots: Record<string, SignSpot[]>
  pictures: Record<string, [width: number, height: number]>
}

export const ALL = 'הכל'
export const LICENSES = [ALL, 'C1', 'C', 'B', 'A', 'D', '1']
export const DEFAULT_LICENSE = 'C1'
export const CATEGORIES = [ALL, 'חוקי התנועה', 'תמרורים', 'בטיחות', 'הכרת הרכב']
export const LETTERS = ['א', 'ב', 'ג', 'ד']

export const answerOf = (q: Question) => q.o[q.k]
export const headlineOf = (s: Sign) => s.s ?? s.t
export const isFor = (q: Question, license: string) => license === ALL || q.l.includes(license)
export const licenseLabel = (option: string) => (option === ALL ? 'כל הרישיונות' : `רישיון ${option}`)

// Each topic keeps one colour everywhere it appears.
export function categoryColor(category: string): string {
  switch (category) {
    case 'חוקי התנועה': return 'var(--color-road)'
    case 'תמרורים': return 'var(--color-sign)'
    case 'בטיחות': return 'var(--color-safety)'
    case 'הכרת הרכב': return 'var(--color-vehicle)'
    default: return 'var(--color-ink-soft)'
  }
}

// The table's parts, in its own order, each in the colour its signs are drawn in.
export const SIGN_PARTS = [
  'אזהרה והתראה', 'הוריה', 'זכות קדימה', 'איסורים והגבלות', 'תחבורה ציבורית',
  'מודיעין והדרכה', 'רמזורים ובקרת נתיבים', 'סימון על פני הדרך', 'אתר עבודה',
]

export function partColor(part: string): string {
  switch (part) {
    case 'אזהרה והתראה':
    case 'איסורים והגבלות': return 'var(--color-sign)'
    case 'הוריה':
    case 'מודיעין והדרכה': return 'var(--color-road)'
    case 'זכות קדימה': return 'var(--color-priority)'
    case 'תחבורה ציבורית': return 'var(--color-transit)'
    case 'רמזורים ובקרת נתיבים': return 'var(--color-ok)'
    case 'סימון על פני הדרך': return 'var(--color-marking)'
    case 'אתר עבודה': return 'var(--color-safety)'
    default: return 'var(--color-ink-soft)'
  }
}

export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// A number searches by question number (prefix, so "13" narrows as you type);
// anything else searches the question and answer text.
export function matchesQuestion(item: Question, q: string): boolean {
  if (/^\d+$/.test(q)) return String(item.n).startsWith(q.replace(/^0+/, '') || '0')
  return item.q.includes(q) || answerOf(item).includes(q)
}

// A number searches by sign number (prefix, so "12" narrows as you type);
// anything else searches the wording.
export function matchesSign(s: Sign, q: string): boolean {
  if (/^\d/.test(q)) return s.n.startsWith(q)
  return s.t.includes(q) || s.w.includes(q) || (s.s?.includes(q) ?? false)
}

// Questions whose picture still uses the pre-2011 numbering, checked by eye
// against the 2022 table (question -> printed number -> today's number). The
// question text stays as the ministry publishes it; only the link follows the
// sign actually pictured. 1803: its winding road is labelled 107, today's 106
// (107 is now the chevron board).
const OLD_NUMBERS: Record<number, Record<string, string>> = { 1803: { '107': '106' } }

// Signs by number, and which questions are about which sign: those that name it
// and those that picture it (see [pictured]). A question names a sign when it
// says "תמרור 117", or when its answer options are sign numbers
// ("209 / 212 / 207 / 208") AND it has a picture of those signs — without one a
// bare number is a quantity: question 1687's "110" is 110 km/h, not sign 110.
export class SignBook {
  private readonly byNumber: Map<string, Sign>
  private readonly questionsBySign = new Map<string, Question[]>()

  constructor(
    readonly signs: Sign[],
    questions: Question[],
    private readonly spots: Record<string, SignSpot[]>,
  ) {
    this.byNumber = new Map(signs.map((s) => [s.n, s]))
    for (const q of questions) {
      const about = new Set([...this.mentioned(q), ...this.pictured(q).map(([sign]) => sign)])
      for (const sign of about) {
        const list = this.questionsBySign.get(sign.n)
        if (list) list.push(q)
        else this.questionsBySign.set(sign.n, [q])
      }
    }
  }

  sign(n: string): Sign | undefined {
    return this.byNumber.get(n)
  }

  mentioned(q: Question): Sign[] {
    const inText = Array.from(q.q.matchAll(/תמרור(?:ים)?\s+(\d{3}פ?)/g), (m) => m[1])
    const asOptions = q.i ? q.o.map((o) => o.trim().replace(/\.+$/, '')) : []
    const renumbered = OLD_NUMBERS[q.n] ?? {}
    const numbers = new Set([...inText, ...asOptions].map((n) => renumbered[n] ?? n))
    return Array.from(numbers, (n) => this.byNumber.get(n)).filter((s): s is Sign => s !== undefined)
  }

  // The signs drawn in a question's picture, each with where it sits.
  pictured(q: Question): [Sign, SignSpot][] {
    if (!q.i) return []
    return (this.spots[q.i] ?? []).flatMap((spot) => {
      const sign = this.byNumber.get(spot.n)
      return sign ? [[sign, spot] as [Sign, SignSpot]] : []
    })
  }

  questionsFor(sign: Sign): Question[] {
    return this.questionsBySign.get(sign.n) ?? []
  }
}
