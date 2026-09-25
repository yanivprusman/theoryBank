package com.automatelinux.theoryBank.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Palette taken from the road: information-sign blue, warning-sign red,
// and the yellow gov.il paints on the correct answer.
object Palette {
    val RoadBlue = Color(0xFF1646A8)
    val RoadBlueDark = Color(0xFF0E3380)
    val SignRed = Color(0xFFD32F2F)
    val Highlight = Color(0xFFFFD400)
    val HighlightSoft = Color(0xFFFFEE99)
    val Ink = Color(0xFF0F1B3D)
    val InkSoft = Color(0xFF5B6784)
    val Page = Color(0xFFF3F5FA)
    val Line = Color(0xFFE1E6F0)
    val Right = Color(0xFF1E8E4E)
    val RightSoft = Color(0xFFE3F5EA)
    val Wrong = Color(0xFFD32F2F)
    val WrongSoft = Color(0xFFFDE8E8)
}

private val Colors = lightColorScheme(
    primary = Palette.RoadBlue,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE6FB),
    onPrimaryContainer = Palette.RoadBlueDark,
    secondary = Palette.Highlight,
    onSecondary = Palette.Ink,
    secondaryContainer = Palette.HighlightSoft,
    onSecondaryContainer = Palette.Ink,
    tertiary = Palette.SignRed,
    background = Palette.Page,
    onBackground = Palette.Ink,
    surface = Color.White,
    onSurface = Palette.Ink,
    surfaceVariant = Color(0xFFEDF0F7),
    onSurfaceVariant = Palette.InkSoft,
    surfaceContainer = Color.White,
    surfaceContainerLow = Color.White,
    outline = Color(0xFFB9C2D6),
    outlineVariant = Palette.Line,
    error = Palette.Wrong,
)

private fun typography(f: FontFamily): Typography {
    fun s(size: Int, weight: FontWeight, line: Int) =
        TextStyle(fontFamily = f, fontSize = size.sp, fontWeight = weight, lineHeight = line.sp)
    return Typography(
        displaySmall = s(34, FontWeight.Bold, 40),
        headlineMedium = s(26, FontWeight.Bold, 32),
        headlineSmall = s(22, FontWeight.Bold, 28),
        titleLarge = s(20, FontWeight.SemiBold, 26),
        titleMedium = s(17, FontWeight.SemiBold, 25),
        titleSmall = s(15, FontWeight.Medium, 21),
        bodyLarge = s(16, FontWeight.Normal, 24),
        bodyMedium = s(14, FontWeight.Normal, 20),
        bodySmall = s(13, FontWeight.Normal, 18),
        labelLarge = s(15, FontWeight.Medium, 20),
        labelMedium = s(13, FontWeight.Medium, 16),
        labelSmall = s(11, FontWeight.Medium, 14),
    )
}

@Composable
fun AppTheme(fontFamily: FontFamily, content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Colors, typography = typography(fontFamily), content = content)
}
