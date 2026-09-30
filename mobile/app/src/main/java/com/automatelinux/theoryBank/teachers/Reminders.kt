package com.automatelinux.theoryBank.teachers

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.automatelinux.theoryBank.MainActivity
import com.automatelinux.theoryBank.R
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.concurrent.TimeUnit

// Lesson reminders without a push service. The phone fetches its lessons — when
// the app opens, after any change made in it, and in the background about every
// 15 minutes (WorkManager's floor) — and then:
//  • sets its own alarms for each lesson: 20:00 the evening before, and two
//    hours before. Alarms fire on time with no network.
//  • compares with what it saw last time, and tells a student about a lesson
//    that is new, moved or cancelled. That notice is as late as the next fetch.
// Alarms do not survive a reboot, so BootReceiver fetches again at start-up.
object Reminders {
    private const val CHANNEL = "lessons"
    private const val PREFS = "theoryBankLessons"
    private const val SEEN = "seen" // lessonId -> startsAt, the student's lessons at the last fetch
    private const val ALARMS = "alarms" // request codes of alarms set
    private const val PERIODIC = "lesson-sync"
    private const val NOW = "lesson-sync-now"

    val ZONE: ZoneId = ZoneId.of("Asia/Jerusalem")
    private val json = Json { ignoreUnknownKeys = true }

    fun canNotify(context: Context) =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Keep fetching in the background, and fetch once now. */
    fun start(context: Context) {
        val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val work = WorkManager.getInstance(context)
        work.enqueueUniquePeriodicWork(
            PERIODIC,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<LessonSyncWorker>(15, TimeUnit.MINUTES).setConstraints(online).build(),
        )
        syncSoon(context)
    }

    fun syncSoon(context: Context) {
        val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            NOW,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<LessonSyncWorker>().setConstraints(online).build(),
        )
    }

    /** Signed out: no more fetching, no alarms, nothing remembered. */
    fun forget(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        WorkManager.getInstance(context).cancelUniqueWork(NOW)
        cancelAlarms(context, prefs(context).getStringSet(ALARMS, emptySet()).orEmpty())
        prefs(context).edit().clear().apply()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** One fetch: set the alarms, and tell the student what changed. */
    suspend fun sync(context: Context) {
        if (Api.token(context) == null) return forget(context)
        val me = Api.me(context)
        val myId = me.user?.id ?: return forget(context)
        val lessons = Api.lessons(context)
        val now = Instant.now()

        // Alarms: replace the whole set with the one these lessons call for.
        cancelAlarms(context, prefs(context).getStringSet(ALARMS, emptySet()).orEmpty())
        val set = mutableSetOf<String>()
        for (lesson in lessons) {
            val start = Instant.parse(lesson.startsAt)
            val asStudent = lesson.student.id == myId
            val who = if (asStudent) lesson.teacher.name else lesson.student.name.substringBefore(' ')
            val title = if (asStudent) "תזכורת: שיעור נהיגה" else "תזכורת: שיעור עם תלמיד"
            val note = if (lesson.note.isNotEmpty()) " · ${lesson.note}" else ""
            val evening = start.atZone(ZONE).toLocalDate().minusDays(1).atTime(LocalTime.of(20, 0)).atZone(ZONE).toInstant()
            val soon = start.minusSeconds(2 * 60 * 60)
            if (evening.isAfter(now) && evening.isBefore(soon)) {
                set += setAlarm(context, lesson.id * 2, evening, title, "מחר, ${sayWhen(start)} עם $who$note")
            }
            if (soon.isAfter(now)) {
                set += setAlarm(context, lesson.id * 2 + 1, soon, title, "בעוד שעתיים, ${sayWhen(start)} עם $who$note")
            }
        }
        prefs(context).edit().putStringSet(ALARMS, set).apply()

        // Changes, for the student. The first fetch only takes note: everything is "new" to it.
        val mine = lessons.filter { it.student.id == myId }.associate { it.id.toString() to it }
        val seenJson = prefs(context).getString(SEEN, null)
        if (seenJson != null) {
            val seen: Map<String, String> = json.decodeFromString(seenJson)
            for ((id, lesson) in mine) {
                val start = Instant.parse(lesson.startsAt)
                when (seen[id]) {
                    null -> notify(context, lesson.id, "נקבע לך שיעור נהיגה", "${sayWhen(start)} עם ${lesson.teacher.name}")
                    lesson.startsAt -> Unit
                    else -> notify(context, lesson.id, "שיעור הנהיגה שלך הוזז", "השיעור עם ${lesson.teacher.name} עבר ל${sayWhen(start)}")
                }
            }
            for ((id, startsAt) in seen) {
                val start = Instant.parse(startsAt)
                // Gone while still ahead: cancelled. (Gone after it began: simply over.)
                if (id !in mine && start.isAfter(now)) notify(context, id.toInt(), "שיעור נהיגה בוטל", "השיעור ב${sayWhen(start)} בוטל")
            }
        }
        prefs(context).edit().putString(SEEN, json.encodeToString(mine.mapValues { it.value.startsAt })).apply()
    }

    private fun alarmIntent(context: Context, code: Int, title: String = "", body: String = ""): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            code,
            Intent(context, ReminderReceiver::class.java).putExtra("title", title).putExtra("body", body).putExtra("lesson", code / 2),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun setAlarm(context: Context, code: Int, at: Instant, title: String, body: String): String {
        val alarms = context.getSystemService(AlarmManager::class.java)
        // Inexact-but-idle-proof: may land a few minutes late in deep sleep, needs no special permission.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), alarmIntent(context, code, title, body))
        return code.toString()
    }

    private fun cancelAlarms(context: Context, codes: Set<String>) {
        val alarms = context.getSystemService(AlarmManager::class.java)
        for (code in codes) alarms.cancel(alarmIntent(context, code.toInt()))
    }

    private fun channel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL, "שיעורי נהיגה", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "תזכורות לשיעורים, ושינויים בהם"
                },
            )
        }
    }

    /** One notification per lesson: a newer message about it replaces the older. */
    fun notify(context: Context, lessonId: Int, title: String, body: String) {
        if (!canNotify(context)) return
        channel(context)
        val open = PendingIntent.getActivity(
            context,
            lessonId,
            Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_TAB, "teachers").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { NotificationManagerCompat.from(context).notify("lesson", lessonId, notification) }
    }

    private val DAY = DateTimeFormatter.ofPattern("EEEE d.M", Locale.forLanguageTag("he"))
    private val TIME = DateTimeFormatter.ofPattern("HH:mm")

    /** "יום שלישי 14.10 בשעה 16:00" — as the server says it. */
    fun sayWhen(at: Instant): String {
        val z = at.atZone(ZONE)
        return "${DAY.format(z)} בשעה ${TIME.format(z)}"
    }
}

class LessonSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        Reminders.sync(applicationContext)
        Result.success()
    } catch (e: ApiError) {
        // No network or the server is down: the alarms already set still fire; try again later.
        Result.retry()
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Reminders.notify(context, intent.getIntExtra("lesson", 0), intent.getStringExtra("title").orEmpty(), intent.getStringExtra("body").orEmpty())
    }
}

// Alarms are wiped by a reboot (and by an app update); fetch again to set them back.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Api.token(context) != null) Reminders.syncSoon(context)
    }
}
