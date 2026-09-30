'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Me } from '@/lib/accounts'

// The signed-in account, shared by the header and the teachers tab. Asked for
// once per visit and again after anything that changes it (refreshMe).
export type Account = { state: 'loading' } | { state: 'offline' } | { state: 'ready'; me: Me }

let account: Account = { state: 'loading' }
let started = false
const listeners = new Set<() => void>()

function set(next: Account) {
  account = next
  listeners.forEach((listener) => listener())
}

export async function refreshMe(): Promise<void> {
  try {
    const response = await fetch('/api/me', { cache: 'no-store' })
    const reply = (await response.json()) as { ok: boolean; me?: Me }
    if (!reply.ok || !reply.me) throw new Error(`/api/me: ${response.status}`)
    set({ state: 'ready', me: reply.me })
  } catch {
    // No network, or the server could not say: the account is unknown, not signed out.
    set({ state: 'offline' })
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const LOADING: Account = { state: 'loading' }

export function useAccount(): Account {
  useEffect(() => {
    if (started) return
    started = true
    void refreshMe()
  }, [])
  return useSyncExternalStore(subscribe, () => account, () => LOADING)
}

/** Where the sign-in button goes: Google, then back to this address. */
export function signInHref(next: string): string {
  return `/api/auth/signin?next=${encodeURIComponent(next)}`
}

export async function signOut(): Promise<void> {
  // This browser's lesson reminders were the account's, not the browser's: the
  // next person to sign in here must not get them.
  const subscription = 'serviceWorker' in navigator ? await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription() : null
  if (subscription) {
    await send('/api/push', 'DELETE', { endpoint: subscription.endpoint })
    await subscription.unsubscribe()
  }
  await fetch('/api/auth/signout', { method: 'POST' })
  await refreshMe()
}

/** POST/PATCH/DELETE JSON to one of the account routes; the server's Hebrew reason on failure. */
export async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<{ ok: true } | { ok: false; message: string; field?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const reply = (await response.json()) as { ok: boolean; message?: string; field?: string }
    if (reply.ok) return { ok: true }
    return { ok: false, message: reply.message ?? `השרת החזיר ${response.status}`, field: reply.field }
  } catch {
    return { ok: false, message: 'אין חיבור לרשת. בדוק את החיבור ונסה שוב.' }
  }
}

// Acts, then refreshes the account; a refusal is shown where the action was.
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true)
    setError(null)
    const reply = await send(url, method, body)
    if (!reply.ok) setError(reply.message)
    await refreshMe()
    setBusy(false)
    return reply.ok
  }
  return { busy, error, run }
}
