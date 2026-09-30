'use client'

import { useCallback, useEffect, useState } from 'react'
import { send } from './account'

// Lesson reminders on this device: the browser's own push, through the app's
// service worker. A dev build registers the worker as /sw.js?mode=dev, which
// carries notifications but keeps no offline copy (see public/sw.js).
const WORKER = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?mode=dev'

export type ReminderState =
  | 'checking'
  | 'on'
  | 'off'
  | 'denied' // the user blocked notifications for this site
  | 'ios-install' // an iPhone: push only works from the home-screen app
  | 'unsupported'

function isIosBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function registration() {
  await navigator.serviceWorker.register(WORKER)
  return navigator.serviceWorker.ready
}

// Where this device stands, read from the browser — no state touched.
async function readState(): Promise<ReminderState> {
  if (isIosBrowserTab()) return 'ios-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const existing = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
  return existing && Notification.permission === 'granted' ? 'on' : 'off'
}

export function useReminders() {
  const [state, setState] = useState<ReminderState>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void readState().then((next) => {
      if (live) setState(next)
    })
    return () => {
      live = false
    }
  }, [])

  const turnOn = useCallback(async () => {
    setError(null)
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return setState(permission === 'denied' ? 'denied' : 'off')
    try {
      const key = (await (await fetch('/api/push')).json()) as { publicKey: string }
      const reg = await registration()
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key.publicKey) }))
      const reply = await send('/api/push', 'POST', { subscription: subscription.toJSON() })
      if (!reply.ok) throw new Error(reply.message)
      setState('on')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setState('off')
    }
  }, [])

  const turnOff = useCallback(async () => {
    setError(null)
    const subscription = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()
    if (subscription) {
      await send('/api/push', 'DELETE', { endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
    setState('off')
  }, [])

  return { state, error, turnOn, turnOff }
}
