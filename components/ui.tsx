'use client'

import type { CSSProperties, ReactNode } from 'react'
import { answerOf, categoryColor, type Question, type Sign } from '@/lib/bank'
import { useBank } from './bank-context'
import { CheckCircleIcon, CheckIcon, CloseIcon, PersonIcon, SearchIcon } from './icons'

// A white card on the page, the one container every screen uses.
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[18px] border border-line bg-white p-4 ${className}`}>{children}</div>
}

// The column every screen's content sits in.
export const COLUMN = 'mx-auto w-full max-w-[720px] px-4'

// Practice and exam on a wide screen: the question on one side and its four
// options on the other, so answering never needs a scroll.
export const STUDY_COLUMN = `${COLUMN} lg:max-w-[1040px] lg:px-6`
export const STUDY_SPLIT = 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-5'

export type Chip = { value: string; id: string; label?: string; dot?: string }

export function ChipRow({
  chips,
  selected,
  label,
  onSelect,
  className = '',
}: {
  chips: Chip[]
  selected: string
  label: string
  onSelect: (value: string) => void
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`no-scrollbar flex gap-2 overflow-x-auto py-2.5 md:flex-wrap md:overflow-visible ${className}`}
    >
      {chips.map((chip) => {
        const on = chip.value === selected
        return (
          <button
            key={chip.value}
            type="button"
            data-id={chip.id}
            aria-pressed={on}
            onClick={() => onSelect(chip.value)}
            className={`t-label-lg relative flex shrink-0 cursor-pointer items-center gap-[7px] rounded-full border px-3.5 py-2 transition-[background-color,border-color,color,transform] duration-150 ease-rise after:absolute after:inset-x-0 after:-inset-y-1 active:scale-[0.97] ${
              on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink hover:border-line-strong hover:bg-page'
            }`}
          >
            {chip.dot && <span className="size-2 rounded-full" style={{ background: chip.dot }} />}
            {chip.label ?? chip.value}
          </button>
        )
      })}
    </div>
  )
}

// A coloured dot carries the topic; the words stay in ink so they stay readable.
export function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="t-label inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--tag)_10%,white)] px-2.5 py-1 text-ink"
      style={{ '--tag': color } as CSSProperties}
    >
      <span className="size-[7px] rounded-full bg-(--tag)" />
      {children}
    </span>
  )
}

export function QuestionHeader({ item, prefix }: { item: Question; prefix?: string }) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        {prefix ? (
          <span className="t-label-lg font-bold text-ink-soft">{prefix}</span>
        ) : (
          <span dir="ltr" className="t-label-lg font-bold text-ink-soft">
            #{item.n}
          </span>
        )}
        <Tag color={categoryColor(item.c)}>{item.c}</Tag>
      </div>
      <h3 className="t-title mt-2.5 text-ink">{item.q}</h3>
    </>
  )
}

// The source pictures are only 350px wide. On a phone they fill the card, as in
// the Android app; on a wide screen they stop here rather than blur.
const PICTURE_MAX_WIDTH = 460

// [signsOpen]: a click on a sign drawn in the picture opens that sign. Callers
// pass true only once the answer is known — before, a sign's meaning is the answer.
export function QuestionPicture({ item, signsOpen = false }: { item: Question; signsOpen?: boolean }) {
  const { bank, book, openSign } = useBank()
  if (!item.i) return null
  const [width, height] = bank.pictures[item.i]
  const pictured = signsOpen ? book.pictured(item) : []
  return (
    <div className="mt-3 flex justify-center rounded-xl border border-line bg-white p-1.5">
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: PICTURE_MAX_WIDTH }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a 350px JPEG served as it is; nothing for the optimizer to do */}
        <img
          src={`/bank/img/${item.i}`}
          alt={`איור לשאלה ${item.n}`}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
        />
        {pictured.map(([sign, spot]) => (
          // `left`, not inline-start: the spots are measured from the picture's
          // left edge, and the page runs right-to-left.
          <button
            key={`${sign.n}-${spot.x}-${spot.y}`}
            type="button"
            data-id={`sign-spot-${item.n}-${sign.n}`}
            aria-label={`תמרור ${sign.n}`}
            title={`תמרור ${sign.n}`}
            onClick={() => openSign(sign)}
            className="absolute cursor-pointer rounded-md transition-[background-color,box-shadow] duration-150 ease-rise hover:bg-road/10 hover:shadow-[inset_0_0_0_2px_var(--color-road)] active:bg-road/20"
            style={{
              left: `${spot.x * 100}%`,
              top: `${spot.y * 100}%`,
              width: `${spot.w * 100}%`,
              height: `${spot.h * 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function SignPicture({ sign, size, lazy = true }: { sign: Sign; size: number; lazy?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small PNG from the sign table, served as it is
    <img
      src={`/bank/signs/${encodeURIComponent(sign.i)}`}
      alt={`תמרור ${sign.n}`}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  )
}

// The correct answer, in the yellow gov.il paints it.
export function AnswerLine({ item }: { item: Question }) {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-highlight-soft px-3 py-2.5">
      <span className="mt-0.5 h-[22px] w-1 shrink-0 rounded-sm bg-highlight" />
      <p className="t-body-lg min-w-0 flex-1 text-ink">{answerOf(item)}</p>
      <CheckCircleIcon size={20} className="mt-0.5 text-ok" />
    </div>
  )
}

export type OptionState = 'idle' | 'selected' | 'right' | 'wrong' | 'dimmed'

