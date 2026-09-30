'use client'

import { memo, useDeferredValue, useMemo, useRef, useState } from 'react'
import { ALL, SIGN_PARTS, headlineOf, matchesSign, partColor, type Sign } from '@/lib/bank'
import { useBank } from './bank-context'
import { SearchOffIcon } from './icons'
import { StickyToolbar, useListTopOnChange } from './list-tools'
import { ChipRow, EmptyState, SearchField, SignPicture, type Chip } from './ui'

const PART_IDS = ['warning', 'instruction', 'priority', 'prohibition', 'transit', 'information', 'signals', 'markings', 'roadworks']

const CHIPS: Chip[] = [
  { value: ALL, id: 'sign-part-all' },
  ...SIGN_PARTS.map((part, i) => ({ value: part, id: `sign-part-${PART_IDS[i]}`, dot: partColor(part) })),
]

// Signs are short rows, so a wide screen gets more of them side by side.
const WIDE = 'mx-auto w-full max-w-[1120px] px-4 md:px-6'

// The signs tab: the whole official table, searchable by number or by word.
export default function SignsScreen() {
  const { book, openSign } = useBank()
  const [query, setQuery] = useState('')
  const [part, setPart] = useState(ALL)
  const listQuery = useDeferredValue(query).trim()

  const shown = useMemo(
    () => book.signs.filter((s) => (part === ALL || s.p === part) && (listQuery === '' || matchesSign(s, listQuery))),
    [book, part, listQuery],
  )

  const screen = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  useListTopOnChange(`${part}|${listQuery}`, screen, bar)

  return (
    <div ref={screen} className="flex flex-1 flex-col">
      <StickyToolbar barRef={bar} column={WIDE}>
        <div className="md:max-w-[480px]">
          <SearchField query={query} placeholder="חיפוש מספר תמרור או מילה" id="search-signs" onChange={setQuery} />
        </div>
        <ChipRow chips={CHIPS} selected={part} label="חלק בלוח התמרורים" onSelect={setPart} />
      </StickyToolbar>
      {shown.length === 0 ? (
        <EmptyState icon={<SearchOffIcon size={48} />} title="לא נמצאו תמרורים" hint="נסו מספר תמרור או מילה אחרת" />
      ) : (
        <div className={`${WIDE} pb-10`}>
          <p className="t-label pt-0.5 pb-3 text-ink-soft">{shown.length} תמרורים · לוח התמרורים הרשמי, ספטמבר 2022</p>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((sign) => (
              <li key={sign.n}>
                <SignRow sign={sign} asked={book.questionsFor(sign).length} onOpen={openSign} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const SignRow = memo(function SignRow({ sign, asked, onOpen }: { sign: Sign; asked: number; onOpen: (sign: Sign) => void }) {
  return (
    <button
      type="button"
      data-id={`sign-${sign.n}`}
      onClick={() => onOpen(sign)}
      className="flex h-full w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-line bg-white p-3 text-start transition-[border-color,box-shadow,transform] duration-150 ease-rise hover:border-line-strong hover:shadow-[0_4px_16px_-8px_var(--color-ink-soft)] active:scale-[0.99]"
    >
      <SignPicture sign={sign} size={64} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ background: partColor(sign.p) }} />
          <span className="t-title font-bold text-ink">{sign.n}</span>
          {asked > 0 && (
            <span className="t-label-sm rounded-full bg-page px-2 py-0.5 text-ink-soft">
              {asked === 1 ? 'בשאלה אחת' : `ב-${asked} שאלות`}
            </span>
          )}
        </span>
        <span className="t-body mt-0.5 line-clamp-2 text-ink">{headlineOf(sign)}</span>
      </span>
    </button>
  )
})
