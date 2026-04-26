//
//  DeepLinkHandler.swift
//  MurphysLaws
//
//  Deep link URL handling
//

import Foundation
import SwiftUI

// MARK: - Deep Link Types
enum DeepLink: Equatable {
    case law(id: Int)
    case category(id: Int)
    case calculator
    case submit
    case home
    
    init?(url: URL) {
        guard url.scheme == Constants.DeepLink.scheme else {
            return nil
        }
        
        let components = url.pathComponents.filter { $0 != "/" }
        
        guard let path = components.first else {
            self = .home
            return
        }
        
        switch path {
        case Constants.DeepLink.lawPath:
            if components.count > 1, let id = Int(components[1]) {
                self = .law(id: id)
            } else {
                return nil
            }
            
        case Constants.DeepLink.categoryPath:
            if components.count > 1, let id = Int(components[1]) {
                self = .category(id: id)
            } else {
                return nil
            }
            
        case Constants.DeepLink.calculatorPath:
            self = .calculator
            
        case "submit":
            self = .submit
            
        default:
            return nil
        }
    }
}

// MARK: - Deep Link Handler
@MainActor
class DeepLinkHandler: ObservableObject {
    @Published var activeDeepLink: DeepLink?
    
    func handle(_ url: URL) {
        guard let deepLink = DeepLink(url: url) else {
            print("Invalid deep link: \(url)")
            return
        }
        
        activeDeepLink = deepLink
        
        // Track analytics
        AnalyticsService.shared.track(.appLaunched)
        
        // Handle specific deep links
        switch deepLink {
        case .law(let id):
            print("Opening law: \(id)")
        case .category(let id):
            print("Opening category: \(id)")
        case .calculator:
            print("Opening calculator")
        case .submit:
            print("Opening submit form")
        case .home:
            print("Opening home")
        }
    }
    
    func clearActiveDeepLink() {
        activeDeepLink = nil
    }
}

// MARK: - Deep Link View Modifier
struct DeepLinkModifier: ViewModifier {
    @EnvironmentObject var deepLinkHandler: DeepLinkHandler
    @EnvironmentObject var tabCoordinator: TabNavigationCoordinator
    
    @State private var selectedLawID: Int?
    @State private var selectedCategoryID: Int?
    
    func body(content: Content) -> some View {
        content
            .onOpenURL { url in
                deepLinkHandler.handle(url)
            }
            .onChange(of: deepLinkHandler.activeDeepLink) { oldValue, newValue in
                guard let deepLink = newValue else { return }
                
                switch deepLink {
                case .law(let id):
                    selectedLawID = id
                    
                case .category(let id):
                    selectedCategoryID = id
                    tabCoordinator.navigate(to: .categories)
                    
                case .calculator:
                    tabCoordinator.navigate(to: .calculator)
                    
                case .submit:
                    tabCoordinator.showingSubmit = true
                    
                case .home:
                    tabCoordinator.navigate(to: .home)
                }
                
                deepLinkHandler.clearActiveDeepLink()
            }
            .sheet(item: $selectedLawID) { lawID in
                NavigationStack {
                    LawDetailView(lawID: lawID)
                        .environmentObject(VotingService.shared)
                }
            }
    }
}

extension View {
    func handleDeepLinks() -> some View {
        self.modifier(DeepLinkModifier())
    }
}

// MARK: - Make Int Identifiable for Sheet
extension Int: Identifiable {
    public var id: Int { self }
}

// MARK: - Deep Link URL Builder
enum DeepLinkBuilder {
    static func lawURL(id: Int) -> URL {
        URL(string: "\(Constants.DeepLink.scheme)://\(Constants.DeepLink.lawPath)/\(id)")!
    }
    
    static func categoryURL(id: Int) -> URL {
        URL(string: "\(Constants.DeepLink.scheme)://\(Constants.DeepLink.categoryPath)/\(id)")!
    }
    
    static func calculatorURL() -> URL {
        URL(string: "\(Constants.DeepLink.scheme)://\(Constants.DeepLink.calculatorPath)")!
    }
    
    static func submitURL() -> URL {
        URL(string: "\(Constants.DeepLink.scheme)://submit")!
    }
}

#Preview {
    Text("Deep link handler preview")
        .environmentObject(DeepLinkHandler())
        .environmentObject(TabNavigationCoordinator.shared)
}
