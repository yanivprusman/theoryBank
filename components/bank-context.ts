'use client'

import { createContext, useContext } from 'react'
import type { Bank, Question, Sign, SignBook } from '@/lib/bank'
import type { Exam, Practice } from '@/lib/sessions'

export type BankContext = {
  bank: Bank
  license: string
  // The questions asked for the chosen licence — what every screen works on.
  questions: Question[]
  book: SignBook
  practice: Practice
  exam: Exam
  // Opens a sign's page from anywhere a sign shows up.
  openSign: (sign: Sign) => void
}

export const BankCtx = createContext<BankContext | null>(null)

export function useBank(): BankContext {
  const ctx = useContext(BankCtx)
  if (!ctx) throw new Error('useBank: no bank loaded above this component')
  return ctx
}
