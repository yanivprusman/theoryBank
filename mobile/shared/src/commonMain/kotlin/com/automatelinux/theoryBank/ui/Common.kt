package com.automatelinux.theoryBank.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.automatelinux.theoryBank.data.model.Question
import com.automatelinux.theoryBank.ui.theme.Palette

const val ALL = "הכל"
val LICENSES = listOf(ALL, "C1", "C", "B", "A", "D", "1")
val CATEGORIES = listOf(ALL, "חוקי התנועה", "תמרורים", "בטיחות", "הכרת הרכב")
val LETTERS = listOf("א", "ב", "ג", "ד")

fun Question.isFor(license: String) = license == ALL || license in l

fun licenseLabel(option: String) = if (option == ALL) "כל הרישיונות" else "רישיון $option"

// Each topic keeps one colour everywhere it appears.
fun categoryColor(category: String): Color = when (category) {
    "חוקי התנועה" -> Palette.RoadBlue
    "תמרורים" -> Palette.SignRed
    "בטיחות" -> Color(0xFFE07A00)
    "הכרת הרכב" -> Color(0xFF00897B)
    else -> Palette.InkSoft
}

fun formatClock(seconds: Int) = "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}"

// The app's mark — the same warning-triangle-with-a-question as the launcher icon.
@Composable
fun SignMark(size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val w = this.size.width
            val stroke = w * 0.1f
            val path = Path().apply {
                moveTo(w / 2, stroke * 0.9f)
                lineTo(w - stroke * 0.7f, w * 0.86f)
                lineTo(stroke * 0.7f, w * 0.86f)
                close()
            }
            drawPath(path, Color.White)
            drawPath(path, Palette.SignRed, style = Stroke(width = stroke, join = StrokeJoin.Round))
        }
        Text(
            "?",
            color = Palette.Ink,
            fontWeight = FontWeight.ExtraBold,
            fontSize = (size.value * 0.38f).sp,
            modifier = Modifier.padding(top = size * 0.2f),
        )
    }
}

@Composable
fun ChipRow(
    options: List<String>,
    selected: String,
    tagPrefix: String,
    dotColor: ((String) -> Color)? = null,
    onSelect: (String) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            val on = option == selected
            val bg by animateColorAsState(if (on) Palette.Ink else Color.White)
            Surface(
                onClick = { onSelect(option) },
                shape = RoundedCornerShape(50),
                color = bg,
                border = if (on) null else BorderStroke(1.dp, Palette.Line),
                modifier = Modifier.testTag("$tagPrefix-$option"),
            ) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (dotColor != null && option != ALL) {
                        Box(Modifier.size(8.dp).clip(CircleShape).background(dotColor(option)))
                        Spacer(Modifier.width(7.dp))
                    }
                    Text(
                        option,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (on) Color.White else Palette.Ink,
                    )
                }
            }
        }
    }
}

@Composable
fun CategoryTag(category: String) {
    val c = categoryColor(category)
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(c.copy(alpha = 0.1f)).padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(c))
        Spacer(Modifier.width(6.dp))
        Text(category, style = MaterialTheme.typography.labelMedium, color = c)
    }
}

@Composable
fun QuestionHeader(item: Question, prefix: String? = null) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            prefix ?: "#${item.n}",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Bold,
            color = Palette.InkSoft,
        )
        Spacer(Modifier.width(10.dp))
        CategoryTag(item.c)
    }
    Spacer(Modifier.height(10.dp))
    Text(item.q, style = MaterialTheme.typography.titleMedium, color = Palette.Ink)
}

@Composable
fun QuestionPicture(item: Question, loadImage: (String) -> ImageBitmap) {
    val file = item.i ?: return
    val bitmap = remember(file) { loadImage(file) }
    Spacer(Modifier.height(12.dp))
    Box(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color.White)
            .border(1.dp, Palette.Line, RoundedCornerShape(12.dp)).padding(6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            bitmap = bitmap,
            contentDescription = null,
            // Scale to the card's width: the source pictures are only 350px wide, and a
            // sign drawn at its native size is too small to read.
            modifier = Modifier.fillMaxWidth().aspectRatio(bitmap.width / bitmap.height.toFloat())
                .clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Fit,
        )
    }
}

enum class OptionState { Idle, Selected, Right, Wrong, Dimmed }

// One answer option. Idle/Selected while the user is choosing; once revealed
// the correct option turns green, a wrong pick red, and the rest fade back.
@Composable
fun OptionButton(text: String, letter: String, state: OptionState, tag: String, onClick: (() -> Unit)?) {
    val accent = when (state) {
        OptionState.Right -> Palette.Right
        OptionState.Wrong -> Palette.Wrong
        OptionState.Selected -> Palette.RoadBlue
        else -> Palette.Line
    }
    val bg by animateColorAsState(
        when (state) {
            OptionState.Right -> Palette.RightSoft
            OptionState.Wrong -> Palette.WrongSoft
            OptionState.Selected -> Color(0xFFE8EFFD)
            else -> Color.White
        }
    )
    val border by animateColorAsState(accent)
    val alpha by animateFloatAsState(if (state == OptionState.Dimmed) 0.5f else 1f)
    val strong = state == OptionState.Right || state == OptionState.Wrong || state == OptionState.Selected
    Surface(
        onClick = onClick ?: {},
        enabled = onClick != null,
        shape = RoundedCornerShape(14.dp),
        color = bg,
        border = BorderStroke(if (strong) 2.dp else 1.dp, border),
        modifier = Modifier.fillMaxWidth().testTag(tag),
    ) {
        Row(
            Modifier.padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(30.dp).clip(CircleShape)
                    .background(if (strong) accent else Color.Transparent)
                    .border(if (strong) 0.dp else 1.5.dp, if (strong) Color.Transparent else Palette.Line, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                when (state) {
                    OptionState.Right -> Icon(Icons.Default.Check, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    OptionState.Wrong -> Icon(Icons.Default.Close, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    else -> Text(
                        letter,
                        fontWeight = FontWeight.Bold,
                        color = if (strong) Color.White else Palette.InkSoft.copy(alpha = alpha),
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text,
                style = MaterialTheme.typography.bodyLarge,
                color = Palette.Ink.copy(alpha = alpha),
                fontWeight = if (state == OptionState.Right) FontWeight.Medium else FontWeight.Normal,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

// A white card on the page, the one container every screen uses.
@Composable
fun Panel(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = Color.White,
        border = BorderStroke(1.dp, Palette.Line),
    ) {
        Column(Modifier.padding(16.dp)) { content() }
    }
}

// Circular score ring used on the exam result.
@Composable
fun ScoreRing(fraction: Float, color: Color, size: Dp, content: @Composable () -> Unit) {
    val sweep by animateFloatAsState(fraction)
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val stroke = this.size.width * 0.09f
            val inset = stroke / 2
            val arcSize = androidx.compose.ui.geometry.Size(this.size.width - stroke, this.size.height - stroke)
            drawArc(color.copy(alpha = 0.15f), 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
            drawArc(color, -90f, 360f * sweep, false, Offset(inset, inset), arcSize,
                style = Stroke(stroke, cap = androidx.compose.ui.graphics.StrokeCap.Round))
        }
        content()
    }
}
