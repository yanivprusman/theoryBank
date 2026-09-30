'use client'

import { useEffect } from 'react'
import { LETTERS } from '@/lib/bank'
import type { Practice } from '@/lib/sessions'
import { categoryChips } from './AnswersScreen'
import { useBank } from './bank-context'
import { ArrowForwardIcon, FireIcon, RefreshIcon } from './icons'
import { Button, ChipRow, OptionButton, Panel, QuestionHeader, QuestionPicture, STUDY_COLUMN, STUDY_SPLIT, type OptionState } from './ui'
import { useAnswerKeys } from './use-answer-keys'

const CHIPS = categoryChips('practice-category')

// Practice mode: endless shuffled questions, one at a time. Pick an answer and
// it is marked right or wrong on the spot, with the correct one shown.
export default function PracticeScreen() {
  const { practice } = useBank()
  const item = practice.current

  useAnswerKeys({
    onOption: (position) => practice.answer(practice.order[position]),
    onAdvance: () => {
      if (practice.picked !== null) practice.next()
    },
  })

  // The next picture is fetched while this question is being read, so moving
  // on never waits for it.
  const upcoming = practice.deck[practice.index + 1]?.i
  useEffect(() => {
    if (upcoming) new Image().src = `/bank/img/${upcoming}`
  }, [upcoming])

  return (
    <div className="flex flex-1 flex-col">
      <div className={STUDY_COLUMN}>
        <ChipRow chips={CHIPS} selected={practice.category} label="נושא" onSelect={practice.choose} className="pt-3.5" />
      </div>
      {!item ? (
        <p className="t-body-lg grid flex-1 place-items-center text-ink-soft">אין שאלות בבחירה הזאת</p>
      ) : (
        <>
          <StatsBar practice={practice} />
          {/* Keyed by the question's place in the deck: each new one steps in. */}
          <div key={`${practice.index}-${item.n}`} className={`${STUDY_COLUMN} ${STUDY_SPLIT} animate-step pb-5`}>
            <Panel>
              <QuestionHeader item={item} />
              {/* Signs open only after answering: before, a sign's meaning is the answer. */}
              <QuestionPicture item={item} signsOpen={practice.picked !== null} />
            </Panel>
            <div className="mt-3 space-y-2.5 lg:mt-0">
              {practice.order.map((option, position) => {
                const state: OptionState =
                  practice.picked === null ? 'idle' : option === item.k ? 'right' : option === practice.picked ? 'wrong' : 'dimmed'
                return (
                  <OptionButton
                    key={option}
                    text={item.o[option]}
                    letter={LETTERS[position]}
                    state={state}
                    id={`practice-option-${position}`}
                    onClick={
                      practice.picked === null
                        ? () => {
                            practice.answer(option)
                            // A short tick for right, a longer buzz for wrong, where the device has one.
                            if ('vibrate' in navigator) navigator.vibrate(option === item.k ? 10 : 40)
                          }
                        : undefined
                    }
                  />
                )
              })}
            </div>
          </div>
          <BottomAction practice={practice} />
        </>
      )}
    </div>
  )
}

function StatsBar({ practice }: { practice: Practice }) {
  const percent = practice.answered === 0 ? null : Math.floor((practice.correct * 100) / practice.answered)
  return (
    <div className={`${STUDY_COLUMN} flex items-center gap-2 pb-2.5`}>
      <StatPill label="הצלחה" color="var(--color-road)">
        {percent === null ? '—' : `${percent}%`}
      </StatPill>
      <StatPill label="נכונות" color="var(--color-ok-ink)">
        {practice.correct}/{practice.answered}
      </StatPill>
      <StatPill label="ברצף" color="var(--color-safety-ink)">
        {practice.streak >= 3 && <FireIcon size={16} className="text-safety" />}
        {practice.streak}
      </StatPill>
      <span className="flex-1" />
      <button
        type="button"
        data-id="practice-restart"
        aria-label="התחל מחדש"
        title="התחל מחדש"
        onClick={practice.restart}
        className="grid size-11 cursor-pointer place-items-center rounded-full text-ink-soft transition-[background-color,color,transform] duration-150 ease-rise hover:bg-line hover:text-ink active:scale-[0.94] active:-rotate-45"
      >
        <RefreshIcon />
      </button>
    </div>
  )
}

