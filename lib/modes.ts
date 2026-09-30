// Three ways through the same official bank, and the sign table behind it:
//  Answers  — read every question with only the correct answer (the yellow one)
//  Signs    — every sign in the official table: picture, meaning, and the questions on it
//  Practice — shuffled questions, all four options, instant right/wrong
//  Exam     — the real test's rules: 30 questions, 40 minutes, 26 to pass
//  Teachers — driving teachers near the student (paid listings), and how a teacher gets listed
//
// Each is an address of its own, but they are one page: the shell picks the
// screen from the address, so switching between them asks the server nothing
// (see BankApp) — which is also why it keeps working with no network at all.
// [tabTitle] is what the browser tab says; the pages' metadata and the shell
// both take it from here, so a hard load and a switch agree.
export const APP_TITLE = 'מאגר התאוריה'

export const MODES = [
  { id: 'answers', href: '/', label: 'תשובות', title: 'כל השאלות והתשובות', tabTitle: null },
  { id: 'signs', href: '/signs', label: 'תמרורים', title: 'לוח התמרורים', tabTitle: 'לוח התמרורים' },
  { id: 'practice', href: '/practice', label: 'תרגול', title: 'תרגול עם משוב מיידי', tabTitle: 'תרגול' },
  { id: 'exam', href: '/exam', label: 'מבחן', title: 'מבחן כמו האמיתי', tabTitle: 'מבחן' },
  { id: 'teachers', href: '/teachers', label: 'מורים', title: 'מורים לנהיגה', tabTitle: 'מורים לנהיגה' },
] as const

export type Mode = (typeof MODES)[number]
export type ModeId = Mode['id']

export const modeAt = (pathname: string): Mode => MODES.find((m) => m.href === pathname) ?? MODES[0]
export const tabTitleOf = (mode: Mode) => (mode.tabTitle === null ? APP_TITLE : `${mode.tabTitle} · ${APP_TITLE}`)
