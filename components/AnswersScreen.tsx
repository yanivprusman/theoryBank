'use client'

import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ALL, CATEGORIES, answerOf, categoryColor, matchesQuestion, type Bank, type Question } from '@/lib/bank'
import { readStored, writeStored } from '@/lib/storage'
import { useBank } from './bank-context'
import { SearchOffIcon } from './icons'
import { ScrollTopButton, StickyToolbar, stuckBottomOf, useListTopOnChange } from './list-tools'
import { AnswerLine, COLUMN, ChipRow, EmptyState, Panel, QuestionHeader, QuestionPicture, SearchField, type Chip } from './ui'

const CATEGORY_IDS = ['all', 'laws', 'signs', 'safety', 'vehicle']

export const categoryChips = (prefix: string): Chip[] =>
  CATEGORIES.map((category, i) => ({
    value: category,
    id: `${prefix}-${CATEGORY_IDS[i]}`,
    dot: category === ALL ? undefined : categoryColor(category),
  }))

const CHIPS = categoryChips('category')

// Where the reader was, kept between visits. It is a question number, not a
// scroll position, so it survives a changed filter or licence: if that question
// is still listed, reading resumes at it.
const ANCHOR_KEY = 'theoryBank.answers.anchorQuestion'

// Reading mode: every question with only its correct answer, in yellow —
// the gov.il page with the "show correct answer" button already pressed.
export default function AnswersScreen() {
  const { questions, license } = useBank()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(ALL)
  // The field answers every keystroke at once; the list follows when it can.
  const listQuery = useDeferredValue(query).trim()

  const shown = useMemo(
    () => questions.filter((item) => (category === ALL || item.c === category) && (listQuery === '' || matchesQuestion(item, listQuery))),
    [questions, category, listQuery],
  )

  const screen = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  // Resuming happens once per visit to this screen — not again when a search
  // that matched nothing is cleared and the list comes back.
  const resumedRef = useRef(false)
  useListTopOnChange(`${license}|${category}|${listQuery}`, screen, bar)

  return (
    <div ref={screen} className="flex flex-1 flex-col">
      <StickyToolbar barRef={bar} column={COLUMN}>
        <SearchField query={query} placeholder="חיפוש מילה או מספר שאלה" id="search-questions" onChange={setQuery} />
        <ChipRow chips={CHIPS} selected={category} label="נושא" onSelect={setCategory} />
      </StickyToolbar>
      {shown.length === 0 ? (
        <EmptyState icon={<SearchOffIcon size={48} />} title="לא נמצאו שאלות" hint="נסו מילה אחרת או מספר שאלה" />
      ) : (
        <div className={`${COLUMN} pb-24`}>
          <p className="t-label pt-0.5 pb-3 text-ink-soft">{shown.length} שאלות</p>
          <AnswerList shown={shown} bar={bar} resumedRef={resumedRef} />
        </div>
      )}
    </div>
  )
}

// 1,802 cards is too many to build at once, so only the ones near the viewport
// exist. The page itself scrolls; the list is a tall box the cards are placed in.
function AnswerList({
  shown,
  bar,
  resumedRef,
}: {
  shown: Question[]
  bar: React.RefObject<HTMLDivElement | null>
  resumedRef: React.RefObject<boolean>
}) {
  const { bank } = useBank()
  const list = useRef<HTMLDivElement>(null)
  // The list's place on the page, its width, and how much of the viewport the
  // stuck toolbar covers — all three move with the window's width.
  const [frame, setFrame] = useState<{ top: number; width: number; covered: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current
      if (!el || !bar.current) return
      const next = { top: el.getBoundingClientRect().top + window.scrollY, width: el.clientWidth, covered: stuckBottomOf(bar.current) }
      setFrame((was) => (was && was.top === next.top && was.width === next.width && was.covered === next.covered ? was : next))
    }
    measure()
    const resized = new ResizeObserver(measure)
    resized.observe(bar.current!)
    resized.observe(document.documentElement)
    return () => resized.disconnect()
  }, [bar])

  const virtualizer = useWindowVirtualizer({
    count: shown.length,
    estimateSize: (i) => estimateHeight(shown[i], frame?.width ?? 0, bank.pictures),
    getItemKey: (i) => shown[i].n,
    gap: 12,
    overscan: 4,
    scrollMargin: frame?.top ?? 0,
    scrollPaddingStart: (frame?.covered ?? 0) + 4,
  })

  // Reopen at the question the reader left off on, as soon as the list knows
  // where it is on the page.
  useLayoutEffect(() => {
    if (resumedRef.current || frame === null) return
    resumedRef.current = true
    const anchor = Number(readStored(ANCHOR_KEY))
    const index = anchor > 0 ? shown.findIndex((q) => q.n === anchor) : -1
    if (index > 0) virtualizer.scrollToIndex(index, { align: 'start' })
  }, [frame, shown, virtualizer, resumedRef])

  // Remember the question at the top of the list — the first one with at least
  // half of it still below the toolbar — once scrolling settles for a moment.
  useEffect(() => {
    let settle = 0
    const remember = () => {
      if (!list.current || !bar.current) return
      const edge = stuckBottomOf(bar.current)
      const cards = list.current.querySelectorAll<HTMLElement>('[data-question]')
      for (const card of cards) {
        const box = card.getBoundingClientRect()
        if (box.top + box.height / 2 > edge) {
          // The very first card means the top of the list: nothing to come back to.
          writeStored(ANCHOR_KEY, card.dataset.index === '0' ? null : card.dataset.question!)
          return
        }
      }
    }
    const onScroll = () => {
      window.clearTimeout(settle)
      settle = window.setTimeout(remember, 300)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(settle)
    }
  }, [bar])

  const items = virtualizer.getVirtualItems()
  const scrolledFar = (items[0]?.index ?? 0) > 4

  return (
    <>
      <div ref={list} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((row) => (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            data-question={shown[row.index].n}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
          >
            <AnswerCard item={shown[row.index]} />
          </div>
        ))}
      </div>
      <ScrollTopButton shown={scrolledFar} />
    </>
  )
}

const AnswerCard = memo(function AnswerCard({ item }: { item: Question }) {
  return (
    <Panel>
      <QuestionHeader item={item} />
      <QuestionPicture item={item} signsOpen />
      <AnswerLine item={item} />
    </Panel>
  )
})

// A card's height before it has been laid out: close enough that the scrollbar
// and a jump to a far question land where they should. Real heights replace
// these as cards are rendered.
function estimateHeight(item: Question, width: number, pictures: Bank['pictures']): number {
  if (width === 0) return 240
  const inner = width - 34
  const lines = (text: string, charWidth: number, room: number) => Math.max(1, Math.ceil((text.length * charWidth) / room))
  let height = 34 + 24 + 10 + lines(item.q, 8.4, inner) * 26
  if (item.i) {
    const [w, h] = pictures[item.i]
    height += 12 + 14 + (Math.min(inner - 14, 460) * h) / w
  }
  return height + 12 + 20 + lines(answerOf(item), 7.8, inner - 68) * 25
}
