'use client'

import { partColor, type Sign } from '@/lib/bank'
import { useBank } from './bank-context'
import { Sheet } from './Dialog'
import { AnswerLine, Panel, QuestionHeader, QuestionPicture, SignPicture, Tag } from './ui'

// A sign's page: picture, its meaning, where it applies, and every question
// (for the chosen licence) that names or pictures it, with the correct answer.
export function SignSheet({ sign, onDismiss }: { sign: Sign; onDismiss: () => void }) {
  const { book } = useBank()
  const questions = book.questionsFor(sign)
  return (
    // A tap on another sign inside the sheet swaps the sign: start it from the top.
    <Sheet id="sign-sheet" label="לוח התמרורים" scrollKey={sign.n} onDismiss={onDismiss}>
      <div className="space-y-3 px-4 pb-8">
        <div className="flex flex-col items-center">
          {/* The table's pictures are drawn on white. */}
          <div className="rounded-[18px] border border-line bg-white p-3">
            <SignPicture sign={sign} size={150} lazy={false} />
          </div>
          <h2 className="t-headline-sm mt-2.5">תמרור {sign.n}</h2>
          <div className="mt-1.5">
            <Tag color={partColor(sign.p)}>{sign.p}</Tag>
          </div>
        </div>
        <Panel>
          {sign.s ? (
            <>
              <p className="t-title">{sign.s}</p>
              <Label className="mt-3">הנוסח הרשמי</Label>
            </>
          ) : (
            <Label>פירושו</Label>
          )}
          <p className="t-body-lg">{sign.t}</p>
          {sign.w !== '' && (
            <>
              <Label className="mt-3">כוחו יפה</Label>
              <p className="t-body-lg">{sign.w}</p>
            </>
          )}
        </Panel>
        {questions.length > 0 && (
          <>
            <p className="t-title-sm pt-1 text-ink-soft">
              {questions.length === 1 ? 'שאלה אחת על התמרור' : `${questions.length} שאלות על התמרור`}
            </p>
            {questions.map((q) => (
              <Panel key={q.n}>
                <QuestionHeader item={q} />
                <QuestionPicture item={q} signsOpen />
                <AnswerLine item={q} />
              </Panel>
            ))}
          </>
        )}
      </div>
    </Sheet>
  )
}

function Label({ children, className = '' }: { children: string; className?: string }) {
  return <p className={`t-label mb-0.5 text-ink-soft ${className}`}>{children}</p>
}
