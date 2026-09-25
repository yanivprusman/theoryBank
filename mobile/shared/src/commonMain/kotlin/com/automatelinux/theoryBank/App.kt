package com.automatelinux.theoryBank

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.ALL
import com.automatelinux.theoryBank.ui.AnswersScreen
import com.automatelinux.theoryBank.ui.ExamScreen
import com.automatelinux.theoryBank.ui.ExamSession
import com.automatelinux.theoryBank.ui.LICENSES
import com.automatelinux.theoryBank.ui.PracticeScreen
import com.automatelinux.theoryBank.ui.PracticeSession
import com.automatelinux.theoryBank.ui.SignMark
import com.automatelinux.theoryBank.ui.isFor
import com.automatelinux.theoryBank.ui.licenseLabel
import com.automatelinux.theoryBank.ui.theme.AppTheme
import com.automatelinux.theoryBank.ui.theme.Palette
import kotlinx.serialization.json.Json

// Three ways through the same official bank:
//  Answers  — read every question with only the correct answer (the yellow one)
//  Practice — shuffled questions, all four options, instant right/wrong
//  Exam     — the real test's rules: 30 questions, 40 minutes, 26 to pass
private enum class Mode(val label: String, val title: String, val icon: ImageVector) {
    Answers("תשובות", "כל השאלות והתשובות", Icons.AutoMirrored.Filled.MenuBook),
    Practice("תרגול", "תרגול עם משוב מיידי", Icons.Default.School),
    Exam("מבחן", "מבחן כמו האמיתי", Icons.Default.Timer),
}

// Shared entry composable. The platform supplies the bundled question bank as
// JSON, a loader for the bundled pictures and the app font, so the app works
// fully offline.
@Composable
fun App(questionsJson: String, fontFamily: FontFamily, loadImage: (String) -> ImageBitmap) {
    val questions = remember(questionsJson) {
        Json.decodeFromString<List<Question>>(questionsJson)
    }
    AppTheme(fontFamily) {
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
    // Mid-exam the chrome gets out of the way, like the real test.
    val focused = mode == Mode.Exam && exam.inProgress

    Column(Modifier.fillMaxSize()) {
        AnimatedVisibility(!focused) {
            Header(mode.title, license, forLicense.size) { license = it }
        }
        Box(Modifier.weight(1f).imePadding()) {
            Crossfade(mode, label = "mode") { m ->
                when (m) {
                    Mode.Answers -> AnswersScreen(forLicense, loadImage)
                    Mode.Practice -> PracticeScreen(practice, loadImage)
                    Mode.Exam -> ExamScreen(exam, loadImage)
                }
            }
        }
        AnimatedVisibility(!focused) {
            NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
                Mode.entries.forEach { m ->
                    NavigationBarItem(
                        selected = mode == m,
                        onClick = { mode = m },
                        icon = { Icon(m.icon, contentDescription = null) },
                        label = { Text(m.label) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Palette.RoadBlue,
                            selectedTextColor = Palette.RoadBlue,
                            indicatorColor = Color(0xFFDCE6FB),
                            unselectedIconColor = Palette.InkSoft,
                            unselectedTextColor = Palette.InkSoft,
                        ),
                        modifier = Modifier.testTag("mode-${m.name.lowercase()}"),
                    )
                }
            }
        }
    }
}

@Composable
private fun Header(subtitle: String, license: String, count: Int, onLicense: (String) -> Unit) {
    Box(
        Modifier.fillMaxWidth()
            .background(Brush.verticalGradient(listOf(Palette.RoadBlueDark, Palette.RoadBlue)))
            .windowInsetsPadding(WindowInsets.statusBars)
            .padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SignMark(40.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("מאגר התאוריה", style = MaterialTheme.typography.titleLarge, color = Color.White)
                Text(
                    "$subtitle · $count שאלות",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.75f),
                )
            }
            LicensePicker(license, onLicense)
        }
    }
}

// Licence is chosen once and rarely changed, so it lives in a compact pill
// rather than taking a row of the screen.
@Composable
private fun LicensePicker(license: String, onLicense: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Surface(
            onClick = { open = true },
            shape = RoundedCornerShape(50),
            color = Color.White.copy(alpha = 0.16f),
            modifier = Modifier.testTag("license-picker"),
        ) {
            Row(Modifier.padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (license == ALL) "הכל" else license,
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White,
                )
                Icon(Icons.Default.ExpandMore, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }
        DropdownMenu(open, onDismissRequest = { open = false }, containerColor = Color.White) {
            LICENSES.forEach { option ->
                DropdownMenuItem(
                    text = { Text(licenseLabel(option)) },
                    onClick = { onLicense(option); open = false },
                    trailingIcon = {
                        if (option == license) Icon(Icons.Default.Check, null, tint = Palette.RoadBlue)
                    },
                    modifier = Modifier.testTag("license-$option"),
                )
            }
        }
    }
}
