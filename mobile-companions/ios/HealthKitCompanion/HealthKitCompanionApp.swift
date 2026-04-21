import SwiftUI

/// Sample `@main` entry point. Drop this in alongside `ContentView.swift`
/// (and delete the Xcode-generated `App` struct) so `BackgroundSync.register()`
/// runs before the first scene is shown — that's required for iOS to deliver
/// the `BGAppRefreshTask` registered with the identifier
/// `com.example.mypens.healthkit.refresh`.
@main
struct HealthKitCompanionApp: App {
    init() {
        BackgroundSync.shared.register()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
