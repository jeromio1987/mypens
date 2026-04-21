import SwiftUI

struct ContentView: View {
    @AppStorage("baseUrl") private var baseUrl: String = ""
    @AppStorage("pairingToken") private var pairingToken: String = ""
    @AppStorage("lastSyncIso") private var lastSyncIso: String = ""

    @State private var status: String = "Idle"
    @State private var busy: Bool = false

    private let client = HealthKitClient()

    var body: some View {
        NavigationStack {
            Form {
                Section("Server") {
                    TextField("Base URL (https://…)", text: $baseUrl)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    SecureField("Pairing token", text: $pairingToken)
                }

                Section("Last sync") {
                    Text(lastSyncIso.isEmpty ? "Never" : lastSyncIso)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button(action: sync) {
                        HStack {
                            if busy { ProgressView().padding(.trailing, 8) }
                            Text(busy ? "Syncing…" : "Sync now")
                        }
                    }
                    .disabled(busy || baseUrl.isEmpty || pairingToken.isEmpty)
                }

                Section("Status") {
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("My Pens · HealthKit")
        }
    }

    private func sync() {
        busy = true
        status = "Requesting permission…"
        Task {
            do {
                try await client.requestAuthorization()
                let since = parseIso(lastSyncIso) ?? Date().addingTimeInterval(-30 * 24 * 3600)
                status = "Reading workouts since \(iso(since))…"
                let workouts = try await client.fetchWorkouts(since: since)
                status = "Found \(workouts.count) workouts. Pushing…"
                let result = try await client.push(
                    workouts: workouts,
                    baseUrl: baseUrl,
                    token: pairingToken
                )
                lastSyncIso = iso(Date())
                status = "Done — stored: \(result.stored), skipped: \(result.skipped)."
            } catch {
                status = "Error: \(error.localizedDescription)"
            }
            busy = false
        }
    }

    private func iso(_ d: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.string(from: d)
    }

    private func parseIso(_ s: String) -> Date? {
        guard !s.isEmpty else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}
