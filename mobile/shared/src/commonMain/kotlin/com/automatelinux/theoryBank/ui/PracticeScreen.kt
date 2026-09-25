package com.automatelinux.theoryBank.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question

// Practice mode: endless shuffled questions, one at a time. Tap an answer and
// it is marked right or wrong on the spot, with the correct one shown.
// Held above the tab switcher (see App), so the score survives a tab switch.
class PracticeSession(private val questions: List<Question>) {
    var category by mutableStateOf(ALL)
        private set
    var pool by mutableStateOf(questions)
        private set
    var deck by mutableStateOf(questions.shuffled())
    var index by mutableIntStateOf(0)
    var picked by mutableStateOf<Int?>(null)
    var answered by mutableIntStateOf(0)
    var correct by mutableIntStateOf(0)
    var streak by mutableIntStateOf(0)

    fun choose(newCategory: String) {
        category = newCategory
        pool = questions.filter { newCategory == ALL || it.c == newCategory }
        restart()
    }

    fun restart() {
        deck = pool.shuffled(); index = 0; picked = null; answered = 0; correct = 0; streak = 0
    }
}

@Composable
fun PracticeScreen(session: PracticeSession, loadImage: (String) -> ImageBitmap) {
    val category = session.category
    val pool = session.pool
    var deck by session::deck
    var index by session::index
    var picked by session::picked
    var answered by session::answered
    var correct by session::correct
    var streak by session::streak
    val scroll = rememberScrollState()

    Column(Modifier.fillMaxSize()) {
        ChipRow(CATEGORIES, category, tagPrefix = "practice-category") { session.choose(it) }
        if (deck.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("אין שאלות בבחירה הזאת") }
        } else {
        val item = deck[index]
        val order = remember(item.n, index) { (0..3).shuffled() }
        LaunchedEffect(item.n, index) { scroll.scrollTo(0) }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("נכון $correct מתוך $answered", fontWeight = FontWeight.SemiBold)
            if (streak >= 3) Text("🔥 $streak ברצף", color = RightGreen, fontWeight = FontWeight.SemiBold)
            Text("${index + 1}/${deck.size}", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Column(Modifier.weight(1f).verticalScroll(scroll).padding(horizontal = 16.dp)) {
            QuestionHeader(item)
            QuestionPicture(item, loadImage)
            Spacer(Modifier.height(14.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                order.forEachIndexed { pos, opt ->
                    val state = when {
                        picked == null -> OptionState.Idle
                        opt == item.k -> OptionState.Right
                        opt == picked -> OptionState.Wrong
                        else -> OptionState.Dimmed
                    }
                    OptionButton(
                        text = item.o[opt],
                        letter = LETTERS[pos],
                        state = state,
                        tag = "practice-option-$pos",
                        onClick = if (picked == null) {
                            {
                                picked = opt
                                answered++
                                if (opt == item.k) { correct++; streak++ } else streak = 0
                            }
                        } else null,
                    )
                }
            }
            if (picked != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    if (picked == item.k) "נכון! 👏" else "טעות. התשובה הנכונה מסומנת בירוק.",
                    color = if (picked == item.k) RightGreen else WrongRed,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
            Spacer(Modifier.height(16.dp))
        }

        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val next = {
                if (index + 1 < deck.size) index++ else { deck = pool.shuffled(); index = 0 }
                picked = null
            }
            Button(onClick = next, modifier = Modifier.weight(1f).testTag("practice-next")) {
                Text(if (picked == null) "דלג" else "לשאלה הבאה")
            }
            OutlinedButton(
                onClick = { session.restart() },
                modifier = Modifier.testTag("practice-restart"),
            ) { Text("התחל מחדש") }
        }
        }
    }
}
