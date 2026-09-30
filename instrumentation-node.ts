// Lesson reminders are due at set times whether or not anyone has the app open,
// so the server checks every minute. The sweep claims each reminder in the
// database before sending it, so a second server (failover) or a restart
// mid-minute never sends one twice.
import { sendDueReminders } from './lib/lessons'

const g = globalThis as unknown as { theoryBankReminders?: NodeJS.Timeout }

if (!g.theoryBankReminders) {
  let running = false
  g.theoryBankReminders = setInterval(async () => {
    if (running) return
    running = true
    try {
      const sent = await sendDueReminders()
      if (sent > 0) console.log(`[theoryBank] sent ${sent} lesson reminder(s)`)
    } catch (e) {
      // The DB may be restarting; the next minute tries again, and a reminder not claimed is still due.
      console.error('[theoryBank] reminder sweep failed:', e)
    } finally {
      running = false
    }
  }, 60_000)
}
