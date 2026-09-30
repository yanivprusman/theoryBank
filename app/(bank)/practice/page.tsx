import type { Metadata } from 'next'
import PracticeScreen from '@/components/PracticeScreen'

export const metadata: Metadata = { title: 'תרגול' }

export default function PracticePage() {
  return <PracticeScreen />
}
