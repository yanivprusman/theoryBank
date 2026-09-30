package com.automatelinux.theoryBank.teachers

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.automatelinux.theoryBank.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

// Google sign-in on the phone itself: Android's own account sheet, no browser.
// Google hands back an id_token minted for the WEB client (the server's), which
// /api/auth/token verifies with Google and swaps for the app's session.
//
// Needs, in the Google Cloud project "theorybank", an Android OAuth client for
// this package and the signing key's SHA-1 — Google refuses the request without
// one. The dev flavor's is registered ("theoryBank Android dev").
object GoogleSignIn {
    /** Signs in; null when the user backed out. Throws ApiError with a reason to show. */
    suspend fun signIn(activityContext: Context): Unit? {
        val request = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build())
            .build()
        val credential = try {
            CredentialManager.create(activityContext).getCredential(activityContext, request).credential
        } catch (e: GetCredentialCancellationException) {
            return null
        } catch (e: NoCredentialException) {
            throw ApiError("אין בטלפון חשבון Google. הוסף חשבון בהגדרות ונסה שוב.")
        } catch (e: GetCredentialException) {
            throw ApiError("הכניסה עם Google נכשלה: ${e.message ?: e.type}")
        }
        if (credential !is CustomCredential || credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
            throw ApiError("Google החזיר תשובה לא צפויה.")
        }
        Api.signIn(activityContext, GoogleIdTokenCredential.createFrom(credential.data).idToken)
        return Unit
    }

    suspend fun signOut(context: Context) {
        Api.setToken(context, null)
        Reminders.forget(context)
        runCatching { CredentialManager.create(context).clearCredentialState(androidx.credentials.ClearCredentialStateRequest()) }
    }
}
