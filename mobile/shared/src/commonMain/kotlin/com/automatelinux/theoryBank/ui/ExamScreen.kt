package com.automatelinux.theoryBank.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.theme.Palette
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

    internal fun start() {
        exam = Exam(pool.shuffled().take(EXAM_SIZE))
        finished = false
        secondsLeft = EXAM_SECONDS
        index = 0
    }
}

@Composable
fun ExamScreen(session: ExamSession, loadImage: (String) -> ImageBitmap) {
    val current = session.exam
    when {
        current == null -> ExamIntro(session.license, session.pool.size) { session.start() }
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
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(12.dp))
        SignMark(88.dp)
        Spacer(Modifier.height(16.dp))
        Text("מוכן למבחן?", style = MaterialTheme.typography.headlineMedium)
        Spacer(Modifier.height(4.dp))
        Text(
            "סימולציה של המבחן העיוני הממוחשב · ${licenseLabel(license)}",
            color = Palette.InkSoft,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            RuleTile("$EXAM_SIZE", "שאלות", Modifier.weight(1f))
            RuleTile("40", "דקות", Modifier.weight(1f))
            RuleTile("$PASS_MARK", "נכונות לעבור", Modifier.weight(1f))
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "השאלות נבחרות באקראי מתוך $poolSize שאלות המאגר. אפשר לדלג ולחזור לשאלות עד ההגשה.",
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.InkSoft,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(28.dp))
        Button(
            onClick = onStart,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().height(56.dp).testTag("exam-start"),
        ) {
            Text("התחל מבחן", style = MaterialTheme.typography.titleMedium, color = Color.White)
        }
    }
}

@Composable
private fun RuleTile(value: String, label: String, modifier: Modifier) {
    Surface(modifier, shape = RoundedCornerShape(16.dp), color = Color.White, border = BorderStroke(1.dp, Palette.Line)) {
        Column(Modifier.padding(vertical = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.displaySmall, color = Palette.RoadBlue)
            Text(label, style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExamRunning(
    exam: Exam,
    session: ExamSession,
    loadImage: (String) -> ImageBitmap,
    onFinish: () -> Unit,
    onQuit: () -> Unit,
) {
    var index by session::index
    var confirmSubmit by remember { mutableStateOf(false) }
    var confirmQuit by remember { mutableStateOf(false) }
    var showGrid by remember { mutableStateOf(false) }
    val answeredCount = exam.picks.count { it != null }
    val last = exam.items.size - 1

    Column(Modifier.fillMaxSize()) {
        // Top bar — the same blue as the header, so the status bar stays readable.
        Column(
            Modifier.fillMaxWidth()
                .background(Brush.verticalGradient(listOf(Palette.RoadBlueDark, Palette.RoadBlue)))
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 12.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { confirmQuit = true }, modifier = Modifier.testTag("exam-quit")) {
                    Icon(Icons.Default.Close, contentDescription = "יציאה", tint = Color.White)
                }
                Text(
                    "שאלה ${index + 1} מתוך ${exam.items.size}",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
                TimerPill(session.secondsLeft)
            }
            Spacer(Modifier.height(6.dp))
            // One segment per question: filled = answered, yellow = current.
            Row(Modifier.fillMaxWidth().padding(start = 12.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                exam.items.indices.forEach { i ->
                    val color by animateColorAsState(
                        when {
                            i == index -> Palette.Highlight
                            exam.picks[i] != null -> Color.White
                            else -> Color.White.copy(alpha = 0.25f)
                        }
                    )
                    Box(Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(3.dp)).background(color))
                }
            }
        }

        AnimatedContent(
            targetState = index,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            modifier = Modifier.weight(1f),
            label = "exam-question",
        ) { i ->
            val item = exam.items[i]
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp)) {
                Panel {
                    QuestionHeader(item, prefix = "${i + 1}.")
                    QuestionPicture(item, loadImage)
                }
                Spacer(Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    exam.orders[i].forEachIndexed { pos, opt ->
                        OptionButton(
                            text = item.o[opt],
                            letter = LETTERS[pos],
                            state = if (exam.picks[i] == opt) OptionState.Selected else OptionState.Idle,
                            tag = "exam-option-$pos",
                            onClick = { exam.picks[i] = opt },
                        )
                    }
                }
            }
        }

        Surface(color = Color.White, border = BorderStroke(1.dp, Palette.Line)) {
            Row(
                Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedButton(
                    onClick = { index-- },
                    enabled = index > 0,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(48.dp).testTag("exam-prev"),
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("הקודמת")
                }
                IconButton(onClick = { showGrid = true }, modifier = Modifier.testTag("exam-toggle-grid")) {
                    Icon(Icons.Default.GridView, contentDescription = "כל השאלות", tint = Palette.Ink)
                }
                Spacer(Modifier.weight(1f))
                if (index < last) {
                    Button(
                        onClick = { index++ },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.height(48.dp).testTag("exam-next"),
                    ) {
                        Text("הבאה")
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(18.dp))
                    }
                } else {
                    Button(
                        onClick = { confirmSubmit = true },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Palette.Right),
                        modifier = Modifier.height(48.dp).testTag("exam-submit"),
                    ) { Text("הגשת המבחן") }
                }
            }
        }
    }

    if (showGrid) {
        ModalBottomSheet(
            onDismissRequest = { showGrid = false },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = Color.White,
        ) {
            QuestionGrid(exam, index, answeredCount,
                onJump = { index = it; showGrid = false },
                onSubmit = { showGrid = false; confirmSubmit = true })
        }
    }
    if (confirmSubmit) {
        val missing = exam.items.size - answeredCount
        AlertDialog(
            onDismissRequest = { confirmSubmit = false },
            containerColor = Color.White,
            title = { Text("להגיש את המבחן?") },
            text = {
                Text(if (missing > 0) "לא ענית על $missing שאלות. שאלה שלא נענתה נחשבת טעות." else "ענית על כל השאלות. בהצלחה!")
            },
            confirmButton = {
                TextButton(onClick = { confirmSubmit = false; onFinish() }, modifier = Modifier.testTag("exam-confirm-submit")) {
                    Text("הגשה")
                }
            },
            dismissButton = { TextButton(onClick = { confirmSubmit = false }) { Text("חזרה למבחן") } },
        )
    }
    if (confirmQuit) {
        AlertDialog(
            onDismissRequest = { confirmQuit = false },
            containerColor = Color.White,
            title = { Text("לצאת מהמבחן?") },
            text = { Text("התשובות שלך לא יישמרו.") },
            confirmButton = {
                TextButton(onClick = { confirmQuit = false; onQuit() }, modifier = Modifier.testTag("exam-confirm-quit")) {
                    Text("יציאה", color = Palette.Wrong)
                }
            },
            dismissButton = { TextButton(onClick = { confirmQuit = false }) { Text("המשך במבחן") } },
        )
    }
}

