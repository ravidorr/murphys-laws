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
            // Home Tab - Always load first
            HomeView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            // Browse Tab - Lazy load
            Group {
                if selectedTab == 1 || selectedTab == 0 {
                    BrowseView()
                } else {
                    Color.clear
                }
            }
            .tabItem {
                Label("Browse", systemImage: "list.bullet")
            }
            .tag(1)

            // Categories Tab - Lazy load
            Group {
                if selectedTab == 2 {
                    CategoriesView()
                } else {
                    Color.clear
                }
            }
            .tabItem {
                Label("Categories", systemImage: "folder.fill")
            }
            .tag(2)

            // Calculator Tab - Lazy load
            Group {
                if selectedTab == 3 {
                    CalculatorView()
                } else {
                    Color.clear
                }
            }
            .tabItem {
                Label("Calculator", systemImage: "function")
            }
            .tag(3)

            // More Tab - Lazy load
            Group {
                if selectedTab == 4 {
                    MoreView()
                } else {
                    Color.clear
                }
            }
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
