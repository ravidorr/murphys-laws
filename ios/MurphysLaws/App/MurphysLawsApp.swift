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

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(votingService)
        }
    }
}
