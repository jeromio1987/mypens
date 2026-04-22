import Foundation
import HealthKit

/// Encoded shape that matches `HealthkitWorkout` in
/// `lib/integrations/healthkit/api.ts`.
struct HealthkitWorkoutPayload: Codable {
    let uuid: String
    let workoutActivityType: String
    let startDate: String
    let endDate: String?
    let durationSec: Double
    let totalDistanceM: Double?
    let totalEnergyKcal: Double?
    let averageHeartRate: Double?
    let sourceName: String?
    let notes: String?
}

struct IngestResult: Codable {
    let ok: Bool
    let stored: Int
    let skipped: Int
}

enum HealthKitClientError: LocalizedError {
    case unavailable
    case http(Int, String)

    var errorDescription: String? {
        switch self {
        case .unavailable: return "HealthKit not available on this device."
        case .http(let code, let body): return "HTTP \(code): \(body)"
        }
    }
}

final class HealthKitClient {
    private let store = HKHealthStore()

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitClientError.unavailable
        }
        var readTypes: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) {
            readTypes.insert(hr)
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func fetchWorkouts(since: Date) async throws -> [HealthkitWorkoutPayload] {
        let predicate = HKQuery.predicateForSamples(withStart: since, end: nil, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let workouts: [HKWorkout] = try await withCheckedThrowingContinuation { cont in
            let q = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error = error { cont.resume(throwing: error); return }
                cont.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            store.execute(q)
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]

        var payloads: [HealthkitWorkoutPayload] = []
        payloads.reserveCapacity(workouts.count)
        for w in workouts {
            let distance = w.totalDistance?.doubleValue(for: .meter())
            let energy = w.totalEnergyBurned?.doubleValue(for: .kilocalorie())
            let avgHr = try? await averageHeartRate(start: w.startDate, end: w.endDate)
            payloads.append(HealthkitWorkoutPayload(
                uuid: w.uuid.uuidString,
                workoutActivityType: activityTypeName(w.workoutActivityType),
                startDate: formatter.string(from: w.startDate),
                endDate: formatter.string(from: w.endDate),
                durationSec: w.duration,
                totalDistanceM: distance,
                totalEnergyKcal: energy,
                averageHeartRate: avgHr,
                sourceName: w.sourceRevision.source.name,
                notes: nil
            ))
        }
        return payloads
    }

    /// Average heart rate (bpm) across the workout window, or nil when there
    /// are no samples (or HR isn't authorised).
    private func averageHeartRate(start: Date, end: Date) async throws -> Double? {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
            return nil
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        return try await withCheckedThrowingContinuation { cont in
            let q = HKStatisticsQuery(
                quantityType: hrType,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, stats, error in
                if let error = error {
                    // Treat missing authorisation / no data as nil rather than fatal.
                    let nsErr = error as NSError
                    if nsErr.domain == HKErrorDomain {
                        cont.resume(returning: nil); return
                    }
                    cont.resume(throwing: error); return
                }
                let bpm = stats?.averageQuantity()?.doubleValue(
                    for: HKUnit.count().unitDivided(by: .minute())
                )
                cont.resume(returning: bpm)
            }
            store.execute(q)
        }
    }

    func push(
        workouts: [HealthkitWorkoutPayload],
        baseUrl: String,
        token: String
    ) async throws -> IngestResult {
        guard !workouts.isEmpty else { return IngestResult(ok: true, stored: 0, skipped: 0) }
        guard let url = URL(string: "\(baseUrl)/api/integrations/healthkit/ingest") else {
            throw HealthKitClientError.http(0, "Invalid base URL")
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONEncoder().encode(["workouts": workouts])

        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else {
            throw HealthKitClientError.http(0, "No response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw HealthKitClientError.http(http.statusCode, body)
        }
        return try JSONDecoder().decode(IngestResult.self, from: data)
    }

    /// Map a few common HKWorkoutActivityType values into the camelCase strings
    /// the server's mapper recognises (see `lib/integrations/healthkit/mapping.ts`).
    /// Unknown types fall back to "other".
    private func activityTypeName(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .traditionalStrengthTraining: return "traditionalStrengthTraining"
        case .functionalStrengthTraining:  return "functionalStrengthTraining"
        case .crossTraining:               return "crossTraining"
        case .mixedCardio:                 return "mixedCardio"
        case .running:                     return "running"
        case .walking:                     return "walking"
        case .cycling:                     return "cycling"
        case .swimming:                    return "swimming"
        case .rowing:                      return "rowing"
        case .hiking:                      return "hiking"
        case .yoga:                        return "yoga"
        case .elliptical:                  return "elliptical"
        case .stairClimbing:               return "stairClimbing"
        case .highIntensityIntervalTraining: return "highIntensityIntervalTraining"
        default:                           return "other"
        }
    }
}
