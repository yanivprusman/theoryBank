package com.automatelinux.theoryBank.data.model

import kotlinx.serialization.Serializable

// One question from the Ministry of Transport's official theory bank
// (data.gov.il dataset "tqhe"), reduced to what the app shows: the question,
// the one correct answer (the one gov.il highlights in yellow), its topic,
// the licence types it is asked for, and an optional picture (sign / road scene).
@Serializable
data class Question(
    val n: Int,
    val q: String,
    val a: String,
    val c: String,
    val l: List<String>,
    val i: String? = null,
)