// The figure is set in its colour; the label under it stays in readable ink.
function StatPill({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[68px] rounded-xl border border-line bg-white px-3 py-1.5 text-center">
      <p className="t-title-sm flex items-center justify-center gap-0.5 font-bold tabular-nums" style={{ color }}>
        {children}
      </p>
      <p className="t-label-sm text-ink-soft">{label}</p>
    </div>
  )
}

// The one place the next step lives: a feedback bar after answering,
// a quiet "skip" before. It keeps its place at the bottom of the screen, so
// "next" is always under the same finger.
function BottomAction({ practice }: { practice: Practice }) {
  const item = practice.current!
  const { picked, revealed } = practice
  const right = picked === item.k
  const tone = picked === null ? 'bg-white' : revealed ? 'bg-highlight-soft' : right ? 'bg-ok-soft' : 'bg-bad-soft'
  return (
    // Edge to edge above the tabs on a phone; a card of its own under the
    // two columns on a wide screen.
    <div
      data-bottom-bar
      className={`sticky bottom-(--nav-h) z-10 mt-auto border-t border-line transition-colors duration-200 ease-rise lg:border-0 lg:bg-transparent lg:pb-4 ${tone}`}
    >
      <div
        className={`mx-auto flex min-h-[72px] w-full max-w-[720px] items-center gap-2 px-4 py-3 transition-colors duration-200 ease-rise lg:w-[calc(100%-3rem)] lg:max-w-[992px] lg:rounded-2xl lg:border lg:border-line lg:shadow-[0_8px_24px_-12px_var(--color-ink-soft)] ${tone}`}
      >
        {picked === null ? (
          <>
            <p className="t-body min-w-0 flex-1 text-ink-soft">
              שאלה {practice.index + 1} מתוך {practice.deck.length}
              <KeyHint>מקשים 1 עד 4 לבחירה</KeyHint>
            </p>
            <Button tone="quiet" id="practice-skip" onClick={practice.next} className="h-11 px-3.5">
              דלג
            </Button>
            <Button tone="quiet" id="practice-reveal" onClick={practice.reveal} className="h-11 px-3.5">
              הצג תשובה נכונה
            </Button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1" role="status">
              <p className={`t-title font-bold ${revealed ? 'text-ink' : right ? 'text-ok-ink' : 'text-bad-ink'}`}>
                {revealed ? 'זו התשובה הנכונה' : right ? 'נכון!' : 'לא נכון'}
              </p>
              <p className="t-body-sm text-ink">
                {revealed ? 'נספרת כטעות בסטטיסטיקה' : right ? encouragement(practice.streak) : 'התשובה הנכונה מסומנת בירוק'}
              </p>
            </div>
            {/* Focused as it appears, so Enter or Space moves on. The key makes it
                a new button: React would otherwise recycle "skip", and a recycled
                element is never auto-focused. */}
            <Button key="next" tone={right ? 'ok' : 'ink'} id="practice-next" onClick={practice.next} className="h-12" autoFocus>
              הבאה
              <ArrowForwardIcon size={18} />
              <KeyHint inline>Enter</KeyHint>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

// Keyboard shortcuts are said out loud only where there is a keyboard.
function KeyHint({ children, inline = false }: { children: string; inline?: boolean }) {
  return inline ? (
    <kbd className="t-label-sm ms-1.5 hidden rounded-md bg-white/20 px-1.5 py-0.5 font-sans pointer-fine:inline">{children}</kbd>
  ) : (
    <span className="hidden pointer-fine:inline"> · {children}</span>
  )
}

function encouragement(streak: number) {
  if (streak >= 10) return `${streak} ברצף, אתה מוכן למבחן`
  if (streak >= 5) return `${streak} ברצף, ממשיכים!`
  if (streak >= 3) return `${streak} תשובות נכונות ברצף`
  return 'יפה מאוד'
}
