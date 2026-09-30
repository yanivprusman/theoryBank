import type { Metadata } from 'next'
import Link from 'next/link'
import { SignMark } from '@/components/icons'

export const metadata: Metadata = { title: 'מדיניות פרטיות' }

// Linked from Google's sign-in screen. Says only what the app actually keeps.
export default function PrivacyPage() {
  return (
    <div className="min-h-dvh">
      <header className="on-road bg-linear-to-b from-road-dark to-road text-white">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3">
          <Link href="/" data-id="privacy-home" className="flex cursor-pointer items-center gap-3 rounded-xl transition-opacity duration-150 ease-rise hover:opacity-85">
            <SignMark size={40} />
            <span className="t-title-lg">מאגר התאוריה</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] space-y-5 px-4 py-8 [&_h2]:t-title-lg [&_p]:t-body-lg [&_li]:t-body-lg [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-6">
        <h1 className="t-headline">מדיניות פרטיות</h1>

        <h2>בלי חשבון</h2>
        <p>
          לימוד, תרגול ומבחנים לא דורשים חשבון. התרגול, התוצאות וסוג הרישיון שבחרת נשמרים רק בדפדפן שלך, ולא נשלחים אלינו.
        </p>

        <h2>עם חשבון Google</h2>
        <p>כניסה עם Google נדרשת רק כדי להצטרף למורה לנהיגה או כדי להופיע כמורה. כשנכנסים, אנחנו שומרים:</p>
        <ul>
          <li>את השם, כתובת המייל ותמונת הפרופיל מחשבון Google שלך.</li>
          <li>אם אתה מורה: הפרטים שמילאת בבקשה — שם, טלפון, אזור, בית ספר, רישיונות והערה. הם מוצגים לכל מי שפותח את לשונית המורים.</li>
          <li>אם אתה תלמיד: לאיזה מורה ביקשת להצטרף. המורה רואה את שמך, המייל ותמונת הפרופיל שלך.</li>
        </ul>
        <p>אנחנו לא מקבלים מ-Google שום מידע אחר, לא מוכרים מידע ולא משתמשים בו לפרסום.</p>

        <h2>מחיקה</h2>
        <p>
          אפשר לעזוב מורה בכל רגע מלשונית המורים. למחיקת החשבון וכל מה שנשמר בו, כתבו אל{' '}
          <a href="mailto:yanivprusman@gmail.com" data-id="privacy-email" dir="ltr" className="cursor-pointer text-road underline-offset-2 hover:underline">
            yanivprusman@gmail.com
          </a>
          .
        </p>
      </main>
    </div>
  )
}
