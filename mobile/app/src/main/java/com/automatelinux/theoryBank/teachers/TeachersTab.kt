package com.automatelinux.theoryBank.teachers

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.ui.ALL
import com.automatelinux.theoryBank.ui.theme.Palette
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

// The teachers tab, as on the web (theoryBank/components/TeachersScreen.tsx):
// students find a teacher and join them; a teacher asks to be listed and, once
// the owner approves, sees their students and books lessons. Studying never
// needs an account — only this tab does.

private val OkInk = Color(0xFF187440)
private val BadInk = Color(0xFFB3261E)
private val RoadSoft = Color(0xFFE8EFFD)
private val TEACHABLE = listOf("C1", "C", "B", "A", "D", "1")

private sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Failed(val reason: String) : Load<Nothing>
    data class Ready<T>(val value: T) : Load<T>
}

private class TabState(val context: Context) {
    var me by mutableStateOf<Load<Me>>(Load.Loading)
    var teachers by mutableStateOf<Load<List<Teacher>>>(Load.Loading)
    var lessons by mutableStateOf<List<Lesson>>(emptyList())
    var version by mutableIntStateOf(0)

    suspend fun load() {
        me = runCatching { Load.Ready(Api.me(context)) }.getOrElse { Load.Failed(it.message ?: "") }
        teachers = runCatching { Load.Ready(Api.teachers(context)) }.getOrElse { Load.Failed(it.message ?: "") }
        val m = (me as? Load.Ready)?.value
        lessons = if (m?.signedIn == true && (m.teacher?.status == "approved" || m.myTeacher?.accepted == true)) {
            runCatching { Api.lessons(context) }.getOrDefault(emptyList())
        } else emptyList()
        if (m?.signedIn == true) Reminders.start(context)
    }
}

@Composable
fun TeachersTab(license: String) {
    val context = LocalContext.current
    val state = remember { TabState(context) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(state.version) { state.load() }
    val refresh: () -> Unit = { state.version++ }
    // After a change made here: reload the tab, and let the phone re-arm its alarms.
    val changed: () -> Unit = {
        refresh()
        Reminders.syncSoon(context)
    }

    val me = (state.me as? Load.Ready)?.value
    val signedIn = me?.signedIn == true

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        AccountRow(me, onSignIn = changed, onSignOut = {
            scope.launch {
                GoogleSignIn.signOut(context)
                refresh()
            }
        })
        if (me != null && signedIn) {
            me.teacher?.let { MyListing(me, it, state.lessons, changed) }
            me.myTeacher?.let { MyTeacherCard(me, it, state.lessons, changed) }
        }
        when (val t = state.teachers) {
            Load.Loading -> Box(Modifier.fillMaxWidth().padding(24.dp), Alignment.Center) { CircularProgressIndicator() }
            is Load.Failed -> Failed(t.reason, refresh)
            is Load.Ready -> if (t.value.isEmpty()) {
                Text(
                    "מחפשים מורה לנהיגה? מורים יופיעו כאן בקרוב.",
                    Modifier.fillMaxWidth().background(RoadSoft, RoundedCornerShape(16.dp)).padding(14.dp),
                    style = MaterialTheme.typography.bodyLarge,
                )
            } else {
                TeacherList(t.value, license, me, changed)
            }
        }
        if (me?.teacher == null) ForTeachers(first = (state.teachers as? Load.Ready)?.value?.isEmpty() == true, me = me, onRequested = changed)
        Spacer(Modifier.height(8.dp))
    }
}

// ── Account ─────────────────────────────────────────────────────────────────

@Composable
private fun AccountRow(me: Me?, onSignIn: () -> Unit, onSignOut: () -> Unit) {
    if (me == null) return
    if (!me.signedIn) {
        Text(
            "כניסה עם Google נדרשת רק כדי להצטרף למורה או להופיע כמורה. הלימוד פתוח לכולם.",
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.InkSoft,
        )
        return
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("מחובר כ${me.user?.name}", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium, color = Palette.InkSoft)
        TextButton(onClick = onSignOut, modifier = Modifier.testTag("account-signout")) { Text("יציאה") }
    }
}

