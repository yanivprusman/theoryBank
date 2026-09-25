package com.automatelinux.theoryBank.data.model

import kotlinx.serialization.Serializable

// One question from the Ministry of Transport's official theory bank
// (data.gov.il dataset "tqhe"): the question, its four options in the official
// order, the index of the correct one (the one gov.il highlights in yellow), its
// topic, the licence types it is asked for, and an optional picture.
@Serializable
data class Question(
    val n: Int,
    val q: String,
    val o: List<String>,
    val k: Int,
    val c: String,
    val l: List<String>,
    val i: String? = null,
) {
    val answer: String get() = o[k]
}
