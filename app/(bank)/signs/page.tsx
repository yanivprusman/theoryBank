import type { Metadata } from 'next'
import SignsScreen from '@/components/SignsScreen'

export const metadata: Metadata = { title: 'לוח התמרורים' }

export default function SignsPage() {
  return <SignsScreen />
}
