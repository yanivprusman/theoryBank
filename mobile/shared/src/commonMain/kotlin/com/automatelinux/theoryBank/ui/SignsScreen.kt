package com.automatelinux.theoryBank.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.data.model.Sign
import com.automatelinux.theoryBank.ui.theme.Palette

// The table's parts, in its own order, each in the colour its signs are drawn in.
val SIGN_PARTS = listOf(
    "אזהרה והתראה", "הוריה", "זכות קדימה", "איסורים והגבלות", "תחבורה ציבורית",
    "מודיעין והדרכה", "רמזורים ובקרת נתיבים", "סימון על פני הדרך", "אתר עבודה",
)

fun partColor(part: String): Color = when (part) {
    "אזהרה והתראה", "איסורים והגבלות" -> Palette.SignRed
    "הוריה", "מודיעין והדרכה" -> Palette.RoadBlue
    "זכות קדימה" -> Color(0xFFB8860B)
    "תחבורה ציבורית" -> Color(0xFFC79A00)
    "רמזורים ובקרת נתיבים" -> Palette.Right
    "סימון על פני הדרך" -> Color(0xFF546E7A)
    "אתר עבודה" -> Color(0xFFE07A00)
    else -> Palette.InkSoft
}

// Signs by number, and which questions name which sign. A question names a sign
// when it says "תמרור 117", or when its answer options are sign numbers
// ("209 / 212 / 207 / 208") AND it has a picture of those signs — without one a
// bare number is a quantity: question 1687's "110" is 110 km/h, not sign 110.
// Questions that only show a sign's picture can't be linked.
class SignBook(val signs: List<Sign>, questions: List<Question>) {
    private val byNumber = signs.associateBy { it.n }

    fun mentioned(q: Question): List<Sign> {
        val inText = Regex("""תמרור(?:ים)?\s+(\d{3}פ?)""").findAll(q.q).map { it.groupValues[1] }
        val asOptions = if (q.i != null) q.o.map { it.trim().trimEnd('.') } else emptyList()
        val renumbered = OLD_NUMBERS[q.n].orEmpty()
        return (inText + asOptions).map { renumbered[it] ?: it }.distinct().mapNotNull { byNumber[it] }.toList()
    }

    private val questionsBySign: Map<String, List<Question>> =
        questions.flatMap { q -> mentioned(q).map { it.n to q } }.groupBy({ it.first }, { it.second })

    fun questionsFor(sign: Sign): List<Question> = questionsBySign[sign.n].orEmpty()
}

// Questions whose picture still uses the pre-2011 numbering, checked by eye
// against the 2022 table (question -> printed number -> today's number). The
// question text stays as the ministry publishes it; only the link follows the
// sign actually pictured. 1803: its winding road is labelled 107, today's 106
// (107 is now the chevron board).
private val OLD_NUMBERS = mapOf(1803 to mapOf("107" to "106"))

// Opens a sign's page from anywhere a sign number shows up.
val LocalOpenSign = compositionLocalOf<(Sign) -> Unit> { {} }
val LocalSignBook = compositionLocalOf<SignBook?> { null }

@Composable
fun SignPicture(sign: Sign, loadImage: (String) -> ImageBitmap, size: Dp, modifier: Modifier = Modifier) {
    val bitmap = remember(sign.i) { loadImage("signs/${sign.i}") }
    Image(
        bitmap = bitmap,
        contentDescription = "תמרור ${sign.n}",
        contentScale = ContentScale.Fit,
        modifier = modifier.size(size),
    )
}

