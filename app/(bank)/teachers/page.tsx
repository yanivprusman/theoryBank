import type { Metadata } from 'next'
import { MODES } from '@/lib/modes'

export const metadata: Metadata = {
  title: MODES.find((m) => m.id === 'teachers')!.tabTitle,
  description: 'מורים לנהיגה לתלמידים שמתכוננים לתאוריה — ולמורים: איך להופיע ברשימה.',
}

// The screen itself is drawn by the shell, from the address (see BankApp).
export default function Page() {
  return null
}
