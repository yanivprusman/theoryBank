'use client'

import { useEffect, useState } from 'react'
import { LETTERS, formatClock, licenseLabel } from '@/lib/bank'
import { EXAM_SECONDS, EXAM_SIZE, PASS_MARK, examScore, type Exam, type ExamRun } from '@/lib/sessions'
import { useBank } from './bank-context'
import { Confirm, Sheet } from './Dialog'
import { ArrowBackIcon, ArrowForwardIcon, CloseIcon, GridViewIcon, SignMark, TimerIcon } from './icons'
import { Button, COLUMN, ChipRow, OptionButton, Panel, QuestionHeader, QuestionPicture, STUDY_COLUMN, STUDY_SPLIT, ScoreRing } from './ui'
import { useAnswerKeys } from './use-answer-keys'

export default function ExamScreen() {
  const { exam } = useBank()
  if (!exam.run) return <ExamIntro exam={exam} />
  if (exam.finished) return <ExamResult run={exam.run} secondsUsed={exam.secondsUsed} onAgain={exam.leave} />
  return <ExamRunning exam={exam} run={exam.run} />
}

function ExamIntro({ exam }: { exam: Exam }) {
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center px-5 pt-8 pb-10 text-center md:justify-center">
      <SignMark size={88} />
      <h2 className="t-headline mt-4">מוכן למבחן?</h2>
      <p className="t-body-lg mt-1 text-ink-soft">סימולציה של המבחן העיוני הממוחשב · {licenseLabel(exam.license)}</p>
      <div className="mt-6 grid w-full grid-cols-3 gap-2.5">
        <RuleTile value={EXAM_SIZE} label="שאלות" />
        <RuleTile value={EXAM_SECONDS / 60} label="דקות" />
        <RuleTile value={PASS_MARK} label="נכונות לעבור" />
      </div>
      <p className="t-body mt-3.5 text-ink-soft">
        השאלות נבחרות באקראי מתוך {exam.poolSize} שאלות המאגר. אפשר לדלג ולחזור לשאלות עד ההגשה.
      </p>
      <Button tone="road" id="exam-start" onClick={exam.start} className="t-title mt-7 h-14 w-full rounded-2xl">
        התחל מבחן
      </Button>
    </div>
  )
}

function RuleTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white py-4">
      <p className="t-display text-road tabular-nums">{value}</p>
      <p className="t-label text-ink-soft">{label}</p>
    </div>
  )
}

// The clock runs only while the exam is on screen, and it reads a deadline:
// a tab left in the background does not buy time.
function useExamClock(exam: Exam): number {
  const { resumeClock, pauseClock, finish, endsAt, remainingMs } = exam
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    resumeClock()
    return pauseClock
    // The exam object is rebuilt on every change; starting and stopping the
    // clock belongs to this screen appearing and going away, nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (endsAt === null) return
    const tick = () => {
      const time = Date.now()
      setNow(time)
      if (time >= endsAt) finish()
    }
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [endsAt, finish])

  // Never more than was left when the clock last started: `now` is a tick behind.
  const leftMs = endsAt === null ? remainingMs : Math.min(remainingMs, Math.max(0, endsAt - now))
  return Math.ceil(leftMs / 1000)
}

