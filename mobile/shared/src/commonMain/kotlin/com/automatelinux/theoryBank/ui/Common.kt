package com.automatelinux.theoryBank.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.automatelinux.theoryBank.data.model.Question

const val ALL = "הכל"
val LICENSES = listOf(ALL, "C1", "C", "B", "A", "D", "1")
val CATEGORIES = listOf(ALL, "חוקי התנועה", "תמרורים", "בטיחות", "הכרת הרכב")

// The yellow gov.il paints on the correct answer.
val AnswerYellow = Color(0xFFFFF176)
val RightGreen = Color(0xFF2E7D32)
val RightGreenBg = Color(0xFFE8F5E9)
val WrongRed = Color(0xFFC62828)
val WrongRedBg = Color(0xFFFFEBEE)

fun Question.isFor(license: String) = license == ALL || license in l

@Composable
fun ChipRow(
    options: List<String>,
    selected: String,
    tagPrefix: String,
    label: (String) -> String = { it },
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            FilterChip(
                selected = option == selected,
                onClick = { onSelect(option) },
                label = { Text(label(option)) },
                modifier = Modifier.testTag("$tagPrefix-$option"),
            )
        }
    }
}

fun licenseLabel(option: String) = if (option == ALL) "כל הרישיונות" else "רישיון $option"

@Composable
fun QuestionHeader(item: Question, prefix: String? = null) {
    Text(
        listOfNotNull(prefix, "שאלה ${item.n}", item.c).joinToString(" · "),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
    )
    Spacer(Modifier.height(4.dp))
    Text(item.q, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
}

@Composable
fun QuestionPicture(item: Question, loadImage: (String) -> ImageBitmap) {
    val file = item.i ?: return
    val bitmap = remember(file) { loadImage(file) }
    Spacer(Modifier.height(10.dp))
    Image(
        bitmap = bitmap,
        contentDescription = null,
        modifier = Modifier.fillMaxWidth().heightIn(max = 220.dp).clip(RoundedCornerShape(8.dp)),
        contentScale = ContentScale.Fit,
    )
}

enum class OptionState { Idle, Selected, Right, Wrong, Dimmed }

// One answer option. Idle/Selected while the user is still choosing; once the
// answer is revealed the correct option turns green, a wrong pick red, and the
// rest fade back.
@Composable
fun OptionButton(text: String, letter: String, state: OptionState, tag: String, onClick: (() -> Unit)?) {
    val bg by animateColorAsState(
        when (state) {
            OptionState.Right -> RightGreenBg
            OptionState.Wrong -> WrongRedBg
            OptionState.Selected -> MaterialTheme.colorScheme.primaryContainer
            else -> MaterialTheme.colorScheme.surface
        }
    )
    val border = when (state) {
        OptionState.Right -> RightGreen
        OptionState.Wrong -> WrongRed
        OptionState.Selected -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.outlineVariant
    }
    val content = if (state == OptionState.Dimmed) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
    else MaterialTheme.colorScheme.onSurface
    Surface(
        onClick = onClick ?: {},
        enabled = onClick != null,
        shape = RoundedCornerShape(10.dp),
        color = bg,
        border = BorderStroke(if (state == OptionState.Idle || state == OptionState.Dimmed) 1.dp else 2.dp, border),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(letter, fontWeight = FontWeight.Bold, color = content, modifier = Modifier.width(22.dp))
            Text(text, style = MaterialTheme.typography.bodyLarge, color = content, modifier = Modifier.weight(1f))
            when (state) {
                OptionState.Right -> Icon(Icons.Default.CheckCircle, null, tint = RightGreen, modifier = Modifier.size(22.dp))
                OptionState.Wrong -> Icon(Icons.Default.Cancel, null, tint = WrongRed, modifier = Modifier.size(22.dp))
                else -> {}
            }
        }
    }
}

val LETTERS = listOf("א", "ב", "ג", "ד")
