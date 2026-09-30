'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { signInHref, signOut, useAccount } from './account'
import { Avatar } from './ui'

// Sign-in lives in the header, but studying never asks for it: it is for the
// teachers tab — joining a teacher, or being one.
export default function AccountButton() {
  const account = useAccount()
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Unknown (loading, or no network): say nothing rather than a wrong "sign in".
  if (account.state !== 'ready') return null
  const { me } = account
  if (!me.signedIn) {
    return (
      <a
        href={signInHref(path)}
        data-id="account-signin"
        className="t-label-lg flex h-11 cursor-pointer items-center rounded-full px-3 text-white/90 transition-[background-color,transform] duration-150 ease-rise hover:bg-white/16 active:scale-[0.97]"
      >
        כניסה
      </a>
    )
  }
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-id="account-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`החשבון של ${me.user.name}`}
        onClick={() => setOpen(!open)}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full transition-[background-color,transform] duration-150 ease-rise hover:bg-white/16 active:scale-[0.95]"
      >
        <Avatar picture={me.user.picture} size={32} />
      </button>
      {open && (
        <div role="menu" className="absolute end-0 top-full z-40 mt-2 w-64 origin-top animate-pop rounded-2xl border border-line bg-white py-2 text-ink shadow-xl">
          <div className="px-4 pt-1 pb-3">
            <p className="t-title-sm truncate">{me.user.name}</p>
            <p dir="ltr" className="t-body-sm truncate text-end text-ink-soft">
              {me.user.email}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            data-id="account-signout"
            onClick={() => {
              setOpen(false)
              void signOut()
            }}
            className="t-body-lg flex h-11 w-full cursor-pointer items-center border-t border-line px-4 text-start transition-colors duration-150 ease-rise hover:bg-page active:bg-line"
          >
            יציאה מהחשבון
          </button>
        </div>
      )}
    </div>
  )
}
