package com.automatelinux.theoryBank

import android.graphics.BitmapFactory
import android.graphics.Color
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.automatelinux.theoryBank.teachers.TeachersTab
import com.russhwolf.settings.SharedPreferencesSettings

// Thin Android launcher — the study UI lives in the shared commonMain App() composable.
// The question bank, the sign table, their pictures and the font ship inside the APK, so studying
// needs no network at all. The teachers tab (accounts, lessons, reminders) is Android's own, and
// the only part that talks to the server.
class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_TAB = "tab"
    }

    // Bumped whenever an intent (a lesson notification) asks for the teachers tab.
    private val openTeachers = mutableIntStateOf(0)

    private fun takeTab(intent: Intent?) {
        if (intent?.getStringExtra(EXTRA_TAB) == "teachers") openTeachers.intValue++
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        takeTab(intent)
    }

    @OptIn(ExperimentalTextApi::class)
    private val rubik = FontFamily(
        listOf(400, 500, 600, 700, 800).map { w ->
            Font(R.font.rubik, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
        }
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Every screen tops out in road-sign blue, so status-bar icons are always
        // light; the bottom is always white, so navigation icons are always dark.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        val questionsJson = assets.open("questions.json").bufferedReader().use { it.readText() }
        val signsJson = assets.open("signs.json").bufferedReader().use { it.readText() }
        val spotsJson = assets.open("sign-spots.json").bufferedReader().use { it.readText() }
        val settings = SharedPreferencesSettings(getSharedPreferences("theoryBank", MODE_PRIVATE))
        takeTab(intent)
        setContent {
            App(
                questionsJson,
                signsJson,
                spotsJson,
                rubik,
                settings,
                loadImage = { path -> assets.open(path).use { BitmapFactory.decodeStream(it) }.asImageBitmap() },
                teachers = { license -> TeachersTab(license) },
                openTeachers = openTeachers.intValue,
            )
        }
    }
}
