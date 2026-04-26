//
//  MurphysLawsApp.swift
//  MurphysLaws
//
//  Main app entry point
//

import SwiftUI

@main
struct MurphysLawsApp: App {
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var votingService = VotingService.shared
    
    init() {
        setupApp()
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(networkMonitor)
                .environmentObject(votingService)
                .onAppear {
                    handleAppLaunch()
                }
        }
    }
    
    // MARK: - App Setup
    private func setupApp() {
        // Configure appearance
        configureAppearance()
        
        // Start services
        if Constants.Environment.enableAnalytics {
            AnalyticsService.shared.track(.appLaunched)
        }
    }
    
    private func configureAppearance() {
        // Configure navigation bar appearance
        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithDefaultBackground()
        
        UINavigationBar.appearance().standardAppearance = navBarAppearance
        UINavigationBar.appearance().compactAppearance = navBarAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navBarAppearance
        
        // Configure tab bar appearance
        let tabBarAppearance = UITabBarAppearance()
        tabBarAppearance.configureWithDefaultBackground()
        
        UITabBar.appearance().standardAppearance = tabBarAppearance
        if #available(iOS 15.0, *) {
            UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
        }
    }
    
    private func handleAppLaunch() {
        // Check for UI testing mode
        if ProcessInfo.processInfo.arguments.contains("--uitesting") {
            setupUITestingEnvironment()
        }
        
        // Set user identifier for crash reporting
        let deviceID = UserDefaults.standard.string(forKey: Constants.Storage.deviceID) ?? UUID().uuidString
        if Constants.Environment.enableCrashReporting {
            CrashReportingService.shared.setUserIdentifier(deviceID)
        }
        
        // Load cached data
        Task {
            await CategoryCache.shared.loadFromDisk()
        }
    }
    
    private func setupUITestingEnvironment() {
        // Disable animations for UI tests
        if ProcessInfo.processInfo.environment["UITEST_DISABLE_ANIMATIONS"] == "1" {
            UIView.setAnimationsEnabled(false)
        }
    }
}
