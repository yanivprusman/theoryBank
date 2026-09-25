package com.automatelinux.theoryBank.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.theme.Palette

// Held above the tab switcher (see App), so the score survives a tab switch.
class PracticeSession(private val questions: List<Question>) {
    var category by mutableStateOf(ALL)
        private set
    var pool by mutableStateOf(questions)
        private set
    var deck by mutableStateOf(questions.shuffled())
        private set
    var index by mutableIntStateOf(0)
        private set
    var picked by mutableStateOf<Int?>(null)
        private set
    var answered by mutableIntStateOf(0)
        private set
    var correct by mutableIntStateOf(0)
        private set
    var streak by mutableIntStateOf(0)
        private set

    fun choose(newCategory: String) {
        category = newCategory
        pool = questions.filter { newCategory == ALL || it.c == newCategory }
        restart()
    }

    fun restart() {
        deck = pool.shuffled(); index = 0; picked = null; answered = 0; correct = 0; streak = 0
    }

    fun answer(option: Int, question: Question) {
        picked = option
        answered++
        if (option == question.k) { correct++; streak++ } else streak = 0
    }

    fun next() {
        if (index + 1 < deck.size) index++ else { deck = pool.shuffled(); index = 0 }
        picked = null
    }
}

// Practice mode: endless shuffled questions, one at a time. Tap an answer and
// it is marked right or wrong on the spot, with the correct one shown.
@Composable
fun PracticeScreen(session: PracticeSession, loadImage: (String) -> ImageBitmap) {
    val haptics = LocalHapticFeedback.current
    Column(Modifier.fillMaxSize()) {
        ChipRow(CATEGORIES, session.category, tagPrefix = "practice-category", dotColor = ::categoryColor) {
            session.choose(it)
        }
        if (session.deck.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("אין שאלות בבחירה הזאת") }
        } else {
            StatsBar(session)
            AnimatedContent(
                targetState = session.index to session.deck,
                transitionSpec = { (slideInHorizontally { -it / 4 } + fadeIn()) togetherWith fadeOut() },
                modifier = Modifier.weight(1f),
                label = "question",
            ) { (index, deck) ->
                val item = deck[index]
                val order = remember(item.n, index, deck) { (0..3).shuffled() }
                // During the exit animation the old question must not show the new one's pick.
                val picked = if (session.index == index && session.deck === deck) session.picked else null
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
                    Panel {
                        QuestionHeader(item)
                        QuestionPicture(item, loadImage)
                    }
                    Spacer(Modifier.height(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        order.forEachIndexed { pos, opt ->
                            OptionButton(
                                text = item.o[opt],
                                letter = LETTERS[pos],
                                state = when {
                                    picked == null -> OptionState.Idle
                                    opt == item.k -> OptionState.Right
                                    opt == picked -> OptionState.Wrong
                                    else -> OptionState.Dimmed
                                },
                                tag = "practice-option-$pos",
                                onClick = if (picked == null) {
                                    {
                                        session.answer(opt, item)
                                        haptics.performHapticFeedback(
                                            if (opt == item.k) HapticFeedbackType.TextHandleMove else HapticFeedbackType.LongPress
                                        )
                                    }
                                } else null,
                            )
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
            BottomAction(session)
        }
    }
}

@Composable
private fun StatsBar(session: PracticeSession) {
    val pct = if (session.answered == 0) null else session.correct * 100 / session.answered
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        StatPill(pct?.let { "$it%" } ?: "—", "הצלחה", Palette.RoadBlue)
        StatPill("${session.correct}/${session.answered}", "נכונות", Palette.Right)
        StatPill(if (session.streak >= 3) "🔥 ${session.streak}" else "${session.streak}", "ברצף", Color(0xFFE07A00))
        Spacer(Modifier.weight(1f))
        IconButton(onClick = { session.restart() }, modifier = Modifier.testTag("practice-restart")) {
            Icon(Icons.Default.Refresh, contentDescription = "התחל מחדש", tint = Palette.InkSoft)
        }
    }
}

@Composable
private fun StatPill(value: String, label: String, color: Color) {
    Surface(shape = RoundedCornerShape(12.dp), color = Color.White, border = BorderStroke(1.dp, Palette.Line)) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = Palette.InkSoft)
        }
    }
}

// The one place the next step lives: a feedback bar after answering,
// a quiet "skip" before.
@Composable
private fun BottomAction(session: PracticeSession) {
    val item = session.deck[session.index]
    val picked = session.picked
    val right = picked == item.k
    Surface(
        color = when {
            picked == null -> Color.White
            right -> Palette.RightSoft
            else -> Palette.WrongSoft
        },
        border = BorderStroke(1.dp, Palette.Line),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (picked == null) {
                Text(
                    "שאלה ${session.index + 1} מתוך ${session.deck.size}",
                    color = Palette.InkSoft,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { session.next() }, modifier = Modifier.testTag("practice-skip")) { Text("דלג") }
            } else {
                Column(Modifier.weight(1f)) {
                    Text(
                        if (right) "נכון!" else "לא נכון",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (right) Palette.Right else Palette.Wrong,
                    )
                    Text(
                        if (right) encouragement(session.streak) else "התשובה הנכונה מסומנת בירוק",
                        style = MaterialTheme.typography.bodySmall,
                        color = Palette.Ink,
                    )
                }
                Button(
                    onClick = { session.next() },
                    colors = ButtonDefaults.buttonColors(containerColor = if (right) Palette.Right else Palette.Ink),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(48.dp).testTag("practice-next"),
                ) {
                    Text("הבאה")
                    Spacer(Modifier.width(6.dp))
                    // Auto-mirrored: points left, the reading direction, in RTL.
                    Icon(Icons.AutoMirrored.Filled.ArrowForward, null, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}

private fun encouragement(streak: Int) = when {
    streak >= 10 -> "$streak ברצף, אתה מוכן למבחן"
    streak >= 5 -> "$streak ברצף, ממשיכים!"
    streak >= 3 -> "$streak תשובות נכונות ברצף"
    else -> "יפה מאוד"
}
