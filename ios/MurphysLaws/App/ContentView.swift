//
//  ContentView.swift
//  MurphysLaws
//
//  Main tab navigation
//

import SwiftUI

struct ContentView: View {
    @StateObject private var tabCoordinator = TabNavigationCoordinator.shared
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
        .environmentObject(tabCoordinator)
        .onChange(of: tabCoordinator.targetTab) { newValue in
            if let newValue = newValue {
                selectedTab = newValue.rawValue
                // Reset after navigation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    tabCoordinator.targetTab = nil
                }
            }
        }
    }
}

// MARK: - Tab Navigation Coordinator
class TabNavigationCoordinator: ObservableObject {
    static let shared = TabNavigationCoordinator()
    
    @Published var targetTab: AppTab?
    @Published var showingSubmit = false
    @Published var showingContact = false
    
    private init() {}
    
    func navigate(to destination: AppTab) {
        targetTab = destination
    }
}

enum AppTab: Int {
    case home = 0
    case browse = 1
    case categories = 2
    case calculator = 3
    case more = 4
}

#Preview {
    ContentView()
        .environmentObject(VotingService.shared)
}