@Composable
private fun SignInButton(label: String, tag: String, onSignedIn: () -> Unit, modifier: Modifier = Modifier, filled: Boolean = true) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(modifier) {
        val onClick: () -> Unit = {
            busy = true
            error = null
            scope.launch {
                try {
                    if (GoogleSignIn.signIn(context) != null) onSignedIn()
                } catch (e: ApiError) {
                    error = e.message
                }
                busy = false
            }
        }
        if (filled) {
            Button(onClick, enabled = !busy, modifier = Modifier.testTag(tag), colors = ButtonDefaults.buttonColors(containerColor = Palette.Highlight, contentColor = Palette.Ink)) {
                Text(label)
            }
        } else {
            TextButton(onClick, enabled = !busy, modifier = Modifier.fillMaxWidth().testTag(tag)) { Text(label) }
        }
        error?.let { Text(it, color = BadInk, style = MaterialTheme.typography.bodyMedium) }
    }
}

// ── Shared bits ─────────────────────────────────────────────────────────────

@Composable
private fun Card(tag: String, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().testTag(tag).clip(RoundedCornerShape(18.dp)).background(Color.White)
            .border(1.dp, Palette.Line, RoundedCornerShape(18.dp)).padding(16.dp),
    ) { content() }
}

@Composable
private fun Failed(reason: String, retry: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("רשימת המורים לא נטענה", style = MaterialTheme.typography.titleMedium)
        Text(reason, color = Palette.InkSoft, style = MaterialTheme.typography.bodyLarge)
        Button(retry, Modifier.padding(top = 12.dp).testTag("teachers-retry")) { Text("נסה שוב") }
    }
}

/** Runs a server action; shows its refusal under it. */
@Composable
private fun rememberAction(onDone: () -> Unit): Pair<Boolean, Pair<String?, (suspend () -> Unit) -> Unit>> {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val run: (suspend () -> Unit) -> Unit = { action ->
        busy = true
        error = null
        scope.launch {
            try {
                action()
                onDone()
            } catch (e: ApiError) {
                error = e.message
            }
            busy = false
        }
    }
    return busy to (error to run)
}

private fun dial(context: Context, phone: String) = context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))

private fun whatsapp(context: Context, phone: String, text: String) =
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/972${phone.drop(1)}?text=${Uri.encode(text)}")))

