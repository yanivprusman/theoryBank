package com.automatelinux.theoryBank

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.theme.AppTheme
import kotlinx.serialization.json.Json

private const val ALL = "הכל"
private val LICENSES = listOf(ALL, "C1", "C", "B", "A", "D", "1")
private val CATEGORIES = listOf(ALL, "חוקי התנועה", "תמרורים", "בטיחות", "הכרת הרכב")

// The yellow gov.il paints on the correct answer.
private val AnswerYellow = Color(0xFFFFF176)

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
                QuestionBank(questions, loadImage)
            }
        }
    }
}

@Composable
private fun QuestionBank(questions: List<Question>, loadImage: (String) -> ImageBitmap) {
    var query by rememberSaveable { mutableStateOf("") }
    var license by rememberSaveable { mutableStateOf("C1") }
    var category by rememberSaveable { mutableStateOf(ALL) }

    val shown = remember(questions, query, license, category) {
        val q = query.trim()
        questions.filter { item ->
            (license == ALL || license in item.l) &&
                (category == ALL || item.c == category) &&
                (q.isEmpty() || matches(item, q))
        }
    }
    val listState = rememberLazyListState()
    LaunchedEffect(query, license, category) { listState.scrollToItem(0) }

    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp)) {
            Text(
                "מאגר שאלות התאוריה",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${shown.size} מתוך ${questions.size} שאלות · המאגר הרשמי של משרד התחבורה",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().testTag("search-questions"),
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
        }
        ChipRow(LICENSES, license, tagPrefix = "license") { license = it }
        ChipRow(CATEGORIES, category, tagPrefix = "category") { category = it }

        if (shown.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("אין שאלות שמתאימות לחיפוש", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(shown, key = { it.n }) { QuestionCard(it, loadImage) }
            }
        }
    }
}

// A number searches by question number (prefix, so "13" narrows as you type);
// anything else searches the question and answer text.
private fun matches(item: Question, q: String): Boolean =
    if (q.all { it.isDigit() }) item.n.toString().startsWith(q.trimStart('0').ifEmpty { "0" })
    else item.q.contains(q) || item.a.contains(q)

@Composable
private fun ChipRow(options: List<String>, selected: String, tagPrefix: String, onSelect: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            FilterChip(
                selected = option == selected,
                onClick = { onSelect(option) },
                label = { Text(if (tagPrefix == "license" && option != ALL) "רישיון $option" else option) },
                modifier = Modifier.testTag("$tagPrefix-$option"),
            )
        }
    }
}

@Composable
private fun QuestionCard(item: Question, loadImage: (String) -> ImageBitmap) {
    Card(
        Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            Text(
                "שאלה ${item.n} · ${item.c}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            Text(item.q, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            item.i?.let { file ->
                val bitmap = remember(file) { loadImage(file) }
                Spacer(Modifier.height(10.dp))
                Image(
                    bitmap = bitmap,
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp).clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Fit,
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                item.a,
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
