import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Bank, Question } from './bank'

// The bank lives once, inside the Android app's assets. The browser fetches the
// same files through public/bank, a symlink to this directory.
const ASSETS = path.join(process.cwd(), 'mobile/app/src/main/assets')

// Width and height from a JPEG's frame header (the SOFn segment).
function jpegSize(data: Buffer, file: string): [number, number] {
  let i = 2
  while (i + 9 < data.length) {
    if (data[i] !== 0xff) throw new Error(`${file}: not a JPEG segment at byte ${i}`)
    const marker = data[i + 1]
    if (marker === 0xff) { i++; continue } // fill byte
    const isFrameHeader = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isFrameHeader) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)]
    i += 2 + data.readUInt16BE(i + 2)
  }
  throw new Error(`${file}: no JPEG frame header`)
}

// The pixel size of every question picture, so the page can hold a picture's
// place before it arrives: nothing jumps under a finger about to tap an answer.
// A question that names a picture the assets don't hold fails here, loudly.
//
// Synchronous on purpose (about 10ms for all 599). An awaiting layout streams:
// the shell goes out first, the browser starts hydrating, and in `next dev` the
// layout's own chunk — asked for while the document was still arriving — was
// cancelled on about every other hard load in headless Chrome (ChunkLoadError,
// blank page).
export function pictureSizes(): Bank['pictures'] {
  const questions = JSON.parse(readFileSync(path.join(ASSETS, 'questions.json'), 'utf8')) as Question[]
  const files = questions.flatMap((q) => (q.i ? [q.i] : []))
  return Object.fromEntries(files.map((file) => [file, jpegSize(readFileSync(path.join(ASSETS, 'img', file)), file)]))
}