// ── For students ────────────────────────────────────────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TeacherList(teachers: List<Teacher>, license: String, me: Me?, changed: () -> Unit) {
    var area by remember { mutableStateOf(ALL) }
    val forLicense = teachers.filter { license == ALL || it.licenses.isEmpty() || license in it.licenses }
    val areas = forLicense.map { it.area }.filter { it.isNotEmpty() }.distinct().sorted()
    val shown = forLicense.filter { area == ALL || it.area == area }
    if (areas.size > 1) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            (listOf(ALL) + areas).forEachIndexed { i, a ->
                FilterChip(selected = a == area || (a == ALL && area !in areas), onClick = { area = a }, label = { Text(a) }, modifier = Modifier.testTag("teacher-area-$i"))
            }
        }
    }
    if (shown.isEmpty()) {
        Text(
            if (license == ALL) "אין עדיין מורים באזור הזה." else "אין עדיין מורה שמלמד רישיון $license.",
            Modifier.fillMaxWidth().padding(vertical = 16.dp),
            color = Palette.InkSoft,
            style = MaterialTheme.typography.bodyLarge,
        )
        return
    }
    Text(
        (if (shown.size == 1) "מורה אחד" else "${shown.size} מורים") + (if (license != ALL) " · מלמדים רישיון $license" else ""),
        style = MaterialTheme.typography.labelMedium,
        color = Palette.InkSoft,
    )
    shown.forEach { TeacherCard(it, me, changed) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TeacherCard(teacher: Teacher, me: Me?, changed: () -> Unit) {
    val context = LocalContext.current
    val mine = me?.myTeacher?.id == teacher.id
    val self = me?.user?.id == teacher.id
    val (busy, rest) = rememberAction(changed)
    val (error, run) = rest
    Card("teacher-${teacher.id}") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).background(RoadSoft, CircleShape), Alignment.Center) { Icon(Icons.Default.Person, null, tint = Palette.RoadBlue) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(teacher.name, style = MaterialTheme.typography.titleMedium)
                val where = listOf(teacher.area, teacher.school).filter { it.isNotEmpty() }.joinToString(" · ")
                if (where.isNotEmpty()) Text(where, style = MaterialTheme.typography.bodyMedium, color = Palette.InkSoft)
            }
            if (mine) {
                Row(Modifier.background(Palette.RightSoft, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Check, null, Modifier.size(14.dp), tint = OkInk)
                    Text(if (me?.myTeacher?.accepted == true) "המורה שלך" else "ביקשת", color = OkInk, style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        if (teacher.licenses.isNotEmpty()) {
            FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                teacher.licenses.forEach {
                    Text(it, Modifier.background(Palette.Page, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp), style = MaterialTheme.typography.labelMedium)
                }
            }
        }
        if (teacher.note.isNotEmpty()) Text(teacher.note, Modifier.padding(top = 10.dp), style = MaterialTheme.typography.bodyLarge)
        Row(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton({ dial(context, teacher.phone) }, Modifier.weight(1f).testTag("teacher-call-${teacher.id}")) {
                Icon(Icons.Default.Call, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("התקשר")
            }
            Button(
                { whatsapp(context, teacher.phone, "שלום ${teacher.name.substringBefore(' ')}, ראיתי אותך במאגר התאוריה ואשמח לשמוע על שיעורי נהיגה.") },
                Modifier.weight(1f).testTag("teacher-whatsapp-${teacher.id}"),
                colors = ButtonDefaults.buttonColors(containerColor = OkInk),
            ) {
                Icon(Icons.AutoMirrored.Filled.Chat, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("וואטסאפ")
            }
        }
        if (!mine && !self && me != null) {
            if (!me.signedIn) {
                SignInButton("אני לומד אצלו · כניסה עם Google", "teacher-join-signin-${teacher.id}", changed, Modifier.padding(top = 4.dp), filled = false)
            } else {
                TextButton({ run { Api.joinTeacher(context, teacher.id) } }, Modifier.fillMaxWidth().testTag("teacher-join-${teacher.id}"), enabled = !busy) {
                    Text(if (me.myTeacher != null) "לעבור למורה הזה" else "אני לומד אצלו")
                }
            }
        }
        error?.let { Text(it, color = BadInk, style = MaterialTheme.typography.bodyMedium) }
    }
}

@Composable
private fun MyTeacherCard(me: Me, teacher: MyTeacher, lessons: List<Lesson>, changed: () -> Unit) {
    val context = LocalContext.current
    val (busy, rest) = rememberAction(changed)
    val (error, run) = rest
    Card("my-teacher") {
        Text(if (teacher.accepted) "המורה שלך" else "ביקשת להצטרף ל", style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(teacher.name, Modifier.weight(1f), style = MaterialTheme.typography.titleLarge)
            if (teacher.accepted) {
                OutlinedButton({ dial(context, teacher.phone) }, Modifier.testTag("my-teacher-call")) {
                    Icon(Icons.Default.Call, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text(teacher.phone)
                }
            } else {
                Text("מחכה לאישור המורה", Modifier.background(Palette.HighlightSoft, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 6.dp), style = MaterialTheme.typography.labelMedium)
            }
        }
        TextButton({ run { Api.leaveTeacher(context) } }, enabled = !busy, modifier = Modifier.testTag("my-teacher-leave")) {
            Text(if (teacher.accepted) "לעזוב את המורה" else "לבטל את הבקשה", color = Palette.InkSoft)
        }
        error?.let { Text(it, color = BadInk) }
        if (teacher.accepted) {
            val mine = lessons.filter { it.student.id == me.user?.id }
            if (mine.isEmpty()) {
                Text("עוד לא נקבעו לך שיעורים. המורה קובע אותם, והם יופיעו כאן.", color = Palette.InkSoft, style = MaterialTheme.typography.bodyLarge)
            } else {
                Text("השיעורים הקרובים", Modifier.padding(top = 8.dp), style = MaterialTheme.typography.labelLarge)
                mine.forEach { LessonLine(it, null) }
            }
            RemindersRow()
        }
    }
}

// ── Reminders on this phone ─────────────────────────────────────────────────

@Composable
private fun RemindersRow() {
    val context = LocalContext.current
    var allowed by remember { mutableStateOf(Reminders.canNotify(context)) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed = it }
    Row(
        Modifier.fillMaxWidth().padding(top = 12.dp).background(if (allowed) Palette.RightSoft else Palette.Page, RoundedCornerShape(12.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (allowed) "תזכורות לשיעורים פועלות בטלפון הזה: ערב לפני ושעתיים לפני." else "רוצה תזכורת לפני כל שיעור? אפשר התראות.",
            Modifier.weight(1f),
            style = MaterialTheme.typography.bodyMedium,
        )
        if (!allowed && Build.VERSION.SDK_INT >= 33) {
            Button({ ask.launch(Manifest.permission.POST_NOTIFICATIONS) }, Modifier.testTag("reminders-on")) { Text("הפעל") }
        }
    }
}

// ── For teachers ────────────────────────────────────────────────────────────

@Composable
private fun MyListing(me: Me, listing: TeacherStatus, lessons: List<Lesson>, changed: () -> Unit) {
    Card("my-listing") {
        if (listing.status != "approved") {
            Text("למורים", style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
            Text(
                if (listing.status == "pending") "הבקשה שלך להופיע ברשימה התקבלה. אחזור אליך בטלפון לגבי המחיר, ואחרי התשלום תופיע כאן."
                else "הבקשה שלך להופיע ברשימה לא אושרה. אפשר ליצור קשר בוואטסאפ לפרטים.",
                style = MaterialTheme.typography.bodyLarge,
            )
            return@Card
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("התלמידים שלי", Modifier.weight(1f), style = MaterialTheme.typography.headlineSmall)
            Text(
                if (listing.listed) "מופיע עד ${listing.listedUntil?.split("-")?.reversed()?.joinToString(".")}" else "לא מופיע כרגע",
                Modifier.background(if (listing.listed) Palette.RightSoft else Palette.WrongSoft, RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 4.dp),
                color = if (listing.listed) OkInk else BadInk,
                style = MaterialTheme.typography.labelMedium,
            )
        }
        val waiting = me.students.filter { !it.accepted }
        val mine = me.students.filter { it.accepted }
        if (waiting.isNotEmpty()) {
            Text("מבקשים להצטרף", Modifier.padding(top = 12.dp), style = MaterialTheme.typography.labelLarge)
            waiting.forEach { StudentRow(it, changed) }
        }
        Text(if (mine.isEmpty()) "עוד אין תלמידים" else "${mine.size} תלמידים", Modifier.padding(top = 12.dp), style = MaterialTheme.typography.labelLarge)
        if (mine.isEmpty()) {
            Text("תלמידים שלומדים אצלך מצטרפים מהכרטיס שלך ברשימה, ומופיעים כאן לאישור.", color = Palette.InkSoft, style = MaterialTheme.typography.bodyLarge)
        } else {
            mine.forEach { StudentRow(it, changed) }
            Spacer(Modifier.height(16.dp).fillMaxWidth())
            Text("שיעורים", style = MaterialTheme.typography.headlineSmall)
            ScheduleForm(mine, changed)
            val upcoming = lessons.filter { it.teacher.id == me.user?.id }
            Text(if (upcoming.isEmpty()) "אין שיעורים קרובים" else "השיעורים הקרובים", Modifier.padding(top = 12.dp), style = MaterialTheme.typography.labelLarge)
            upcoming.forEach { LessonLine(it, changed) }
        }
        RemindersRow()
    }
}

@Composable
private fun StudentRow(student: Student, changed: () -> Unit) {
    val context = LocalContext.current
    val (busy, rest) = rememberAction(changed)
    val (error, run) = rest
    Column(Modifier.padding(top = 8.dp).fillMaxWidth().border(1.dp, Palette.Line, RoundedCornerShape(12.dp)).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(student.name, style = MaterialTheme.typography.titleSmall)
                Text(student.email, style = MaterialTheme.typography.bodySmall, color = Palette.InkSoft)
            }
            if (student.accepted) {
                TextButton({ run { Api.answerStudent(context, student.id, false) } }, enabled = !busy, modifier = Modifier.testTag("student-remove-${student.id}")) {
                    Text("הסר", color = Palette.InkSoft)
                }
            } else {
                Button({ run { Api.answerStudent(context, student.id, true) } }, enabled = !busy, modifier = Modifier.testTag("student-accept-${student.id}"), colors = ButtonDefaults.buttonColors(containerColor = OkInk)) { Text("אשר") }
                Spacer(Modifier.width(6.dp))
                OutlinedButton({ run { Api.answerStudent(context, student.id, false) } }, enabled = !busy, modifier = Modifier.testTag("student-decline-${student.id}")) { Text("דחה") }
            }
        }
        error?.let { Text(it, color = BadInk) }
    }
}

private val DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd")
private val TIME = DateTimeFormatter.ofPattern("HH:mm")

/** A date and a time, picked with the platform's own dialogs. */
@Composable
private fun DateTimeFields(date: LocalDate, time: LocalTime, onDate: (LocalDate) -> Unit, onTime: (LocalTime) -> Unit, tag: String) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
            { DatePickerDialog(context, { _, y, m, d -> onDate(LocalDate.of(y, m + 1, d)) }, date.year, date.monthValue - 1, date.dayOfMonth).show() },
            Modifier.weight(1.3f).testTag("$tag-date"),
        ) { Text("${date.dayOfMonth}.${date.monthValue}.${date.year}") }
        OutlinedButton(
            { TimePickerDialog(context, { _, h, min -> onTime(LocalTime.of(h, min)) }, time.hour, time.minute, true).show() },
            Modifier.weight(1f).testTag("$tag-time"),
        ) { Text(TIME.format(time)) }
    }
}

