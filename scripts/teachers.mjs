#!/usr/bin/env node
// The teachers tab's list, kept by hand. A teacher appears once they have paid.
//
//   scripts/teachers.mjs list
//   scripts/teachers.mjs add --name "ישראל ישראלי" --phone 0501234567 --until 2026-12-31 \
//       [--area "באר שבע"] [--school "..."] [--licenses B,A] [--note "..."]
//   scripts/teachers.mjs extend --id <id> --until 2027-03-31
//   scripts/teachers.mjs remove --id <id>
//
// --until is the last day the listing shows (Israel time), inclusive.
// The file is lib/teachers.ts's TEACHERS_FILE; the tab reads it on every visit.
import fs from 'node:fs'
import path from 'node:path'

const DATA_DIR = process.env.THEORYBANK_DATA_DIR?.trim() || '/opt/automateLinux/data/theoryBank'
const FILE = path.join(DATA_DIR, 'teachers.json')
const LICENSES = ['C1', 'C', 'B', 'A', 'D', '1']

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

function load() {
  if (!fs.existsSync(FILE)) return []
  const list = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  if (!Array.isArray(list)) fail(`${FILE} is not a list`)
  return list
}

function save(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(list, null, 2) + '\n')
  fs.renameSync(tmp, FILE)
}

const date = (s, flag) => (/^\d{4}-\d{2}-\d{2}$/.test(s ?? '') ? s : fail(`--${flag} must be YYYY-MM-DD`))

function phone(raw) {
  const d = String(raw ?? '').replace(/\D/g, '')
  if (/^0\d{8,9}$/.test(d)) return d
  if (/^972\d{8,9}$/.test(d)) return `0${d.slice(3)}`
  return fail('--phone must be an Israeli number')
}

const [command, ...rest] = process.argv.slice(2)
const a = args(rest)
const list = load()
const byId = (id) => list.find((t) => t.id === id) ?? fail(`no teacher with id ${id}`)

switch (command) {
  case 'list': {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
    if (list.length === 0) console.log('no teachers yet')
    for (const t of list) {
      const state = t.until >= today ? 'showing' : 'ended'
      console.log(`${t.id}  ${t.name}  ${t.phone}  ${t.area || '-'}  [${t.licenses.join(',')}]  until ${t.until} (${state})`)
    }
    break
  }
  case 'add': {
    const name = (a.name ?? '').trim()
    if (!name) fail('--name is required')
    const licenses = (a.licenses ?? '').split(',').map((l) => l.trim()).filter(Boolean)
    const unknown = licenses.filter((l) => !LICENSES.includes(l))
    if (unknown.length) fail(`unknown licence ${unknown.join(',')} — one of ${LICENSES.join(',')}`)
    const teacher = {
      id: `t${Date.now().toString(36)}`,
      name,
      phone: phone(a.phone),
      area: (a.area ?? '').trim(),
      school: (a.school ?? '').trim(),
      licenses,
      note: (a.note ?? '').trim(),
      until: date(a.until, 'until'),
    }
    list.push(teacher)
    save(list)
    console.log(`added ${teacher.id}: ${teacher.name}, showing until ${teacher.until}`)
    break
  }
  case 'extend': {
    const t = byId(a.id)
    t.until = date(a.until, 'until')
    save(list)
    console.log(`${t.id}: ${t.name} now showing until ${t.until}`)
    break
  }
  case 'remove': {
    const t = byId(a.id)
    save(list.filter((x) => x !== t))
    console.log(`removed ${t.id}: ${t.name}`)
    break
  }
  default:
    fail('usage: teachers.mjs list | add --name --phone --until [--area --school --licenses --note] | extend --id --until | remove --id')
}
