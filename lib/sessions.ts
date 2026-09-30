'use client'

import { useMemo, useState } from 'react'
import { ALL, shuffled, type Question } from './bank'

// ── Practice ────────────────────────────────────────────────────────────────
// Endless shuffled questions, one at a time, with a running score. Held above
// the pages (see BankApp), so the score survives a switch to another tab.

export const REVEALED = -1

export type PracticeState = {
  category: string
  pool: Question[]
  deck: Question[]
  index: number
  // The order the four options are shown in, for the current question.
  order: number[]
  // The option picked, REVEALED for "show me the answer", null while choosing.
  picked: number | null
  answered: number
  correct: number
  streak: number
}

const optionOrder = () => shuffled([0, 1, 2, 3])

function deal(pool: Question[], category: string): PracticeState {
  return { category, pool, deck: shuffled(pool), index: 0, order: optionOrder(), picked: null, answered: 0, correct: 0, streak: 0 }
}

export type Practice = PracticeState & {
  current: Question | undefined
  revealed: boolean
  choose: (category: string) => void
  restart: () => void
  answer: (option: number) => void
  reveal: () => void
  next: () => void
}

function usePractice(questions: Question[], state: PracticeState, set: (s: PracticeState) => void): Practice {
  return useMemo(() => {
    const current = state.deck[state.index]
    return {
      ...state,
      current,
      revealed: state.picked === REVEALED,
      choose: (category) => set(deal(questions.filter((q) => category === ALL || q.c === category), category)),
      restart: () => set(deal(state.pool, state.category)),
      answer: (option) => {
        if (state.picked !== null || !current) return
        const right = option === current.k
        set({
          ...state,
          picked: option,
          answered: state.answered + 1,
          correct: state.correct + (right ? 1 : 0),
          streak: right ? state.streak + 1 : 0,
        })
      },
      // "Show the correct answer" without guessing: reveals it like a pick would,
      // and counts as a miss — not knowing it is what the stats should show.
      reveal: () => {
        if (state.picked !== null) return
        set({ ...state, picked: REVEALED, answered: state.answered + 1, streak: 0 })
      },
      next: () => {
        const more = state.index + 1 < state.deck.length
        set({
          ...state,
          deck: more ? state.deck : shuffled(state.pool),
          index: more ? state.index + 1 : 0,
          order: optionOrder(),
          picked: null,
        })
      },
    }
  }, [questions, state, set])
}

// ── Exam ────────────────────────────────────────────────────────────────────
// The real computerised test's rules: 30 random questions, 40 minutes,
// at least 26 correct (up to 4 mistakes) to pass.

export const EXAM_SIZE = 30
export const EXAM_SECONDS = 40 * 60
export const PASS_MARK = 26

export type ExamRun = {
  items: Question[]
  orders: number[][]
  picks: (number | null)[]
}

export type ExamState = {
  run: ExamRun | null
  finished: boolean
  index: number
  // The clock is a deadline, not a countdown: a background tab throttles
  // timers, and a counter that ticks late would hand out extra time. While the
  // exam is off screen the clock is stopped and [remainingMs] holds what is left.
  endsAt: number | null
  remainingMs: number
  secondsUsed: number
}

const NO_EXAM: ExamState = { run: null, finished: false, index: 0, endsAt: null, remainingMs: EXAM_SECONDS * 1000, secondsUsed: 0 }

export const examScore = (run: ExamRun) => run.items.filter((q, i) => run.picks[i] === q.k).length

export type Exam = ExamState & {
  license: string
  poolSize: number
  inProgress: boolean
  start: () => void
  pick: (option: number) => void
  goTo: (index: number) => void
  finish: () => void
  leave: () => void
  resumeClock: () => void
  pauseClock: () => void
}

function useExam(license: string, pool: Question[], state: ExamState, set: (update: (s: ExamState) => ExamState) => void): Exam {
  return useMemo(
    () => ({
      ...state,
      license,
      poolSize: pool.length,
      inProgress: state.run !== null && !state.finished,
      start: () => {
        const items = shuffled(pool).slice(0, EXAM_SIZE)
        const run = { items, orders: items.map(() => shuffled([0, 1, 2, 3])), picks: items.map(() => null) }
        set(() => ({ ...NO_EXAM, run }))
      },
      pick: (option) =>
        set((s) => (s.run ? { ...s, run: { ...s.run, picks: s.run.picks.map((p, i) => (i === s.index ? option : p)) } } : s)),
      goTo: (index) => set((s) => (s.run && index >= 0 && index < s.run.items.length ? { ...s, index } : s)),
      finish: () => {
        const now = Date.now()
        set((s) => {
          if (!s.run || s.finished) return s
          const leftMs = s.endsAt === null ? s.remainingMs : Math.max(0, s.endsAt - now)
          return { ...s, finished: true, endsAt: null, remainingMs: leftMs, secondsUsed: EXAM_SECONDS - Math.ceil(leftMs / 1000) }
        })
      },
      leave: () => set(() => NO_EXAM),
      resumeClock: () => {
        const now = Date.now()
        set((s) => (s.run && !s.finished && s.endsAt === null ? { ...s, endsAt: now + s.remainingMs } : s))
      },
      pauseClock: () => {
        const now = Date.now()
        set((s) => (s.endsAt === null ? s : { ...s, endsAt: null, remainingMs: Math.max(0, s.endsAt - now) }))
      },
    }),
    [license, pool, state, set],
  )
}

// Both sessions belong to one licence's questions: a different licence is a
// different bank, so it starts both over.
export function useSessions(license: string, questions: Question[]): { practice: Practice; exam: Exam } {
  const [owner, setOwner] = useState(questions)
  const [practiceState, setPractice] = useState(() => deal(questions, ALL))
  const [examState, setExam] = useState(NO_EXAM)
  if (owner !== questions) {
    setOwner(questions)
    setPractice(deal(questions, ALL))
    setExam(NO_EXAM)
  }
  return {
    practice: usePractice(questions, practiceState, setPractice),
    exam: useExam(license, questions, examState, setExam),
  }
}
