import Foundation
import BackgroundTasks
import HealthKit

/// Background sync wiring for the HealthKit companion.
///
/// Two complementary mechanisms are set up:
///
/// 1. **HealthKit background delivery** — `enableBackgroundDelivery` plus an
///    `HKObserverQuery` wakes the app whenever a new `HKWorkout` is written to
///    the Health store. This is the low-latency path: workouts typically push
///    within minutes of being recorded, even if the app is suspended.
///
/// 2. **`BGAppRefreshTask`** — a periodic safety net (~once an hour, scheduled
///    by iOS at its discretion) that runs a sync even if no observer event
///    fired (for example when the app was force-quit, or the device was
///    offline when the workout landed).
///
/// Both paths funnel through `runSync()` which reads the same `UserDefaults`
/// that the foreground "Sync now" button uses, so cursors stay consistent.
///
/// ### Setup
///
/// Add to `Info.plist`:
/// ```xml
/// <key>BGTaskSchedulerPermittedIdentifiers</key>
/// <array>
///   <string>com.example.mypens.healthkit.refresh</string>
/// </array>
/// ```
///
/// Enable the **Background Modes** capability with *Background fetch* and
/// *Background processing* checked, and keep the **HealthKit** capability
/// enabled.
///
/// In your `App` entry point:
/// ```swift
/// @main
/// struct MyPensApp: App {
///   init() { BackgroundSync.shared.register() }
///   var body: some Scene {
///     WindowGroup { ContentView()
///       .onAppear { Task { await BackgroundSync.shared.enable() } }
///     }
///   }
/// }
/// ```
final class BackgroundSync {
    static let shared = BackgroundSync()

    /// Must match the identifier listed in `Info.plist`'s
    /// `BGTaskSchedulerPermittedIdentifiers`.
    static let refreshTaskIdentifier = "com.example.mypens.healthkit.refresh"

    private let client = HealthKitClient()
    private let store = HKHealthStore()
    private var observerQuery: HKObserverQuery?

    /// Call once, very early in app launch (before the first scene is shown),
    /// from your `App.init` or `application(_:didFinishLaunchingWithOptions:)`.
    func register() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: Self.refreshTaskIdentifier,
            using: nil
        ) { [weak self] task in
            guard let task = task as? BGAppRefreshTask else { return }
            self?.handleRefresh(task: task)
        }
    }

    /// Call after the user has pasted credentials and granted HealthKit
    /// permission (e.g. from `.onAppear` once `baseUrl` and `pairingToken` are
    /// non-empty). Safe to call repeatedly.
    func enable() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }

        // Make sure we have read permission before subscribing — otherwise the
        // observer fires but `fetchWorkouts` returns nothing.
        do { try await client.requestAuthorization() } catch { return }

        let workoutType = HKObjectType.workoutType()

        // Ask HealthKit to wake us in the background when new workouts land.
        // `.immediate` is the most aggressive frequency the OS allows; in
        // practice it still coalesces events.
        do {
            try await store.enableBackgroundDelivery(
                for: workoutType,
                frequency: .immediate
            )
        } catch {
            // Non-fatal — the BGAppRefreshTask path still runs.
        }

        if observerQuery == nil {
            let query = HKObserverQuery(
                sampleType: workoutType,
                predicate: nil
            ) { [weak self] _, completion, _ in
                Task { [weak self] in
                    await self?.runSync()
                    // Always call the completion handler so iOS knows we're
                    // done and doesn't throttle future deliveries.
                    completion()
                }
            }
            store.execute(query)
            observerQuery = query
        }

        scheduleNextRefresh()
    }

    /// Ask iOS to wake us roughly an hour from now. iOS decides the actual
    /// time based on usage patterns and battery state — this is a hint, not a
    /// guarantee.
    func scheduleNextRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.refreshTaskIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 60 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Most common cause: running on simulator, or the identifier isn't
            // listed in Info.plist. Foreground sync continues to work.
        }
    }

    private func handleRefresh(task: BGAppRefreshTask) {
        // Always queue the next run before doing work, so a crash mid-sync
        // doesn't break the cadence.
        scheduleNextRefresh()

        let work = Task { await runSync() }
        task.expirationHandler = { work.cancel() }

        Task {
            _ = await work.value
            task.setTaskCompleted(success: !work.isCancelled)
        }
    }

    /// Shared sync routine. Reads `baseUrl` / `pairingToken` / `lastSyncIso`
    /// from `UserDefaults` (matching the `@AppStorage` keys in `ContentView`)
    /// and bails out quietly if the user hasn't paired yet.
    private func runSync() async {
        let defaults = UserDefaults.standard
        let baseUrl = defaults.string(forKey: "baseUrl") ?? ""
        let token = defaults.string(forKey: "pairingToken") ?? ""
        guard !baseUrl.isEmpty, !token.isEmpty else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        let since: Date = {
            if let raw = defaults.string(forKey: "lastSyncIso"),
               let parsed = formatter.date(from: raw) {
                return parsed
            }
            return Date().addingTimeInterval(-30 * 24 * 3600)
        }()

        do {
            let workouts = try await client.fetchWorkouts(since: since)
            _ = try await client.push(workouts: workouts, baseUrl: baseUrl, token: token)
            defaults.set(formatter.string(from: Date()), forKey: "lastSyncIso")
        } catch {
            // Background runs swallow errors — the next observer event or
            // refresh task will retry. The foreground UI surfaces failures.
        }
    }
}