@Composable
private fun ScheduleForm(students: List<Student>, changed: () -> Unit) {
    val context = LocalContext.current
    var student by remember { mutableStateOf(students.first()) }
    var menu by remember { mutableStateOf(false) }
    var date by remember { mutableStateOf(LocalDate.now(Reminders.ZONE).plusDays(1)) }
    var time by remember { mutableStateOf(LocalTime.of(16, 0)) }
    var note by remember { mutableStateOf("") }
    var done by remember { mutableStateOf(false) }
    val (busy, rest) = rememberAction {
        done = true
        note = ""
        changed()
    }
    val (error, run) = rest
    Column(Modifier.padding(top = 10.dp).fillMaxWidth().background(Palette.Page, RoundedCornerShape(12.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("קביעת שיעור", style = MaterialTheme.typography.labelLarge)
        Box {
            OutlinedButton({ menu = true }, Modifier.fillMaxWidth().testTag("lesson-student")) { Text(student.name) }
            DropdownMenu(menu, { menu = false }) {
                students.forEach { s -> DropdownMenuItem(text = { Text(s.name) }, onClick = { student = s; menu = false }) }
            }
        }
        DateTimeFields(date, time, { date = it }, { time = it }, "lesson")
        OutlinedTextField(note, { note = it.take(300) }, Modifier.fillMaxWidth().testTag("lesson-note"), label = { Text("הערה (לא חובה)") }, singleLine = true)
        Button(
            { done = false; run { Api.scheduleLesson(context, student.id, DATE.format(date), TIME.format(time), note.trim()) } },
            enabled = !busy,
            modifier = Modifier.testTag("lesson-schedule"),
        ) { Text(if (busy) "קובע…" else "קבע שיעור") }
        if (done) Text("נקבע. התלמיד יקבל הודעה.", color = OkInk, style = MaterialTheme.typography.bodyMedium)
        error?.let { Text(it, color = BadInk) }
    }
}

/** One lesson; with [changed] (the teacher's view) it can be moved or cancelled. */
@Composable
private fun LessonLine(lesson: Lesson, changed: (() -> Unit)?) {
    val context = LocalContext.current
    val start = Instant.parse(lesson.startsAt).atZone(Reminders.ZONE)
    var moving by remember { mutableStateOf(false) }
    var confirm by remember { mutableStateOf(false) }
    var date by remember(lesson.startsAt) { mutableStateOf(start.toLocalDate()) }
    var time by remember(lesson.startsAt) { mutableStateOf(start.toLocalTime()) }
    val (busy, rest) = rememberAction {
        moving = false
        confirm = false
        changed?.invoke()
    }
    val (error, run) = rest
    Column(Modifier.padding(top = 8.dp).fillMaxWidth().border(1.dp, Palette.Line, RoundedCornerShape(12.dp)).padding(12.dp).testTag("lesson-${lesson.id}")) {
        Text(
            Reminders.sayWhen(start.toInstant()) + if (changed != null) " · ${lesson.student.name}" else "",
            style = MaterialTheme.typography.titleSmall,
        )
        if (lesson.note.isNotEmpty()) Text(lesson.note, color = Palette.InkSoft, style = MaterialTheme.typography.bodyMedium)
        if (changed != null && !moving && !confirm) {
            Row {
                TextButton({ moving = true }, Modifier.testTag("lesson-move-${lesson.id}")) { Text("שנה שעה") }
                TextButton({ confirm = true }, Modifier.testTag("lesson-cancel-${lesson.id}")) { Text("בטל", color = Palette.InkSoft) }
            }
        }
        if (confirm) {
            Text("לבטל את השיעור? התלמיד יקבל הודעה.", Modifier.padding(top = 6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button({ run { Api.cancelLesson(context, lesson.id) } }, enabled = !busy, modifier = Modifier.testTag("lesson-cancel-confirm-${lesson.id}"), colors = ButtonDefaults.buttonColors(containerColor = BadInk)) { Text("כן, בטל") }
                OutlinedButton({ confirm = false }, Modifier.testTag("lesson-cancel-keep-${lesson.id}")) { Text("השאר") }
            }
        }
        if (moving) {
            Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DateTimeFields(date, time, { date = it }, { time = it }, "lesson-move-${lesson.id}")
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button({ run { Api.moveLesson(context, lesson.id, DATE.format(date), TIME.format(time)) } }, enabled = !busy, modifier = Modifier.testTag("lesson-move-save-${lesson.id}")) { Text("שמור") }
                    OutlinedButton({ moving = false }, Modifier.testTag("lesson-move-back-${lesson.id}")) { Text("חזור") }
                }
            }
        }
        error?.let { Text(it, color = BadInk) }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ForTeachers(first: Boolean, me: Me?, onRequested: () -> Unit) {
    var open by remember { mutableStateOf(first) }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
            .background(Brush.verticalGradient(listOf(Palette.RoadBlueDark, Palette.RoadBlue))).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("למורים לנהיגה", color = Palette.Highlight, style = MaterialTheme.typography.labelLarge)
        Text(if (first) "היה המורה הראשון שהתלמידים כאן רואים" else "רוצה להופיע ברשימה?", color = Color.White, style = MaterialTheme.typography.headlineSmall)
        Text("התלמידים שלומדים כאן תאוריה הם אלה שעוד רגע מחפשים מורה. כאן הם מוצאים אותו.", color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodyLarge)
        listOf(
            "נכנסים ושולחים בקשה" to "כניסה עם Google וטופס קצר. לוקח דקה.",
            "מדברים" to "אחזור אליך בטלפון או בוואטסאפ, ונסגור לכמה זמן ובאיזה מחיר.",
            "משלמים ומופיעים" to "תקבל קישור לתשלום בביט או באשראי. אחרי התשלום אתה ברשימה, והתלמידים שלך מצטרפים אליך.",
        ).forEachIndexed { i, (title, body) ->
            Row(verticalAlignment = Alignment.Top) {
                Box(Modifier.size(28.dp).background(Palette.Highlight, CircleShape), Alignment.Center) { Text("${i + 1}", color = Palette.Ink, style = MaterialTheme.typography.labelLarge) }
                Spacer(Modifier.width(10.dp))
                Column {
                    Text(title, color = Color.White, style = MaterialTheme.typography.titleSmall)
                    Text(body, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        when {
            me == null -> Unit
            !me.signedIn -> SignInButton("כניסה עם Google כדי להופיע כאן", "teachers-signin", onRequested)
            !open -> Button({ open = true }, Modifier.testTag("teachers-open-form"), colors = ButtonDefaults.buttonColors(containerColor = Palette.Highlight, contentColor = Palette.Ink)) { Text("אני רוצה להופיע כאן") }
            else -> RequestForm(me.user?.name.orEmpty(), onRequested)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun RequestForm(defaultName: String, onRequested: () -> Unit) {
    val context = LocalContext.current
    var name by remember { mutableStateOf(defaultName) }
    var phone by remember { mutableStateOf("") }
    var area by remember { mutableStateOf("") }
    var school by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var licenses by remember { mutableStateOf(listOf<String>()) }
    val (busy, rest) = rememberAction(onRequested)
    val (error, run) = rest
    Column(Modifier.fillMaxWidth().background(RoadSoft, RoundedCornerShape(16.dp)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("הבקשה שלך", style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(name, { name = it.take(80) }, Modifier.fillMaxWidth().testTag("teacher-name"), label = { Text("שם מלא") }, singleLine = true)
        OutlinedTextField(phone, { phone = it.take(16) }, Modifier.fillMaxWidth().testTag("teacher-phone"), label = { Text("טלפון") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
        OutlinedTextField(area, { area = it.take(80) }, Modifier.fillMaxWidth().testTag("teacher-area"), label = { Text("אזור / עיר שבה אתה מלמד") }, singleLine = true)
        OutlinedTextField(school, { school = it.take(80) }, Modifier.fillMaxWidth().testTag("teacher-school"), label = { Text("בית ספר לנהיגה (לא חובה)") }, singleLine = true)
        Text("אילו רישיונות אתה מלמד?", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            TEACHABLE.forEach { l ->
                FilterChip(selected = l in licenses, onClick = { licenses = if (l in licenses) licenses - l else licenses + l }, label = { Text(l) }, modifier = Modifier.testTag("teacher-license-${l.lowercase()}"))
            }
        }
        OutlinedTextField(note, { note = it.take(1000) }, Modifier.fillMaxWidth().testTag("teacher-note"), label = { Text("משהו שכדאי שאדע? (לא חובה)") })
        Button(
            { run { Api.requestTeacher(context, name.trim(), phone, area.trim(), school.trim(), licenses, note.trim()) } },
            enabled = !busy,
            modifier = Modifier.testTag("teacher-submit"),
        ) { Text(if (busy) "שולח…" else "שלח בקשה") }
        error?.let { Text(it, color = BadInk) }
    }
}
