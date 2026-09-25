package com.automatelinux.theoryBank.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.theme.Palette
import kotlinx.coroutines.launch

// Reading mode: every question with only its correct answer, in yellow —
// the gov.il page with the "show correct answer" button already pressed.
@Composable
fun AnswersScreen(questions: List<Question>, loadImage: (String) -> ImageBitmap) {
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf(ALL) }

    val shown = remember(questions, query, category) {
        val q = query.trim()
        questions.filter { item -> (category == ALL || item.c == category) && (q.isEmpty() || matches(item, q)) }
    }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val scrolledFar by remember { derivedStateOf { listState.firstVisibleItemIndex > 4 } }
    LaunchedEffect(query, category, questions) { listState.scrollToItem(0) }

    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize()) {
            SearchField(query) { query = it }
            ChipRow(CATEGORIES, category, tagPrefix = "category", dotColor = ::categoryColor) { category = it }

            if (shown.isEmpty()) {
                Column(
                    Modifier.fillMaxSize().padding(32.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Default.SearchOff, null, tint = Palette.InkSoft, modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(12.dp))
                    Text("לא נמצאו שאלות", style = MaterialTheme.typography.titleMedium)
                    Text("נסו מילה אחרת או מספר שאלה", color = Palette.InkSoft)
                }
            } else {
                LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 96.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        Text(
                            "${shown.size} שאלות",
                            style = MaterialTheme.typography.labelMedium,
                            color = Palette.InkSoft,
                        )
                    }
                    items(shown, key = { it.n }) { AnswerCard(it, loadImage) }
                }
            }
        }
        AnimatedVisibility(
            scrolledFar,
            enter = scaleIn() + fadeIn(),
            exit = scaleOut() + fadeOut(),
            modifier = Modifier.align(Alignment.BottomStart).padding(20.dp),
        ) {
            FloatingActionButton(
                onClick = { scope.launch { listState.animateScrollToItem(0) } },
                containerColor = Palette.Ink,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.testTag("scroll-to-top"),
            ) { Icon(Icons.Default.KeyboardArrowUp, contentDescription = "לראש הרשימה") }
        }
    }
}

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Palette.Line),
        modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp),
    ) {
        Row(Modifier.padding(start = 14.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Search, null, tint = Palette.InkSoft)
            Spacer(Modifier.width(10.dp))
            Box(Modifier.weight(1f).padding(vertical = 15.dp)) {
                if (query.isEmpty()) {
                    Text("חיפוש מילה או מספר שאלה", color = Palette.InkSoft, style = MaterialTheme.typography.bodyLarge)
                }
                BasicTextField(
                    value = query,
                    onValueChange = onChange,
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = Palette.Ink),
                    cursorBrush = SolidColor(Palette.RoadBlue),
                    modifier = Modifier.fillMaxWidth().testTag("search-questions"),
                )
            }
            if (query.isNotEmpty()) {
                IconButton(onClick = { onChange("") }, modifier = Modifier.testTag("clear-search")) {
                    Icon(Icons.Default.Clear, contentDescription = "נקה", tint = Palette.InkSoft)
                }
            } else {
                Spacer(Modifier.width(10.dp))
            }
        }
    }
}

// A number searches by question number (prefix, so "13" narrows as you type);
// anything else searches the question and answer text.
private fun matches(item: Question, q: String): Boolean =
    if (q.all { it.isDigit() }) item.n.toString().startsWith(q.trimStart('0').ifEmpty { "0" })
    else item.q.contains(q) || item.answer.contains(q)

@Composable
private fun AnswerCard(item: Question, loadImage: (String) -> ImageBitmap) {
    Panel {
        QuestionHeader(item)
        QuestionPicture(item, loadImage)
        Spacer(Modifier.height(12.dp))
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Palette.HighlightSoft)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            Box(Modifier.width(4.dp).height(22.dp).clip(RoundedCornerShape(2.dp)).background(Palette.Highlight))
            Spacer(Modifier.width(10.dp))
            Text(
                item.answer,
                style = MaterialTheme.typography.bodyLarge,
                color = Palette.Ink,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.CheckCircle, null, tint = Palette.Right, modifier = Modifier.size(20.dp))
        }
    }
}
