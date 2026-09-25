package com.automatelinux.theoryBank

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.AnswersScreen
import com.automatelinux.theoryBank.ui.ChipRow
import com.automatelinux.theoryBank.ui.ExamScreen
import com.automatelinux.theoryBank.ui.ExamSession
import com.automatelinux.theoryBank.ui.LICENSES
import com.automatelinux.theoryBank.ui.PracticeScreen
import com.automatelinux.theoryBank.ui.PracticeSession
import com.automatelinux.theoryBank.ui.isFor
import com.automatelinux.theoryBank.ui.licenseLabel
import com.automatelinux.theoryBank.ui.theme.AppTheme
import kotlinx.serialization.json.Json

// Three ways through the same official bank:
//  Answers  — read every question with only the correct answer (the yellow one)
//  Practice — shuffled questions, all four options, instant right/wrong
//  Exam     — the real test's rules: 30 questions, 40 minutes, 26 to pass
private enum class Mode(val label: String) { Answers("תשובות"), Practice("תרגול"), Exam("מבחן") }

// Shared entry composable. The platform supplies the bundled question bank as
// JSON and a loader for the bundled pictures, so the app works fully offline.
@Composable
fun App(questionsJson: String, loadImage: (String) -> ImageBitmap) {
    val questions = remember(questionsJson) {
        Json.decodeFromString<List<Question>>(questionsJson)
    }
    AppTheme {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                Home(questions, loadImage)
            }
        }
    }
}

@Composable
private fun Home(questions: List<Question>, loadImage: (String) -> ImageBitmap) {
    var mode by rememberSaveable { mutableStateOf(Mode.Answers) }
    var license by rememberSaveable { mutableStateOf("C1") }
    val forLicense = remember(questions, license) { questions.filter { it.isFor(license) } }
    val practice = remember(forLicense) { PracticeSession(forLicense) }
    val exam = remember(forLicense) { ExamSession(license, forLicense) }
    // Mid-exam the header stays out of the way, like the real test.
    val examRunning = mode == Mode.Exam && exam.inProgress

    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        if (!examRunning) {
            Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp)) {
                Text("מאגר שאלות התאוריה", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    "${questions.size} שאלות · המאגר הרשמי של משרד התחבורה",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    Mode.entries.forEachIndexed { i, m ->
                        SegmentedButton(
                            selected = mode == m,
                            onClick = { mode = m },
                            shape = SegmentedButtonDefaults.itemShape(i, Mode.entries.size),
                            modifier = Modifier.testTag("mode-${m.name.lowercase()}"),
                        ) { Text(m.label) }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
            ChipRow(LICENSES, license, tagPrefix = "license", label = ::licenseLabel) { license = it }
            Spacer(Modifier.height(4.dp))
        }
        when (mode) {
            Mode.Answers -> AnswersScreen(questions, license, loadImage)
            Mode.Practice -> PracticeScreen(practice, loadImage)
            Mode.Exam -> ExamScreen(exam, loadImage)
        }
    }
}
