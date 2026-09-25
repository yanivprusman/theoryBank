package com.automatelinux.theoryBank.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question

// Reading mode: every question with only its correct answer, in yellow —
// the gov.il page with the "show correct answer" button already pressed.
@Composable
fun AnswersScreen(questions: List<Question>, license: String, loadImage: (String) -> ImageBitmap) {
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf(ALL) }

    val shown = remember(questions, query, license, category) {
        val q = query.trim()
        questions.filter { item ->
            item.isFor(license) && (category == ALL || item.c == category) && (q.isEmpty() || matches(item, q))
        }
    }
    val listState = rememberLazyListState()
    LaunchedEffect(query, license, category) { listState.scrollToItem(0) }

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).testTag("search-questions"),
            singleLine = true,
            placeholder = { Text("חיפוש מילה או מספר שאלה") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = { query = "" }, modifier = Modifier.testTag("clear-search")) {
                        Icon(Icons.Default.Clear, contentDescription = "נקה")
                    }
                }
            },
        )
        Spacer(Modifier.height(4.dp))
        ChipRow(CATEGORIES, category, tagPrefix = "category") { category = it }
        Text(
            "${shown.size} שאלות",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 16.dp),
        )

        if (shown.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("אין שאלות שמתאימות לחיפוש", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(shown, key = { it.n }) { AnswerCard(it, loadImage) }
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
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            QuestionHeader(item)
            QuestionPicture(item, loadImage)
            Spacer(Modifier.height(10.dp))
            Text(
                item.answer,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(6.dp))
                    .background(AnswerYellow)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFF1B1B1B),
            )
        }
    }
}
