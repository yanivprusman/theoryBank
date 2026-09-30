import type { Metadata } from 'next'
import { MODES } from '@/lib/modes'

export const metadata: Metadata = { title: MODES.find((m) => m.id === 'signs')!.tabTitle }

// The screen itself is drawn by the shell, from the address (see BankApp).
export default function Page() {
  return null
}