// The signs a question names, as tappable chips under it. Callers show this only
// once the answer is known, so it can never give an answer away.
@Composable
fun SignRefs(item: Question, loadImage: (String) -> ImageBitmap) {
    val book = LocalSignBook.current ?: return
    val signs = remember(item.n, book) { book.mentioned(item) }
    if (signs.isEmpty()) return
    val open = LocalOpenSign.current
    Spacer(Modifier.height(12.dp))
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("תמרורים בשאלה", style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
        signs.forEach { sign ->
            Surface(
                onClick = { open(sign) },
                shape = RoundedCornerShape(50),
                color = Color.White,
                border = BorderStroke(1.dp, Palette.Line),
                modifier = Modifier.testTag("sign-ref-${item.n}-${sign.n}"),
            ) {
                Row(Modifier.padding(start = 6.dp, end = 12.dp, top = 4.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    SignPicture(sign, loadImage, 26.dp)
                    Spacer(Modifier.width(6.dp))
                    Text(sign.n, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = Palette.Ink)
                }
            }
        }
    }
}

// The signs tab: the whole official table, searchable by number or by word.
@Composable
fun SignsScreen(book: SignBook, loadImage: (String) -> ImageBitmap) {
    var query by rememberSaveable { mutableStateOf("") }
    var part by rememberSaveable { mutableStateOf(ALL) }
    val shown = remember(book, query, part) {
        val q = query.trim()
        book.signs.filter { s -> (part == ALL || s.p == part) && (q.isEmpty() || matchesSign(s, q)) }
    }
    val open = LocalOpenSign.current
    val listState = rememberLazyListState()
    LaunchedEffect(query, part) { listState.scrollToItem(0) }

    Column(Modifier.fillMaxSize()) {
        SearchField(query, "חיפוש מספר תמרור או מילה", "search-signs") { query = it }
        ChipRow(listOf(ALL) + SIGN_PARTS, part, tagPrefix = "sign-part", dotColor = ::partColor) { part = it }
        if (shown.isEmpty()) {
            Column(
                Modifier.fillMaxSize().padding(32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(Icons.Default.SearchOff, null, tint = Palette.InkSoft, modifier = Modifier.size(48.dp))
                Spacer(Modifier.height(12.dp))
                Text("לא נמצאו תמרורים", style = MaterialTheme.typography.titleMedium)
                Text("נסו מספר תמרור או מילה אחרת", color = Palette.InkSoft)
            }
        } else {
            LazyColumn(
                state = listState,
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 2.dp, bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                item {
                    Text(
                        "${shown.size} תמרורים · לוח התמרורים הרשמי, ספטמבר 2022",
                        style = MaterialTheme.typography.labelMedium,
                        color = Palette.InkSoft,
                    )
                }
                items(shown, key = { it.n }) { sign -> SignRow(sign, book, loadImage) { open(sign) } }
            }
        }
    }
}

// A number searches by sign number (prefix, so "12" narrows as you type);
// anything else searches the wording.
private fun matchesSign(s: Sign, q: String): Boolean =
    if (q.first().isDigit()) s.n.startsWith(q)
    else s.t.contains(q) || s.w.contains(q) || s.s?.contains(q) == true

@Composable
private fun SignRow(sign: Sign, book: SignBook, loadImage: (String) -> ImageBitmap, onClick: () -> Unit) {
    val asked = remember(sign.n, book) { book.questionsFor(sign).size }
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Palette.Line),
        modifier = Modifier.fillMaxWidth().testTag("sign-${sign.n}"),
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) { SignPicture(sign, loadImage, 64.dp) }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(sign.n, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = partColor(sign.p))
                    if (asked > 0) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            if (asked == 1) "בשאלה אחת" else "ב-$asked שאלות",
                            style = MaterialTheme.typography.labelSmall,
                            color = Palette.InkSoft,
                            modifier = Modifier.clip(RoundedCornerShape(50)).background(Palette.Page)
                                .padding(horizontal = 8.dp, vertical = 2.dp),
                        )
                    }
                }
                Text(
                    sign.headline,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.Ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

// A sign's page: picture, its meaning, where it applies, and every question
// (for the chosen licence) that names it, with the correct answer.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SignSheet(sign: Sign, book: SignBook, loadImage: (String) -> ImageBitmap, onDismiss: () -> Unit) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val questions = remember(sign.n, book) { book.questionsFor(sign) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state, containerColor = Palette.Page) {
        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.testTag("sign-sheet"),
        ) {
            item {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    SignPicture(sign, loadImage, 150.dp)
                    Spacer(Modifier.height(10.dp))
                    Text("תמרור ${sign.n}", style = MaterialTheme.typography.headlineSmall, color = Palette.Ink)
                    Spacer(Modifier.height(6.dp))
                    PartTag(sign.p)
                }
            }
            item {
                Panel {
                    if (sign.s != null) {
                        Text(sign.s, style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
                        Spacer(Modifier.height(12.dp))
                        Label("הנוסח הרשמי")
                    } else {
                        Label("פירושו")
                    }
                    Text(sign.t, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink)
                    if (sign.w.isNotEmpty()) {
                        Spacer(Modifier.height(12.dp))
                        Label("כוחו יפה")
                        Text(sign.w, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink)
                    }
                }
            }
            if (questions.isNotEmpty()) {
                item {
                    Text(
                        if (questions.size == 1) "שאלה אחת על התמרור" else "${questions.size} שאלות על התמרור",
                        style = MaterialTheme.typography.titleSmall,
                        color = Palette.InkSoft,
                    )
                }
                items(questions, key = { it.n }) { q ->
                    Panel {
                        QuestionHeader(q)
                        QuestionPicture(q, loadImage)
                        Spacer(Modifier.height(10.dp))
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 40.dp).clip(RoundedCornerShape(12.dp))
                                .background(Palette.HighlightSoft).padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(q.answer, style = MaterialTheme.typography.bodyLarge, color = Palette.Ink, modifier = Modifier.weight(1f))
                            Spacer(Modifier.width(8.dp))
                            Icon(Icons.Default.CheckCircle, null, tint = Palette.Right, modifier = Modifier.size(20.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Label(text: String) {
    Text(text, style = MaterialTheme.typography.labelMedium, color = Palette.InkSoft)
    Spacer(Modifier.height(2.dp))
}

@Composable
private fun PartTag(part: String) {
    val c = partColor(part)
    Text(
        part,
        style = MaterialTheme.typography.labelMedium,
        color = c,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(c.copy(alpha = 0.1f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}
