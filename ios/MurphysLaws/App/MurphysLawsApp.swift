//
//  MurphysLawsApp.swift
//  MurphysLaws
//
//  App entry point
//

import SwiftUI

@main
struct MurphysLawsApp: App {
    @StateObject private var votingService = VotingService.shared
    
    // Check if running in UI test mode
    var isUITesting: Bool {
        ProcessInfo.processInfo.arguments.contains("UI-TESTING")
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(votingService)
                .environment(\.isUITesting, isUITesting)
                .onAppear {
                    if isUITesting {
                        setupUITestEnvironment()
                    }
                }
        }
    }
    
    /// Setup mock data and configurations for UI testing
    private func setupUITestEnvironment() {
        print("🧪 Running in UI Test mode - using mock data")
        
        // Disable animations for faster, more reliable tests
        UIView.setAnimationsEnabled(false)
        
        // You can also set up any UserDefaults or other state here
        UserDefaults.standard.set(true, forKey: "isUITesting")
    }
}

// MARK: - Environment Key for UI Testing
private struct IsUITestingKey: EnvironmentKey {
    static let defaultValue: Bool = false
}

extension EnvironmentValues {
    var isUITesting: Bool {
        get { self[IsUITestingKey.self] }
        set { self[IsUITestingKey.self] = newValue }
    }
}
