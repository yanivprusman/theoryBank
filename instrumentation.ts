// Server start-up. The reminder sweep needs Node (web-push, mysql2), so it is
// imported only in the Node runtime — an unconditional import would be bundled
// for Edge too, and fail there.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}
