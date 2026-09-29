package com.automatelinux.theoryBank.data.model

import kotlinx.serialization.Serializable

// Where one sign sits inside a question's picture, as fractions of the picture's
// width and height, so a tap on it can open that sign. Only the 56 pictures that
// lay out several numbered signs have spots (assets/sign-spots.json, keyed by
// picture file). [n] is the sign as pictured under today's numbering — 1803's
// winding road is printed 107 and spotted as 106.
@Serializable
data class SignSpot(val n: String, val x: Float, val y: Float, val w: Float, val h: Float)