function ExamRunning({ exam, run }: { exam: Exam; run: ExamRun }) {
  const { index } = exam
  const secondsLeft = useExamClock(exam)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const answeredCount = run.picks.filter((p) => p !== null).length
  const last = run.items.length - 1
  const item = run.items[index]

  useAnswerKeys({
    onOption: (position) => exam.pick(run.orders[index][position]),
    onAdvance: () => exam.goTo(index + 1),
    onStep: (direction) => exam.goTo(index + direction),
  })

  // Closing or reloading the tab throws the exam away; the browser asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  const upcoming = run.items[index + 1]?.i
  useEffect(() => {
    if (upcoming) new Image().src = `/bank/img/${upcoming}`
  }, [upcoming])

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar — the same blue as the header. */}
      <div className="on-road sticky top-0 z-30 bg-linear-to-b from-road-dark to-road text-white">
        <div className="mx-auto max-w-[720px] ps-1 pe-3 pt-1 pb-3 md:pe-4 lg:max-w-[1040px] lg:ps-3 lg:pe-6">
          <div className="flex items-center">
            <button
              type="button"
              data-id="exam-quit"
              aria-label="יציאה מהמבחן"
              onClick={() => setConfirmQuit(true)}
              className="grid size-12 cursor-pointer place-items-center rounded-full transition-[background-color,transform] duration-150 ease-rise hover:bg-white/16 active:scale-[0.94]"
            >
              <CloseIcon />
            </button>
            <h2 className="t-title flex-1">
              שאלה {index + 1} מתוך {run.items.length}
            </h2>
            <TimerPill secondsLeft={secondsLeft} />
          </div>
          {/* One segment per question: filled = answered, yellow = current. */}
          <div className="mt-1.5 flex gap-[3px] ps-3" aria-hidden="true">
            {run.picks.map((pick, i) => (
              <span
                key={i}
                className={`h-[5px] flex-1 rounded-full transition-colors duration-200 ease-rise ${
                  i === index ? 'bg-highlight' : pick !== null ? 'bg-white' : 'bg-white/25'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Keyed by question: each one fades in. */}
      <div key={index} className={`${STUDY_COLUMN} ${STUDY_SPLIT} flex-1 animate-fade py-4`}>
        <Panel>
          <QuestionHeader item={item} prefix={`${index + 1}.`} />
          <QuestionPicture item={item} />
        </Panel>
        <div className="mt-3 space-y-2.5 lg:mt-0">
          {run.orders[index].map((option, position) => (
            <OptionButton
              key={option}
              text={item.o[option]}
              letter={LETTERS[position]}
              state={run.picks[index] === option ? 'selected' : 'idle'}
              id={`exam-option-${position}`}
              onClick={() => exam.pick(option)}
            />
          ))}
        </div>
      </div>

      <div data-bottom-bar className="sticky bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[72px] max-w-[720px] items-center gap-2 px-3 md:px-4 lg:max-w-[1040px] lg:px-6">
          <Button tone="outline" id="exam-prev" disabled={index === 0} onClick={() => exam.goTo(index - 1)} className="h-12 px-4">
            <ArrowBackIcon size={18} />
            הקודמת
          </Button>
          <button
            type="button"
            data-id="exam-toggle-grid"
            aria-label="כל השאלות"
            title="כל השאלות"
            onClick={() => setShowGrid(true)}
            className="grid size-12 cursor-pointer place-items-center rounded-full text-ink transition-[background-color,transform] duration-150 ease-rise hover:bg-page active:scale-[0.94]"
          >
            <GridViewIcon />
          </button>
          <p className="t-body-sm hidden flex-1 text-center text-ink-soft pointer-fine:md:block">
            מקשים 1 עד 4 לבחירה · חיצים למעבר בין שאלות
          </p>
          <span className="flex-1 pointer-fine:md:hidden" />
          {index < last ? (
            <Button tone="road" id="exam-next" onClick={() => exam.goTo(index + 1)} className="h-12">
              הבאה
              <ArrowForwardIcon size={18} />
            </Button>
          ) : (
            <Button tone="ok" id="exam-submit" onClick={() => setConfirmSubmit(true)} className="h-12">
              הגשת המבחן
            </Button>
          )}
        </div>
      </div>

      {showGrid && (
        <Sheet id="exam-grid" label="מפת המבחן" tone="white" onDismiss={() => setShowGrid(false)}>
          <div className="px-5 pb-6">
            <QuestionGrid
              run={run}
              index={index}
              answeredCount={answeredCount}
              idPrefix="exam-jump"
              onJump={(i) => {
                exam.goTo(i)
                setShowGrid(false)
              }}
              onSubmit={() => {
                setShowGrid(false)
                setConfirmSubmit(true)
              }}
            />
          </div>
        </Sheet>
      )}
      {confirmSubmit && (
        <Confirm
          id="exam-confirm-submit"
          title="להגיש את המבחן?"
          text={
            answeredCount < run.items.length
              ? `לא ענית על ${run.items.length - answeredCount} שאלות. שאלה שלא נענתה נחשבת טעות.`
              : 'ענית על כל השאלות. בהצלחה!'
          }
          confirmLabel="הגשה"
          dismissLabel="חזרה למבחן"
          onConfirm={() => {
            setConfirmSubmit(false)
            exam.finish()
          }}
          onDismiss={() => setConfirmSubmit(false)}
        />
      )}
      {confirmQuit && (
        <Confirm
          id="exam-confirm-quit"
          title="לצאת מהמבחן?"
          text="התשובות שלך לא יישמרו."
          confirmLabel="יציאה"
          dismissLabel="המשך במבחן"
          danger
          onConfirm={() => {
            setConfirmQuit(false)
            exam.leave()
          }}
          onDismiss={() => setConfirmQuit(false)}
        />
      )}
    </div>
  )
}

function TimerPill({ secondsLeft }: { secondsLeft: number }) {
  const urgent = secondsLeft < 5 * 60
  return (
    <div
      role="timer"
      aria-label="הזמן שנותר"
      className={`t-label-lg flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold tabular-nums transition-colors duration-200 ease-rise ${
        urgent ? 'bg-bad' : 'bg-white/16'
      }`}
    >
      <TimerIcon size={16} />
      {formatClock(secondsLeft)}
    </div>
  )
}

function QuestionGrid({
  run,
  index,
  answeredCount,
  idPrefix,
  onJump,
  onSubmit,
}: {
  run: ExamRun
  index: number
  answeredCount: number
  idPrefix: string
  onJump: (index: number) => void
  onSubmit: () => void
}) {
  return (
    <>
      <h3 className="t-title-lg">כל השאלות</h3>
      <p className="t-body-lg text-ink-soft">
        ענית על {answeredCount} מתוך {run.items.length}
      </p>
      <div className="mt-4 grid grid-cols-6 justify-items-center gap-y-2.5">
        {run.picks.map((pick, i) => (
          <button
            key={i}
            type="button"
            data-id={`${idPrefix}-${i + 1}`}
            aria-label={`שאלה ${i + 1}${pick !== null ? ', נענתה' : ''}`}
            aria-current={i === index ? 'step' : undefined}
            onClick={() => onJump(i)}
            className={`grid size-[46px] cursor-pointer place-items-center rounded-full border font-semibold tabular-nums transition-[background-color,border-color,box-shadow,transform] duration-150 ease-rise active:scale-[0.94] ${
              pick !== null ? 'border-road bg-road text-white hover:bg-road-dark' : 'border-line bg-white text-ink hover:border-line-strong hover:bg-page'
            } ${i === index ? 'shadow-[0_0_0_3px_var(--color-highlight)]' : ''}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <Button tone="ok" id={`${idPrefix}-submit`} onClick={onSubmit} className="mt-5 h-[52px] w-full rounded-[14px]">
        הגשת המבחן
      </Button>
    </>
  )
}

const REVIEW_CHIPS = { mistakes: 'mistakes', all: 'all' } as const

function ExamResult({ run, secondsUsed, onAgain }: { run: ExamRun; secondsUsed: number; onAgain: () => void }) {
  const score = examScore(run)
  const passed = score >= PASS_MARK
  const color = passed ? 'var(--color-ok-ink)' : 'var(--color-bad-ink)'
  const mistakes = run.items.flatMap((q, i) => (run.picks[i] === q.k ? [] : [i]))
  const allowed = run.items.length - PASS_MARK
  const [review, setReview] = useState<string>(REVIEW_CHIPS.mistakes)
  const reviewed = review === REVIEW_CHIPS.mistakes ? mistakes : run.items.map((_, i) => i)

  return (
    <div className={`${COLUMN} space-y-3 pt-4 pb-8`}>
      <Panel className="flex flex-col items-center text-center">
        <ScoreRing fraction={score / run.items.length} color={color} size={150}>
          <p className="t-display tabular-nums" style={{ color }}>
            {score}
          </p>
          <p className="t-label text-ink-soft">מתוך {run.items.length}</p>
        </ScoreRing>
        <h2 className="t-headline mt-3.5" style={{ color }}>
          {passed ? 'עברת! 🎉' : 'הפעם לא עברת'}
        </h2>
        <p className="t-body-lg text-ink-soft">
          {passed
            ? `כל הכבוד, ${mistakes.length} טעויות מתוך ${allowed} מותרות`
            : `${mistakes.length} טעויות, מותר עד ${allowed}. עבור על הטעויות ונסה שוב`}
        </p>
        <p className="t-body-sm mt-1 text-ink-soft">זמן: {formatClock(secondsUsed)} דקות</p>
        <Button tone="road" id="exam-again" onClick={onAgain} className="mt-4 h-[50px] w-full rounded-[14px]">
          מבחן חדש
        </Button>
      </Panel>
      <ChipRow
        chips={[
          { value: REVIEW_CHIPS.mistakes, id: 'review-mistakes', label: `הטעויות (${mistakes.length})` },
          { value: REVIEW_CHIPS.all, id: 'review-all', label: 'כל השאלות' },
        ]}
        selected={review}
        label="מה לעבור עליו"
        onSelect={setReview}
      />
      {reviewed.length === 0 && <p className="t-title p-4 text-center">אין טעויות, מושלם! 🏆</p>}
      {reviewed.map((i) => {
        const item = run.items[i]
        const pick = run.picks[i]
        return (
          <Panel key={i}>
            <QuestionHeader item={item} prefix={`${i + 1}.`} />
            {pick === null && (
              <p className="t-label-lg mt-1.5 flex items-center gap-1.5 text-ink">
                <span className="size-2 rounded-full bg-bad" />
                לא נענתה
              </p>
            )}
            {/* The review, after the exam — never during it. */}
            <QuestionPicture item={item} signsOpen />
            <div className="mt-3 space-y-2">
              {run.orders[i].map((option, position) => (
                <OptionButton
                  key={option}
                  text={item.o[option]}
                  letter={LETTERS[position]}
                  state={option === item.k ? 'right' : option === pick ? 'wrong' : 'dimmed'}
                  id={`review-${i + 1}-option-${position}`}
                />
              ))}
            </div>
          </Panel>
        )
      })}
    </div>
  )
}
