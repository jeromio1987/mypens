/*
 * Drop this file into a fresh Android Studio "Empty Activity" project under
 *   app/src/main/java/com/example/healthconnectcompanion/MainActivity.kt
 *
 * --- Add to app/build.gradle.kts ---
 *   dependencies {
 *     implementation("androidx.health.connect:connect-client:1.1.0-alpha07")
 *     implementation("androidx.activity:activity-compose:1.9.2")
 *     implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
 *     implementation(platform("androidx.compose:compose-bom:2024.09.02"))
 *     implementation("androidx.compose.ui:ui")
 *     implementation("androidx.compose.material3:material3")
 *     implementation("com.squareup.okhttp3:okhttp:4.12.0")
 *     implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
 *   }
 *   plugins { kotlin("plugin.serialization") version "1.9.0" }
 *
 * --- Add to AndroidManifest.xml inside <manifest> ---
 *   <uses-permission android:name="android.permission.health.READ_EXERCISE" />
 *   <queries>
 *     <package android:name="com.google.android.apps.healthdata" />
 *   </queries>
 */
package com.example.healthconnectcompanion

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.time.temporal.ChronoUnit

@Serializable
data class HealthConnectExerciseSessionPayload(
    val id: String,
    val exerciseType: String,
    val title: String? = null,
    val startTime: String,
    val endTime: String? = null,
    val durationSec: Long,
    val totalDistanceM: Double? = null,
    val totalEnergyKcal: Double? = null,
    val averageHeartRate: Double? = null,
    val packageName: String? = null,
    val notes: String? = null,
)

@Serializable
private data class IngestBody(val sessions: List<HealthConnectExerciseSessionPayload>)

@Serializable
data class IngestResult(val ok: Boolean, val stored: Int, val skipped: Int)

class MainActivity : ComponentActivity() {

    private lateinit var prefs: android.content.SharedPreferences
    private val permissions = setOf(
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = getSharedPreferences("hc-companion", Context.MODE_PRIVATE)

        val requestPermissions = registerForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            if (granted.containsAll(permissions)) {
                lifecycleScope.launch { runSync() }
            } else {
                status = "Permission denied"
            }
        }

        setContent {
            MaterialTheme {
                CompanionScreen(
                    initialBaseUrl = prefs.getString("baseUrl", "") ?: "",
                    initialToken = prefs.getString("token", "") ?: "",
                    lastSyncIso = prefs.getString("lastSyncIso", "") ?: "",
                    status = status,
                    busy = busy,
                    onSyncClicked = { url, token ->
                        prefs.edit().putString("baseUrl", url).putString("token", token).apply()
                        requestPermissions.launch(permissions)
                    },
                )
            }
        }
    }

    private var status by mutableStateOf("Idle")
    private var busy by mutableStateOf(false)

    private suspend fun runSync() {
        busy = true
        try {
            val client = HealthConnectClient.getOrCreate(this)
            val baseUrl = prefs.getString("baseUrl", "") ?: ""
            val token = prefs.getString("token", "") ?: ""
            val lastSync = prefs.getString("lastSyncIso", "")
                ?.takeIf { it.isNotEmpty() }
                ?.let(Instant::parse)
                ?: Instant.now().minus(30, ChronoUnit.DAYS)

            status = "Reading sessions since $lastSync…"
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.after(lastSync),
                )
            )

            val payloads = response.records.map { r ->
                val durationSec = (r.endTime.epochSecond - r.startTime.epochSecond)
                HealthConnectExerciseSessionPayload(
                    id = r.metadata.id,
                    exerciseType = exerciseTypeName(r.exerciseType),
                    title = r.title,
                    startTime = r.startTime.toString(),
                    endTime = r.endTime.toString(),
                    durationSec = durationSec,
                    packageName = r.metadata.dataOrigin.packageName,
                )
            }

            status = "Found ${payloads.size}. Pushing…"
            val result = withContext(Dispatchers.IO) { push(payloads, baseUrl, token) }
            prefs.edit().putString("lastSyncIso", Instant.now().toString()).apply()
            status = "Done — stored: ${result.stored}, skipped: ${result.skipped}."
        } catch (e: Exception) {
            status = "Error: ${e.message}"
        } finally {
            busy = false
        }
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val http = OkHttpClient()

    private fun push(
        sessions: List<HealthConnectExerciseSessionPayload>,
        baseUrl: String,
        token: String,
    ): IngestResult {
        if (sessions.isEmpty()) return IngestResult(true, 0, 0)
        val body = json.encodeToString(IngestBody(sessions))
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$baseUrl/api/integrations/healthconnect/ingest")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("HTTP ${resp.code}: $text")
            return json.decodeFromString(IngestResult.serializer(), text)
        }
    }

    /**
     * Map a few common ExerciseSessionRecord types to the SCREAMING_SNAKE_CASE
     * strings the server's mapper recognises (see
     * `lib/integrations/healthconnect/mapping.ts`). Unknown types fall back to
     * `OTHER_WORKOUT`.
     */
    private fun exerciseTypeName(t: Int): String = when (t) {
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "STRENGTH_TRAINING"
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING     -> "WEIGHTLIFTING"
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS      -> "CALISTHENICS"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIGH_INTENSITY_INTERVAL_TRAINING"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING           -> "RUNNING"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING           -> "WALKING"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING            -> "BIKING"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL     -> "SWIMMING_POOL"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING            -> "ROWING"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING            -> "HIKING"
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA              -> "YOGA"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL        -> "ELLIPTICAL"
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING    -> "STAIR_CLIMBING"
        else                                                  -> "OTHER_WORKOUT"
    }
}

@Composable
private fun CompanionScreen(
    initialBaseUrl: String,
    initialToken: String,
    lastSyncIso: String,
    status: String,
    busy: Boolean,
    onSyncClicked: (String, String) -> Unit,
) {
    var baseUrl by remember { mutableStateOf(initialBaseUrl) }
    var token by remember { mutableStateOf(initialToken) }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text("My Pens · Health Connect", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = baseUrl,
                onValueChange = { baseUrl = it },
                label = { Text("Base URL (https://…)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = token,
                onValueChange = { token = it },
                label = { Text("Pairing token") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Text("Last sync: ${lastSyncIso.ifEmpty { "Never" }}", style = MaterialTheme.typography.bodySmall)
            Button(
                onClick = { onSyncClicked(baseUrl.trim(), token.trim()) },
                enabled = !busy && baseUrl.isNotBlank() && token.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (busy) CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (busy) "Syncing…" else "Sync now")
            }
            Text(status, style = MaterialTheme.typography.bodySmall)
        }
    }
}
