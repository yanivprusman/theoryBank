import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowForwardIcon, SchoolIcon, SignMark, TimerIcon, TrafficIcon } from '@/components/icons'
import TeacherForm from '@/components/TeacherForm'

export const metadata: Metadata = {
  title: 'פרסום למורים לנהיגה',
  description: 'מורה לנהיגה? פרסם את עצמך במאגר התאוריה, מול תלמידים שמתכוננים עכשיו למבחן התאוריה ועוד רגע מחפשים מורה.',
}

// Why a teacher would pay to be here — only what the app actually is.
const REASONS = [
  {
    Icon: SchoolIcon,
    title: 'תלמידים לפני השיעור הראשון',
    body: 'מי שפותח את המאגר מתכונן עכשיו לתאוריה. השלב הבא שלו הוא למצוא מורה לנהיגה.',
  },
  {
    Icon: TimerIcon,
    title: 'חוזרים שוב ושוב',
    body: 'תרגול ומבחנים כמו האמיתי: לומדים כאן כמה פעמים עד המבחן, לא נכנסים ויוצאים.',
  },
  {
    Icon: TrafficIcon,
    title: 'לפי סוג הרישיון',
    body: 'כל תלמיד בוחר רישיון — B, A, C1 ועוד — כך שהמודעה מגיעה למי שלומד בדיוק את מה שאתה מלמד.',
  },
]

const STEPS = [
  { title: 'משאירים פרטים', body: 'בטופס כאן למטה. לוקח דקה.' },
  { title: 'מדברים', body: 'אחזור אליך בטלפון או בוואטסאפ, נסגור איפה המודעה מופיעה, לכמה זמן ובאיזה מחיר.' },
  { title: 'משלמים ועולים לאוויר', body: 'תקבל קישור לתשלום בביט או באשראי. אחרי התשלום המודעה עולה.' },
]

export default function TeachersPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="on-road bg-linear-to-b from-road-dark to-road text-white">
        <div className="mx-auto flex max-w-[1120px] items-center gap-3 px-4 py-3 md:px-6">
          <Link
            href="/"
            data-id="teachers-home"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl transition-opacity duration-150 ease-rise hover:opacity-85"
          >
            <SignMark size={40} />
            <span className="t-title-lg">מאגר התאוריה</span>
          </Link>
          <Link
            href="/"
            data-id="teachers-back-to-bank"
            className="t-label-lg flex h-11 cursor-pointer items-center gap-1 rounded-full bg-white/16 px-4 transition-[background-color,transform] duration-150 ease-rise hover:bg-white/24 active:scale-[0.97]"
          >
            <ArrowForwardIcon size={18} />
            לתרגול
          </Link>
        </div>

        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-12 md:px-6 md:pt-12 md:pb-16">
          <p className="t-label-lg text-highlight">למורים לנהיגה</p>
          <h1 className="t-display mt-2 max-w-[18ch] text-balance md:text-[44px] md:leading-[52px]">
            התלמידים הבאים שלך כבר לומדים כאן תאוריה
          </h1>
          <p className="t-body-lg mt-4 max-w-[52ch] text-white/85">
            מאגר התאוריה הוא כל 1,802 השאלות הרשמיות, לוח התמרורים, תרגול ומבחן כמו האמיתי — באתר ובאפליקציה. פרסם את עצמך
            בדיוק ברגע שבו הם מתחילים לחפש מורה.
          </p>
          <a
            href="#contact"
            data-id="teachers-jump-to-form"
            className="t-label-lg mt-7 inline-flex h-12 cursor-pointer items-center rounded-xl bg-highlight px-6 text-ink transition-[filter,transform] duration-150 ease-rise hover:brightness-95 active:scale-[0.97]"
          >
            אני רוצה לפרסם
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-[1120px] px-4 py-12 md:px-6" aria-labelledby="why">
          <h2 id="why" className="t-headline">
            למה לפרסם כאן
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {REASONS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-[18px] border border-line bg-white p-5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-road-soft text-road">
                  <Icon />
                </span>
                <h3 className="t-title mt-4">{title}</h3>
                <p className="t-body-lg mt-1 text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-white" aria-labelledby="how">
          <div className="mx-auto max-w-[1120px] px-4 py-12 md:px-6">
            <h2 id="how" className="t-headline">
              איך זה עובד
            </h2>
            <ol className="mt-6 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="t-title flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="t-title">{step.title}</h3>
                    <p className="t-body-lg mt-1 text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-[720px] scroll-mt-4 px-4 py-12" aria-labelledby="contact-title">
          <h2 id="contact-title" className="t-headline">
            השאר פרטים ואחזור אליך
          </h2>
          <p className="t-body-lg mt-2 text-ink-soft">בלי התחייבות. המחיר נקבע אחרי שיחה קצרה, לפי המיקום ומשך הפרסום.</p>
          <TeacherForm />
        </section>
      </main>
    </div>
  )
}
