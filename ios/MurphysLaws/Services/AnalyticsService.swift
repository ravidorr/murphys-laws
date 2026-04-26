//
//  AnalyticsService.swift
//  MurphysLaws
//
//  Analytics tracking service
//

import Foundation
import SwiftUI

// MARK: - Analytics Events
enum AnalyticsEvent {
    case appLaunched
    case lawViewed(lawID: Int)
    case lawVoted(lawID: Int, voteType: VoteType)
    case lawShared(lawID: Int)
    case searchPerformed(query: String)
    case categoryViewed(categoryID: Int)
    case calculatorUsed(probability: Double, riskLevel: String)
    case lawSubmitted
    case errorOccurred(error: String)
    
    var name: String {
        switch self {
        case .appLaunched: return "app_launched"
        case .lawViewed: return "law_viewed"
        case .lawVoted: return "law_voted"
        case .lawShared: return "law_shared"
        case .searchPerformed: return "search_performed"
        case .categoryViewed: return "category_viewed"
        case .calculatorUsed: return "calculator_used"
        case .lawSubmitted: return "law_submitted"
        case .errorOccurred: return "error_occurred"
        }
    }
    
    var parameters: [String: Any] {
        switch self {
        case .appLaunched:
            return [:]
        case .lawViewed(let lawID):
            return ["law_id": lawID]
        case .lawVoted(let lawID, let voteType):
            return ["law_id": lawID, "vote_type": voteType.rawValue]
        case .lawShared(let lawID):
            return ["law_id": lawID]
        case .searchPerformed(let query):
            return ["query": query]
        case .categoryViewed(let categoryID):
            return ["category_id": categoryID]
        case .calculatorUsed(let probability, let riskLevel):
            return ["probability": probability, "risk_level": riskLevel]
        case .lawSubmitted:
            return [:]
        case .errorOccurred(let error):
            return ["error": error]
        }
    }
}

// MARK: - Analytics Service
@MainActor
class AnalyticsService {
    static let shared = AnalyticsService()
    
    private var isEnabled: Bool {
        Constants.Environment.enableAnalytics
    }
    
    private init() {
        // Initialize analytics SDK here (e.g., Firebase, Mixpanel)
    }
    
    func track(_ event: AnalyticsEvent) {
        guard isEnabled else { return }
        
        // Log locally in development
        if Constants.Environment.isDevelopment {
            print("📊 Analytics: \(event.name) - \(event.parameters)")
        }
        
        // Send to analytics service in production
        // Example: Analytics.logEvent(event.name, parameters: event.parameters)
    }
    
    func setUserProperty(_ property: String, value: String) {
        guard isEnabled else { return }
        
        if Constants.Environment.isDevelopment {
            print("👤 User Property: \(property) = \(value)")
        }
        
        // Example: Analytics.setUserProperty(value, forName: property)
    }
    
    func logScreen(_ screenName: String) {
        guard isEnabled else { return }
        
        if Constants.Environment.isDevelopment {
            print("📱 Screen: \(screenName)")
        }
        
        // Example: Analytics.logEvent("screen_view", parameters: ["screen_name": screenName])
    }
}

// MARK: - Crash Reporting Service
@MainActor
class CrashReportingService {
    static let shared = CrashReportingService()
    
    private var isEnabled: Bool {
        Constants.Environment.enableCrashReporting
    }
    
    private init() {
        // Initialize crash reporting SDK here (e.g., Crashlytics)
    }
    
    func log(_ message: String) {
        guard isEnabled else { return }
        
        if Constants.Environment.isDevelopment {
            print("🐛 Crash Log: \(message)")
        }
        
        // Example: Crashlytics.crashlytics().log(message)
    }
    
    func recordError(_ error: Error, additionalInfo: [String: Any]? = nil) {
        guard isEnabled else { return }
        
        if Constants.Environment.isDevelopment {
            print("❌ Error: \(error.localizedDescription)")
            if let info = additionalInfo {
                print("   Info: \(info)")
            }
        }
        
        // Example: Crashlytics.crashlytics().record(error: error, userInfo: additionalInfo)
    }
    
    func setUserIdentifier(_ identifier: String) {
        guard isEnabled else { return }
        
        // Example: Crashlytics.crashlytics().setUserID(identifier)
    }
}

// MARK: - View Extension for Screen Tracking
extension View {
    func trackScreen(_ screenName: String) -> some View {
        self.onAppear {
            AnalyticsService.shared.logScreen(screenName)
        }
    }
}