const OPTION_LOOK: Record<OptionState, { card: string; badge: string }> = {
  idle: { card: 'border-line bg-white', badge: 'border-[1.5px] border-line text-ink-soft' },
  dimmed: { card: 'border-line bg-white', badge: 'border-[1.5px] border-line text-ink-soft/60' },
  selected: { card: 'border-road bg-road-soft shadow-[inset_0_0_0_1px_var(--color-road)]', badge: 'bg-road text-white' },
  right: { card: 'border-ok bg-ok-soft shadow-[inset_0_0_0_1px_var(--color-ok)]', badge: 'bg-ok text-white' },
  wrong: { card: 'border-bad bg-bad-soft shadow-[inset_0_0_0_1px_var(--color-bad)]', badge: 'bg-bad text-white' },
}

// One answer option. Idle/selected while the user is choosing; once revealed
// the correct option turns green, a wrong pick red, and the rest fade back.
export function OptionButton({
  text,
  letter,
  state,
  id,
  onClick,
}: {
  text: string
  letter: string
  state: OptionState
  id: string
  onClick?: () => void
}) {
  const look = OPTION_LOOK[state]
  return (
    <button
      type="button"
      data-id={id}
      disabled={!onClick}
      aria-pressed={state === 'selected' ? true : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[14px] border p-3 text-start transition-[background-color,border-color,box-shadow,transform] duration-150 ease-rise ${look.card} ${
        onClick ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
      } ${onClick && state === 'idle' ? 'hover:border-road/50 hover:bg-road-soft/50' : ''}`}
    >
      <span className={`grid size-[30px] shrink-0 place-items-center rounded-full font-bold ${look.badge}`}>
        {state === 'right' ? <CheckIcon size={18} /> : state === 'wrong' ? <CloseIcon size={18} /> : letter}
      </span>
      <span className={`t-body-lg min-w-0 flex-1 ${state === 'dimmed' ? 'text-ink-soft' : 'text-ink'} ${state === 'right' ? 'font-medium' : ''}`}>
        {text}
      </span>
      {state === 'right' && <span className="sr-only">התשובה הנכונה</span>}
      {state === 'wrong' && <span className="sr-only">התשובה שנבחרה, שגויה</span>}
    </button>
  )
}

// Circular score ring used on the exam result.
export function ScoreRing({ fraction, color, size, children }: { fraction: number; color: string; size: number; children: ReactNode }) {
  const stroke = size * 0.09
  const radius = (size - stroke) / 2
  const around = 2 * Math.PI * radius
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeOpacity={0.15} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={around}
          strokeDashoffset={around * (1 - fraction)}
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  )
}

// Shared by the questions and the signs lists.
export function SearchField({
  query,
  placeholder,
  id,
  onChange,
}: {
  query: string
  placeholder: string
  id: string
  onChange: (query: string) => void
}) {
  return (
    <label className="flex cursor-text items-center gap-2.5 rounded-2xl border border-line bg-white ps-3.5 pe-1 transition-[border-color,box-shadow] duration-150 ease-rise focus-within:border-road focus-within:shadow-[0_0_0_3px_var(--color-road-tint)]">
      <SearchIcon className="text-ink-soft" />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-id={id}
        className="t-body-lg min-w-0 flex-1 bg-transparent py-3.5 text-ink outline-none placeholder:text-ink-soft"
      />
      {query === '' ? (
        <span className="w-2.5" />
      ) : (
        <button
          type="button"
          data-id={`${id}-clear`}
          aria-label="נקה"
          onClick={() => onChange('')}
          className="grid size-11 cursor-pointer place-items-center rounded-full text-ink-soft transition-[background-color,color,transform] duration-150 ease-rise hover:bg-page hover:text-ink active:scale-[0.94]"
        >
          <CloseIcon />
        </button>
      )}
    </label>
  )
}

// Nothing matches: say so, and say what would.
export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <span className="text-ink-soft">{icon}</span>
      <p className="t-title mt-3 text-ink">{title}</p>
      <p className="t-body-lg text-ink-soft">{hint}</p>
    </div>
  )
}

// The main action of a screen, and its quieter sibling.
export const BUTTON = 't-label-lg inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-5 transition-[background-color,border-color,opacity,transform] duration-150 ease-rise active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100'

export const BUTTON_TONE = {
  road: 'bg-road text-white hover:bg-road-dark',
  ink: 'bg-ink text-white hover:bg-road-dark',
  ok: 'bg-ok-ink text-white hover:bg-ok-ink/90',
  outline: 'border border-line-strong bg-white text-ink hover:bg-page',
  quiet: 'text-road hover:bg-road-soft',
} as const

export function Button({
  tone,
  id,
  children,
  className = 'h-12',
  ...rest
}: {
  tone: keyof typeof BUTTON_TONE
  id: string
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  autoFocus?: boolean
}) {
  return (
    <button type="button" data-id={id} className={`${BUTTON} ${BUTTON_TONE[tone]} ${className}`} {...rest}>
      {children}
    </button>
  )
}

// A Google profile picture, or a plain person where there is none.
export function Avatar({ picture, size }: { picture: string; size: number }) {
  if (!picture) {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-full bg-road-soft text-road" style={{ width: size, height: size }}>
        <PersonIcon size={Math.round(size * 0.6)} />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a Google profile picture, served by Google
    <img src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" className="shrink-0 rounded-full" />
  )
}
