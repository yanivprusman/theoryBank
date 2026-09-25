package com.automatelinux.theoryBank.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.automatelinux.theoryBank.data.model.Question
import kotlinx.coroutines.delay

// The real computerised test's rules: 30 random questions, 40 minutes,
// at least 26 correct (up to 4 mistakes) to pass.
private const val EXAM_SIZE = 30
private const val EXAM_SECONDS = 40 * 60
private const val PASS_MARK = 26

internal class Exam(val items: List<Question>) {
    val orders = items.map { (0..3).shuffled() }
    val picks = mutableStateListOf<Int?>().apply { repeat(items.size) { add(null) } }
    fun score() = items.indices.count { picks[it] == items[it].k }
}

// Held above the tab switcher (see App), so leaving the tab mid-exam keeps the
// exam; the clock only runs while the exam is on screen.
class ExamSession(val license: String, val pool: List<Question>) {
    internal var exam by mutableStateOf<Exam?>(null)
    internal var finished by mutableStateOf(false)
    internal var secondsLeft by mutableIntStateOf(EXAM_SECONDS)
    internal var index by mutableIntStateOf(0)
    val inProgress: Boolean get() = exam != null && !finished
}

@Composable
fun ExamScreen(session: ExamSession, loadImage: (String) -> ImageBitmap) {
    val current = session.exam
    when {
        current == null -> ExamIntro(session.license, session.pool.size) {
            session.exam = Exam(session.pool.shuffled().take(EXAM_SIZE))
            session.finished = false
            session.secondsLeft = EXAM_SECONDS
            session.index = 0
        }
        session.finished -> ExamResult(current, EXAM_SECONDS - session.secondsLeft, loadImage) { session.exam = null }
        else -> {
            LaunchedEffect(current) {
                while (session.secondsLeft > 0) { delay(1000); session.secondsLeft-- }
                session.finished = true
            }
            ExamRunning(
                current, session, loadImage,
                onFinish = { session.finished = true },
                onQuit = { session.exam = null },
            )
        }
    }
}

