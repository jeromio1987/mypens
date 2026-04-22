/*
 * Background sync for the Health Connect companion.
 *
 * Two pieces working together:
 *
 *  1. `SyncWorker` — a `CoroutineWorker` that re-runs the same read-and-push
 *     flow as the foreground "Sync now" button, reading credentials and the
 *     last-sync cursor from the same `SharedPreferences` file.
 *
 *  2. `SyncScheduler.schedule()` — registers a `PeriodicWorkRequest` (15 min
 *     minimum interval; the OS may delay to save battery) gated on the device
 *     having network. Idempotent — safe to call from `MainActivity.onCreate`
 *     every launch thanks to `KEEP` policy.
 *
 * --- Add to app/build.gradle.kts dependencies ---
 *   implementation("androidx.work:work-runtime-ktx:2.9.1")
 *
 * --- Add to AndroidManifest.xml inside <manifest> ---
 *   <uses-permission
 *     android:name="android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND" />
 *
 * `READ_HEALTH_DATA_IN_BACKGROUND` is an Android 14 (API 34) addition. On
 * older devices the worker still runs but Health Connect will only return
 * sessions that were already readable while the app was foregrounded; in
 * practice that means new sessions show up the next time the user opens the
 * app, so behaviour degrades gracefully.
 */
package com.example.healthconnectcompanion

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.concurrent.TimeUnit

@Serializable
private data class WorkerIngestBody(val sessions: List<HealthConnectExerciseSessionPayload>)

object SyncScheduler {
    private const val UNIQUE_NAME = "hc-companion-periodic-sync"

    /**
     * Register the periodic worker. Call from `MainActivity.onCreate` (or your
     * `Application.onCreate`) — `KEEP` makes it a no-op if the worker is
     * already enqueued.
     */
    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(
            repeatInterval = 1, repeatIntervalTimeUnit = TimeUnit.HOURS,
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(UNIQUE_NAME)
    }
}

class SyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = false }
    private val http = OkHttpClient()

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("hc-companion", Context.MODE_PRIVATE)
        val baseUrl = prefs.getString("baseUrl", "").orEmpty()
        val token = prefs.getString("token", "").orEmpty()
        if (baseUrl.isEmpty() || token.isEmpty()) {
            // Not paired yet — nothing to do, but don't fail the chain.
            return Result.success()
        }

        return try {
            val client = HealthConnectClient.getOrCreate(applicationContext)

            // Bail out gracefully if the user revoked permission. Returning
            // `success` keeps the periodic schedule alive so we'll retry
            // automatically once they re-grant from the app.
            val granted = client.permissionController.getGrantedPermissions()
            val needed = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
            if (needed !in granted) return Result.success()

            val lastSync = prefs.getString("lastSyncIso", "")
                ?.takeIf { it.isNotEmpty() }
                ?.let(Instant::parse)
                ?: Instant.now().minus(30, ChronoUnit.DAYS)

            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.after(lastSync),
                )
            )

            val payloads = response.records.map { r ->
                val window = TimeRangeFilter.between(r.startTime, r.endTime)
                val agg = runCatching {
                    client.aggregate(
                        AggregateRequest(
                            metrics = setOf(
                                HeartRateRecord.BPM_AVG,
                                DistanceRecord.DISTANCE_TOTAL,
                                TotalCaloriesBurnedRecord.ENERGY_TOTAL,
                            ),
                            timeRangeFilter = window,
                        )
                    )
                }.getOrNull()
                HealthConnectExerciseSessionPayload(
                    id = r.metadata.id,
                    exerciseType = exerciseTypeNameForWorker(r.exerciseType),
                    title = r.title,
                    startTime = r.startTime.toString(),
                    endTime = r.endTime.toString(),
                    durationSec = r.endTime.epochSecond - r.startTime.epochSecond,
                    totalDistanceM = agg?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters,
                    totalEnergyKcal = agg?.get(TotalCaloriesBurnedRecord.ENERGY_TOTAL)?.inKilocalories,
                    averageHeartRate = agg?.get(HeartRateRecord.BPM_AVG)?.toDouble(),
                    packageName = r.metadata.dataOrigin.packageName,
                )
            }

            push(payloads, baseUrl, token)
            prefs.edit().putString("lastSyncIso", Instant.now().toString()).apply()
            Result.success()
        } catch (e: Exception) {
            // Transient errors (network, server 5xx) — let WorkManager retry
            // with exponential backoff.
            Result.retry()
        }
    }

    private fun push(
        sessions: List<HealthConnectExerciseSessionPayload>,
        baseUrl: String,
        token: String,
    ) {
        if (sessions.isEmpty()) return
        val body = json.encodeToString(WorkerIngestBody(sessions))
            .toRequestBody("application/json".toMediaType())
        val req = Request.Builder()
            .url("$baseUrl/api/integrations/healthconnect/ingest")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()
        http.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) error("HTTP ${resp.code}")
        }
    }

    private fun exerciseTypeNameForWorker(t: Int): String = when (t) {
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
