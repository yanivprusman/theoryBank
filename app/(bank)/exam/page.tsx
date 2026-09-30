import type { Metadata } from 'next'
import ExamScreen from '@/components/ExamScreen'

export const metadata: Metadata = { title: 'מבחן' }

export default function ExamPage() {
  return <ExamScreen />
}
