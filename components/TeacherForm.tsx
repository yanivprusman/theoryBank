'use client'

import { useState, type FormEvent } from 'react'
import { ALL, LICENSES } from '@/lib/bank'
import { send } from './account'
import { CheckCircleIcon } from './icons'
import { BUTTON, BUTTON_TONE } from './ui'

const TEACHABLE = LICENSES.filter((l) => l !== ALL)

type Sent = { state: 'idle' } | { state: 'sending' } | { state: 'sent' } | { state: 'failed'; message: string; field?: string }

const INPUT =
  't-body-lg mt-1.5 block h-12 w-full rounded-xl border border-line-strong bg-white px-3.5 text-ink transition-[border-color,box-shadow] duration-150 ease-rise placeholder:text-ink-soft/70 hover:border-ink-soft focus:border-road focus:shadow-[inset_0_0_0_1px_var(--color-road)] focus:outline-none aria-invalid:border-bad'

// A signed-in user asks to be listed. [defaultName] is their Google name.
export default function TeacherForm({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [licenses, setLicenses] = useState<string[]>([])
  const [sent, setSent] = useState<Sent>({ state: 'idle' })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const value = (key: string) => String(form.get(key) ?? '')
    setSent({ state: 'sending' })
    const reply = await send('/api/teacher/request', 'POST', {
      name: value('name'),
      phone: value('phone'),
      area: value('area'),
      school: value('school'),
      note: value('note'),
      licenses,
    })
    if (reply.ok) {
      setSent({ state: 'sent' })
      onDone()
    } else {
      setSent({ state: 'failed', message: reply.message, field: reply.field })
    }
  }

  if (sent.state === 'sent') {
    return (
      <div role="status" data-id="teacher-form-sent" className="mt-6 animate-rise rounded-[18px] border border-ok/30 bg-ok-soft p-6 text-center">
        <CheckCircleIcon size={40} className="mx-auto text-ok" />
        <p className="t-headline-sm mt-3">הפרטים התקבלו</p>
        <p className="t-body-lg mt-1 text-ink-soft">אחזור אליך בהקדם בטלפון או בוואטסאפ לגבי המחיר.</p>
      </div>
    )
  }

  const invalid = (field: string) => (sent.state === 'failed' && sent.field === field ? true : undefined)

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-[18px] border border-line bg-white p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="t-label-lg block">
          שם מלא
          <input name="name" required autoComplete="name" maxLength={80} defaultValue={defaultName} data-id="teacher-name" aria-invalid={invalid('name')} className={INPUT} />
        </label>
        <label className="t-label-lg block">
          טלפון
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="050-1234567"
            data-id="teacher-phone"
            aria-invalid={invalid('phone')}
            className={`${INPUT} text-end`}
          />
        </label>
        <label className="t-label-lg block">
          אזור / עיר שבה אתה מלמד
          <input name="area" autoComplete="address-level2" maxLength={80} data-id="teacher-area" className={INPUT} />
        </label>
        <label className="t-label-lg block">
          בית ספר לנהיגה <span className="text-ink-soft">(לא חובה)</span>
          <input name="school" autoComplete="organization" maxLength={80} data-id="teacher-school" className={INPUT} />
        </label>
      </div>

      <fieldset>
        <legend className="t-label-lg">אילו רישיונות אתה מלמד?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEACHABLE.map((license) => {
            const on = licenses.includes(license)
            return (
              <button
                key={license}
                type="button"
                data-id={`teacher-license-${license.toLowerCase()}`}
                aria-pressed={on}
                onClick={() => setLicenses(on ? licenses.filter((l) => l !== license) : [...licenses, license])}
                className={`t-label-lg h-11 min-w-14 cursor-pointer rounded-full border px-4 transition-[background-color,border-color,color,transform] duration-150 ease-rise active:scale-[0.97] ${
                  on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-line-strong hover:bg-page'
                }`}
              >
                {license}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className="t-label-lg block">
        משהו שכדאי שאדע? <span className="text-ink-soft">(לא חובה)</span>
        <textarea name="note" rows={3} maxLength={1000} data-id="teacher-note" className={`${INPUT} h-auto py-3`} />
      </label>

      {sent.state === 'failed' && (
        <p role="alert" data-id="teacher-form-error" className="t-body-lg rounded-xl bg-bad-soft px-3.5 py-2.5 text-bad-ink">
          {sent.message}
        </p>
      )}

      <button
        type="submit"
        data-id="teacher-submit"
        disabled={sent.state === 'sending'}
        className={`${BUTTON} ${BUTTON_TONE.road} h-12 w-full md:w-auto md:px-8`}
      >
        {sent.state === 'sending' ? 'שולח…' : 'שלח בקשה'}
      </button>
    </form>
  )
}