@Composable
private fun ExamIntro(license: String, poolSize: Int, onStart: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("📝", fontSize = 56.sp)
        Spacer(Modifier.height(12.dp))
        Text("מבחן תאוריה", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(licenseLabel(license), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(20.dp))
        Text(
            "$EXAM_SIZE שאלות אקראיות מתוך $poolSize\n40 דקות\nכדי לעבור צריך $PASS_MARK תשובות נכונות (עד 4 טעויות)",
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodyLarge,
        )
        Spacer(Modifier.height(28.dp))
        Button(onClick = onStart, modifier = Modifier.fillMaxWidth().height(52.dp).testTag("exam-start")) {
            Text("התחל מבחן", style = MaterialTheme.typography.titleMedium)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExamRunning(
    exam: Exam,
    session: ExamSession,
    loadImage: (String) -> ImageBitmap,
    onFinish: () -> Unit,
    onQuit: () -> Unit,
) {
    val secondsLeft = session.secondsLeft
    var index by session::index
    var confirmSubmit by remember { mutableStateOf(false) }
    var confirmQuit by remember { mutableStateOf(false) }
    var showGrid by remember { mutableStateOf(false) }
    val scroll = rememberScrollState()
    LaunchedEffect(index) { scroll.scrollTo(0) }
    val item = exam.items[index]
    val answeredCount = exam.picks.count { it != null }

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            TextButton(onClick = { showGrid = !showGrid }, modifier = Modifier.testTag("exam-toggle-grid")) {
                Text("שאלה ${index + 1} מתוך ${exam.items.size} ▾")
            }
            Text(
                "⏱ ${secondsLeft / 60}:${(secondsLeft % 60).toString().padStart(2, '0')}",
                fontWeight = FontWeight.Bold,
                color = if (secondsLeft < 5 * 60) WrongRed else MaterialTheme.colorScheme.onSurface,
            )
        }
        LinearProgressIndicator(
            progress = { answeredCount / exam.items.size.toFloat() },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        )
        if (showGrid) {
            FlowRow(
                Modifier.fillMaxWidth().padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                exam.items.indices.forEach { i ->
                    val answered = exam.picks[i] != null
                    Surface(
                        onClick = { index = i; showGrid = false },
                        shape = CircleShape,
                        color = if (answered) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
                        border = BorderStroke(
                            if (i == index) 2.dp else 1.dp,
                            if (i == index) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.outline,
                        ),
                        modifier = Modifier.size(36.dp).testTag("exam-jump-${i + 1}"),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                "${i + 1}",
                                color = if (answered) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                }
            }
        }

        Column(Modifier.weight(1f).verticalScroll(scroll).padding(16.dp)) {
            QuestionHeader(item)
            QuestionPicture(item, loadImage)
            Spacer(Modifier.height(14.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                exam.orders[index].forEachIndexed { pos, opt ->
                    OptionButton(
                        text = item.o[opt],
                        letter = LETTERS[pos],
                        state = if (exam.picks[index] == opt) OptionState.Selected else OptionState.Idle,
                        tag = "exam-option-$pos",
                        onClick = { exam.picks[index] = opt },
                    )
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedButton(
                onClick = { index-- },
                enabled = index > 0,
                modifier = Modifier.weight(1f).testTag("exam-prev"),
            ) { Text("הקודמת") }
            if (index < exam.items.size - 1) {
                Button(onClick = { index++ }, modifier = Modifier.weight(1f).testTag("exam-next")) { Text("הבאה") }
            } else {
                Button(onClick = { confirmSubmit = true }, modifier = Modifier.weight(1f).testTag("exam-submit")) {
                    Text("הגש מבחן")
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = { confirmQuit = true }, modifier = Modifier.testTag("exam-quit")) { Text("יציאה") }
            TextButton(onClick = { confirmSubmit = true }, modifier = Modifier.testTag("exam-submit-early")) {
                Text("הגש עכשיו")
            }
        }
    }

    if (confirmSubmit) {
        val missing = exam.items.size - answeredCount
        AlertDialog(
            onDismissRequest = { confirmSubmit = false },
            title = { Text("להגיש את המבחן?") },
            text = { Text(if (missing > 0) "לא ענית על $missing שאלות. שאלה שלא נענתה נחשבת טעות." else "ענית על כל השאלות.") },
            confirmButton = {
                TextButton(onClick = { confirmSubmit = false; onFinish() }, modifier = Modifier.testTag("exam-confirm-submit")) {
                    Text("הגש")
                }
            },
            dismissButton = { TextButton(onClick = { confirmSubmit = false }) { Text("חזרה למבחן") } },
        )
    }
    if (confirmQuit) {
        AlertDialog(
            onDismissRequest = { confirmQuit = false },
            title = { Text("לצאת מהמבחן?") },
            text = { Text("התשובות שלך לא יישמרו.") },
            confirmButton = {
                TextButton(onClick = { confirmQuit = false; onQuit() }, modifier = Modifier.testTag("exam-confirm-quit")) {
                    Text("יציאה")
                }
            },
            dismissButton = { TextButton(onClick = { confirmQuit = false }) { Text("המשך במבחן") } },
        )
    }
}

@Composable
private fun ExamResult(exam: Exam, secondsUsed: Int, loadImage: (String) -> ImageBitmap, onAgain: () -> Unit) {
    val score = exam.score()
    val passed = score >= PASS_MARK
    var onlyMistakes by remember { mutableStateOf(true) }
    val reviewed = exam.items.indices.filter { !onlyMistakes || exam.picks[it] != exam.items[it].k }

    LazyColumn(
        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = if (passed) RightGreenBg else WrongRedBg),
            ) {
                Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (passed) "🎉" else "😕", fontSize = 48.sp)
                    Text(
                        if (passed) "עברת!" else "לא עברת הפעם",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (passed) RightGreen else WrongRed,
                    )
                    Text("$score / ${exam.items.size} תשובות נכונות", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${exam.items.size - score} טעויות · זמן ${secondsUsed / 60}:${(secondsUsed % 60).toString().padStart(2, '0')} דקות",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(14.dp))
                    Button(onClick = onAgain, modifier = Modifier.testTag("exam-again")) { Text("מבחן חדש") }
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = onlyMistakes,
                    onClick = { onlyMistakes = true },
                    label = { Text("רק הטעויות") },
                    modifier = Modifier.testTag("review-mistakes"),
                )
                FilterChip(
                    selected = !onlyMistakes,
                    onClick = { onlyMistakes = false },
                    label = { Text("כל השאלות") },
                    modifier = Modifier.testTag("review-all"),
                )
            }
        }
        if (reviewed.isEmpty()) {
            item { Text("אין טעויות — מושלם! 🏆", modifier = Modifier.padding(8.dp), fontWeight = FontWeight.SemiBold) }
        }
        itemsIndexed(reviewed, key = { _, i -> i }) { _, i ->
            val item = exam.items[i]
            val pick = exam.picks[i]
            Card(
                Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
            ) {
                Column(Modifier.padding(14.dp)) {
                    QuestionHeader(item, prefix = "${i + 1}.")
                    if (pick == null) Text("לא נענתה", color = WrongRed, fontWeight = FontWeight.SemiBold)
                    QuestionPicture(item, loadImage)
                    Spacer(Modifier.height(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        exam.orders[i].forEachIndexed { pos, opt ->
                            OptionButton(
                                text = item.o[opt],
                                letter = LETTERS[pos],
                                state = when (opt) {
                                    item.k -> OptionState.Right
                                    pick -> OptionState.Wrong
                                    else -> OptionState.Dimmed
                                },
                                tag = "review-$i-option-$pos",
                                onClick = null,
                            )
                        }
                    }
                }
            }
        }
    }
}
