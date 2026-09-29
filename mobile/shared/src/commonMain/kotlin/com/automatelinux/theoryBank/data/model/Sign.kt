package com.automatelinux.theoryBank.data.model

import kotlinx.serialization.Serializable

// One sign from the Ministry of Transport's official sign table (לוח התמרורים,
// consolidated September 2022), extracted by scripts/fetch-signs.py: its number
// ("117", "127פ"), the table's part, the official meaning (פירושו), where it
// applies (כוחו יפה; empty for road markings, whose table has no such column)
// and its picture. [s] is a per-sign wording from Hebrew Wikipedia, present only
// where the table gives several signs one shared meaning ("... בהתאמה").
@Serializable
data class Sign(
    val n: String,
    val p: String,
    val t: String,
    val w: String,
    val i: String,
    val s: String? = null,
) {
    // What a reader sees first: the sign's own wording when the table shares one.
    val headline: String get() = s ?: t
}
