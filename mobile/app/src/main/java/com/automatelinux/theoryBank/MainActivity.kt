package com.automatelinux.theoryBank

import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.ui.graphics.asImageBitmap

// Thin Android launcher — all UI lives in the shared commonMain App() composable.
// The question bank and its pictures ship inside the APK (assets/), so the app
// needs no network at all.
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val questionsJson = assets.open("questions.json").bufferedReader().use { it.readText() }
        setContent {
            App(questionsJson) { file ->
                assets.open("img/$file").use { BitmapFactory.decodeStream(it) }.asImageBitmap()
            }
        }
    }
}
