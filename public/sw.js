// theoryBank's offline copy: the five screens, the code and styles they load,
// the bank's three files and every picture, kept in one cache.
//
// The network always comes first for anything that can change — pages, code,
// the bank's JSON — so a reachable server is never answered from the copy and
// nothing here can serve a stale build. The copy answers only when the server
// cannot be reached. Pictures are the exception: they are served from the copy
// at once and refreshed behind it.
//
// Plain JavaScript on purpose: the browser fetches this file by its address,
// outside the app's bundle.

const CACHE = 'theorybank-offline-v1'
const ROUTES = ['/', '/signs', '/practice', '/exam', '/teachers']
// Kept as last seen, so a student with no network still has the teachers' numbers.
// Not part of the copy's completeness: the list changes, the bank does not.
const LIVE_FILES = ['/api/teachers']
const BANK_FILES = ['/bank/questions.json', '/bank/signs.json', '/bank/sign-spots.json']
// What a proxy answers when the app's server is down: unreachable, like no network.
const UNREACHABLE = new Set([502, 503, 504])
const DOWNLOADS_AT_ONCE = 8

// Registered as /sw.js?mode=dev by a dev build: it then only carries lesson
// notifications, and keeps no offline copy — a dev page answered from a copy
// would hide the dev server being down.
const DEV = new URL(self.location.href).searchParams.get('mode') === 'dev'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const isPicture = (url) => url.pathname.startsWith('/bank/img/') || url.pathname.startsWith('/bank/signs/')
const isBuildFile = (url) => url.pathname.startsWith('/_next/static/') && !url.pathname.includes('.hot-update.')

// Entries are kept by path alone: `next dev` stamps its scripts with ?v=<time>,
// and a screen can be opened as /signs?sign=117 — the same file either way.
const keyOf = (url) => url.origin + url.pathname
const keyOfPath = (path) => self.location.origin + path

const keepable = (response) => response.ok && response.type === 'basic'

self.addEventListener('fetch', (event) => {
  if (DEV) return
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    if (ROUTES.includes(url.pathname)) event.respondWith(networkFirst(event, request, url))
    return
  }
  // Next's own data requests share a screen's address. They are left alone: one
  // of them stored under that address would later be served as the page.
  if (request.headers.has('rsc') || url.searchParams.has('_rsc')) return

  if (isPicture(url)) event.respondWith(copyFirst(event, request, url))
  else if (isBuildFile(url) || BANK_FILES.includes(url.pathname) || LIVE_FILES.includes(url.pathname)) event.respondWith(networkFirst(event, request, url))
})

async function networkFirst(event, request, url) {
  const cache = await caches.open(CACHE)
  let response
  try {
    response = await fetch(request)
  } catch (error) {
    const kept = await cache.match(keyOf(url))
    if (kept) return kept
    throw error
  }
  if (keepable(response)) {
    event.waitUntil(cache.put(keyOf(url), response.clone()))
  } else if (UNREACHABLE.has(response.status)) {
    const kept = await cache.match(keyOf(url))
    if (kept) return kept
  }
  return response
}

async function copyFirst(event, request, url) {
  const cache = await caches.open(CACHE)
  const kept = await cache.match(keyOf(url))
  const fresh = fetch(request).then(async (response) => {
    if (keepable(response)) await cache.put(keyOf(url), response.clone())
    return response
  })
  if (!kept) return fresh
  // With no network the refresh fails, and the copy already answered.
  event.waitUntil(fresh.catch(() => undefined))
  return kept
}

// ── Keeping the whole app, not only what was looked at ──────────────────────
// The page asks for this once it has the bank: { buildFiles, pictures }, both
// lists of paths. Progress and the verdict go back to that page.

self.addEventListener('message', (event) => {
  if (event.data?.type === 'keep-offline' && !DEV) event.waitUntil(keepOffline(event.data, event.source))
})

// ── Lesson notifications ────────────────────────────────────────────────────
// The server sends {title, body, url, tag} (lib/push.ts). One tag per lesson,
// so a newer message about the same lesson replaces the older one.

self.addEventListener('push', (event) => {
  let message
  try {
    message = event.data.json()
  } catch {
    return
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      renotify: true,
      dir: 'rtl',
      lang: 'he',
      icon: '/notification-icon.png',
      data: { url: message.url },
    }),
  )
})

// A tap opens the app on the page the message is about — in a window that is
// already open when there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (open) {
        await open.focus()
        return open.navigate(target)
      }
      return self.clients.openWindow(target)
    })(),
  )
})

async function fetchToKeep(cache, path) {
  const response = await fetch(path)
  if (!keepable(response) || response.redirected) throw new Error(`${path}: ${response.status || response.type}`)
  await cache.put(keyOfPath(path), response.clone())
  return response
}

// The scripts, styles and fonts a screen's HTML asks for.
const buildFilesIn = (html) => Array.from(html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)/g), (m) => m[1])

async function inBatches(items, work) {
  const queue = items.slice()
  const runners = Array.from({ length: DOWNLOADS_AT_ONCE }, async () => {
    try {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await work(item)
    } catch (error) {
      // One failure ends the whole batch: the others stop at their next item.
      queue.length = 0
      throw error
    }
  })
  await Promise.all(runners)
}

// What the copy is missing, judged from the copy itself: each screen, every
// file its kept HTML asks for, the bank and the pictures.
async function missingFromCopy(cache, pictures) {
  const kept = new Set((await cache.keys()).map((request) => new URL(request.url).pathname))
  const needed = new Set([...ROUTES, ...BANK_FILES, ...pictures])
  for (const route of ROUTES) {
    const page = await cache.match(keyOfPath(route))
    if (page) for (const file of buildFilesIn(await page.text())) needed.add(file)
  }
  return Array.from(needed).filter((path) => !kept.has(path))
}

async function keepOffline({ buildFiles, pictures }, page) {
  const cache = await caches.open(CACHE)
  const tell = (status) => page.postMessage({ type: 'offline-copy', ...status })
  tell({ state: 'checking' })

  let problem = null
  try {
    // The screens and everything they load, fresh from the server.
    const build = new Set(buildFiles)
    for (const route of ROUTES) {
      const response = await fetchToKeep(cache, route)
      for (const file of buildFilesIn(await response.text())) build.add(file)
    }
    await inBatches([...build, ...BANK_FILES], (path) => fetchToKeep(cache, path))

    // The pictures that are not kept yet — the one part big enough to show.
    const kept = new Set((await cache.keys()).map((request) => new URL(request.url).pathname))
    const wanted = pictures.filter((path) => !kept.has(path))
    if (wanted.length > 0) {
      let done = 0
      let told = 0
      tell({ state: 'saving', done, total: wanted.length })
      await inBatches(wanted, async (path) => {
        await fetchToKeep(cache, path)
        done++
        if (Date.now() - told > 150) {
          told = Date.now()
          tell({ state: 'saving', done, total: wanted.length })
        }
      })
    }

    // Code from builds that are gone.
    for (const request of await cache.keys()) {
      const url = new URL(request.url)
      if (isBuildFile(url) && !build.has(url.pathname)) await cache.delete(request)
    }
  } catch (error) {
    problem = error
  }

  // A refresh that failed is not a copy that is missing: with no network the
  // refresh always fails, and a whole copy is exactly what is wanted then.
  const missing = await missingFromCopy(cache, pictures)
  if (missing.length === 0) tell({ state: 'ready', refreshed: problem === null })
  else tell({ state: 'incomplete', missing: missing.length, reason: problem ? String(problem.message ?? problem) : `missing ${missing[0]}` })
}
