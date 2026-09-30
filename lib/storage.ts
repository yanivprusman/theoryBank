// localStorage can be switched off (private modes, blocked site data). That is
// a state, not an error: what would have been remembered lasts for this visit.
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Same state as above: nothing to remember it in.
  }
}
