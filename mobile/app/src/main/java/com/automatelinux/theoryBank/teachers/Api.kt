package com.automatelinux.theoryBank.teachers

import android.content.Context
import com.automatelinux.theoryBank.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

// The web app's own API (theoryBank/app/api/*), the same routes the browser uses.
// The session is the token /api/auth/token returns, sent as a bearer — the web's
// cookie, carried by hand.

@Serializable
data class Teacher(
    val id: Int,
    val name: String,
    val phone: String,
    val area: String,
    val school: String,
    val licenses: List<String>,
    val note: String,
)

@Serializable
data class User(val id: Int, val name: String, val email: String, val picture: String)

@Serializable
data class TeacherStatus(val status: String, val listedUntil: String? = null, val listed: Boolean)

@Serializable
data class MyTeacher(val id: Int, val name: String, val phone: String, val accepted: Boolean)

@Serializable
data class Student(val id: Int, val name: String, val email: String, val picture: String, val accepted: Boolean)

@Serializable
data class Me(
    val signedIn: Boolean,
    val user: User? = null,
    val teacher: TeacherStatus? = null,
    val myTeacher: MyTeacher? = null,
    val students: List<Student> = emptyList(),
)

@Serializable
data class Person(val id: Int, val name: String, val phone: String = "")

@Serializable
data class Lesson(val id: Int, val startsAt: String, val note: String, val teacher: Person, val student: Person)

/** The server said no, in words meant for the user (Hebrew). */
class ApiError(message: String) : Exception(message)

private val json = Json { ignoreUnknownKeys = true }

object Api {
    private const val PREFS = "theoryBankAccount"
    private const val TOKEN = "token"

    fun token(context: Context): String? = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(TOKEN, null)

    fun setToken(context: Context, token: String?) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().apply {
            if (token == null) remove(TOKEN) else putString(TOKEN, token)
        }.apply()
    }

    private suspend fun call(context: Context, method: String, path: String, body: JsonObject? = null): JsonObject =
        withContext(Dispatchers.IO) {
            val connection = URL(BuildConfig.API_BASE_URL.trimEnd('/') + path).openConnection() as HttpURLConnection
            try {
                connection.requestMethod = method
                connection.connectTimeout = 10_000
                connection.readTimeout = 15_000
                connection.setRequestProperty("Accept", "application/json")
                token(context)?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
                if (body != null) {
                    connection.doOutput = true
                    connection.setRequestProperty("Content-Type", "application/json")
                    connection.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val status = connection.responseCode
                val text = (if (status < 400) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
                val reply = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull()
                    ?: throw ApiError("השרת החזיר $status")
                if (reply["ok"]?.jsonPrimitive?.booleanOrNull != true) {
                    throw ApiError(reply["message"]?.jsonPrimitive?.contentOrNull ?: "השרת החזיר $status")
                }
                reply
            } catch (e: IOException) {
                throw ApiError("אין חיבור לשרת. בדוק את החיבור ונסה שוב.")
            } finally {
                connection.disconnect()
            }
        }

    private inline fun <reified T> JsonObject.field(name: String): T = json.decodeFromJsonElement(this[name] as JsonElement)

    private fun obj(vararg pairs: Pair<String, Any?>): JsonObject = buildMap<String, JsonElement> {
        for ((k, v) in pairs) {
            put(
                k,
                when (v) {
                    null -> kotlinx.serialization.json.JsonNull
                    is Number -> kotlinx.serialization.json.JsonPrimitive(v)
                    is Boolean -> kotlinx.serialization.json.JsonPrimitive(v)
                    is String -> kotlinx.serialization.json.JsonPrimitive(v)
                    is List<*> -> kotlinx.serialization.json.JsonArray(v.map { kotlinx.serialization.json.JsonPrimitive(it as String) })
                    else -> error("unsupported $v")
                },
            )
        }
    }.let(::JsonObject)

    suspend fun signIn(context: Context, idToken: String) {
        val reply = call(context, "POST", "/api/auth/token", obj("idToken" to idToken))
        setToken(context, reply.field<String>("token"))
    }

    suspend fun me(context: Context): Me = call(context, "GET", "/api/me").field("me")
    suspend fun teachers(context: Context): List<Teacher> = call(context, "GET", "/api/teachers").field("teachers")
    suspend fun lessons(context: Context): List<Lesson> = call(context, "GET", "/api/lessons").field("lessons")

    suspend fun requestTeacher(context: Context, name: String, phone: String, area: String, school: String, licenses: List<String>, note: String) {
        call(context, "POST", "/api/teacher/request", obj("name" to name, "phone" to phone, "area" to area, "school" to school, "licenses" to licenses, "note" to note))
    }

    suspend fun joinTeacher(context: Context, teacherId: Int) { call(context, "POST", "/api/my-teacher", obj("teacherId" to teacherId)) }
    suspend fun leaveTeacher(context: Context) { call(context, "DELETE", "/api/my-teacher") }
    suspend fun answerStudent(context: Context, studentId: Int, accept: Boolean) {
        call(context, "POST", "/api/students", obj("studentId" to studentId, "accept" to accept))
    }

    suspend fun scheduleLesson(context: Context, studentId: Int, date: String, time: String, note: String) {
        call(context, "POST", "/api/lessons", obj("studentId" to studentId, "date" to date, "time" to time, "note" to note))
    }
    suspend fun moveLesson(context: Context, id: Int, date: String, time: String) {
        call(context, "POST", "/api/lessons/move", obj("id" to id, "date" to date, "time" to time))
    }
    suspend fun cancelLesson(context: Context, id: Int) { call(context, "POST", "/api/lessons/cancel", obj("id" to id)) }
}
