import BankApp from '@/components/BankApp'
import { pictureSizes } from '@/lib/bank-server'

// The four study screens share one shell — and one loaded bank, one practice
// score and one exam — so moving between them never starts anything over.
export default function BankLayout({ children }: { children: React.ReactNode }) {
  return <BankApp pictures={pictureSizes()}>{children}</BankApp>
}