@Composable
private fun TimerPill(secondsLeft: Int) {
    val urgent = secondsLeft < 5 * 60
    val bg by animateColorAsState(if (urgent) Palette.Wrong else Color.White.copy(alpha = 0.16f))
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Default.Timer, null, tint = Color.White, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(formatClock(secondsLeft), color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuestionGrid(exam: Exam, index: Int, answeredCount: Int, onJump: (Int) -> Unit, onSubmit: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 20.dp)) {
        Text("כל השאלות", style = MaterialTheme.typography.titleLarge)
        Text("ענית על $answeredCount מתוך ${exam.items.size}", color = Palette.InkSoft)
        Spacer(Modifier.height(16.dp))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            maxItemsInEachRow = 6,
        ) {
            exam.items.indices.forEach { i ->
                val answered = exam.picks[i] != null
                Surface(
                    onClick = { onJump(i) },
                    shape = CircleShape,
                    color = if (answered) Palette.RoadBlue else Color.White,
                    border = BorderStroke(if (i == index) 3.dp else 1.dp, if (i == index) Palette.Highlight else Palette.Line),
                    modifier = Modifier.size(46.dp).testTag("exam-jump-${i + 1}"),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            "${i + 1}",
                            color = if (answered) Color.White else Palette.Ink,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = onSubmit,
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Palette.Right),
            modifier = Modifier.fillMaxWidth().height(52.dp).testTag("exam-submit-early"),
        ) { Text("הגשת המבחן") }
    }
}

@Composable
private fun ExamResult(exam: Exam, secondsUsed: Int, loadImage: (String) -> ImageBitmap, onAgain: () -> Unit) {
    val score = exam.score()
    val passed = score >= PASS_MARK
    val color = if (passed) Palette.Right else Palette.Wrong
    val mistakes = exam.items.indices.filter { exam.picks[it] != exam.items[it].k }
    var onlyMistakes by remember { mutableStateOf(true) }
    val reviewed = if (onlyMistakes) mistakes else exam.items.indices.toList()
    val mistakesLabel = "הטעויות (${mistakes.size})"
    val allLabel = "כל השאלות"

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Panel {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    ScoreRing(score / exam.items.size.toFloat(), color, 150.dp) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("$score", style = MaterialTheme.typography.displaySmall, color = color)
                            Text("מתוך ${exam.items.size}", style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(
                        if (passed) "עברת! 🎉" else "הפעם לא עברת",
                        style = MaterialTheme.typography.headlineMedium,
                        color = color,
                    )
                    Text(
                        if (passed) "כל הכבוד, ${mistakes.size} טעויות מתוך 4 מותרות"
                        else "${mistakes.size} טעויות, מותר עד 4. עבור על הטעויות ונסה שוב",
                        color = Palette.InkSoft,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text("זמן: ${formatClock(secondsUsed)} דקות", style = MaterialTheme.typography.bodySmall, color = Palette.InkSoft)
                    Spacer(Modifier.height(16.dp))
                    Button(
                        onClick = onAgain,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(50.dp).testTag("exam-again"),
                    ) { Text("מבחן חדש") }
                }
            }
        }
        item {
            ChipRow(listOf(mistakesLabel, allLabel), if (onlyMistakes) mistakesLabel else allLabel, tagPrefix = "review") {
                onlyMistakes = it == mistakesLabel
            }
        }
        if (reviewed.isEmpty()) {
            item {
                Text(
                    "אין טעויות, מושלם! 🏆",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    textAlign = TextAlign.Center,
                )
            }
        }
        items(reviewed, key = { it }) { i ->
            val item = exam.items[i]
            val pick = exam.picks[i]
            Panel {
                QuestionHeader(item, prefix = "${i + 1}.")
                if (pick == null) {
                    Spacer(Modifier.height(6.dp))
                    Text("לא נענתה", color = Palette.Wrong, style = MaterialTheme.typography.labelLarge)
                }
                QuestionPicture(item, loadImage)
                Spacer(Modifier.height(12.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
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
