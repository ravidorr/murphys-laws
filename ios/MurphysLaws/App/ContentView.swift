//
//  ContentView.swift
//  MurphysLaws
//
//  Main tab navigation
//

import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // Home Tab
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            // Browse Tab
            BrowseView()
                .tabItem {
                    Label("Browse", systemImage: "list.bullet")
                }
                .tag(1)

            // Categories Tab
            CategoriesView()
                .tabItem {
                    Label("Categories", systemImage: "folder.fill")
                }
                .tag(2)

            // Calculator Tab
            CalculatorView()
                .tabItem {
                    Label("Calculator", systemImage: "function")
                }
                .tag(3)

            // More Tab
            MoreView()
                .tabItem {
                    Label("More", systemImage: "ellipsis.circle.fill")
                }
                .tag(4)
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(VotingService.shared)
}
