//
//  ConfigurationTests.swift
//  MurphysLawsTests
//
//  Tests for configuration loading
//

import XCTest
@testable import MurphysLaws

class ConfigurationTests: XCTestCase {
    
    func testAPIBaseURLLoaded() {
        let baseURL = Constants.API.baseURL
        
        XCTAssertFalse(baseURL.isEmpty, "API base URL should not be empty")
        XCTAssertTrue(baseURL.contains("http"), "API base URL should be a valid URL")
        
        print("✅ API Base URL: \(baseURL)")
    }
    
    func testEnvironmentConfigurationLoaded() {
        let environment = Constants.Environment.current
        
        XCTAssertFalse(environment.isEmpty, "Environment should not be empty")
        XCTAssertTrue(
            environment == "development" || 
            environment == "staging" || 
            environment == "production",
            "Environment should be a valid value"
        )
        
        print("✅ Environment: \(environment)")
        print("   - Is Development: \(Constants.Environment.isDevelopment)")
        print("   - Is Production: \(Constants.Environment.isProduction)")
        print("   - Analytics Enabled: \(Constants.Environment.enableAnalytics)")
        print("   - Crash Reporting Enabled: \(Constants.Environment.enableCrashReporting)")
        print("   - Log Level: \(Constants.Environment.logLevel)")
    }
    
    func testAPIKeyHandling() {
        let apiKey = Constants.API.apiKey
        
        if let key = apiKey {
            XCTAssertFalse(key.isEmpty, "API key should not be empty if present")
            XCTAssertNotEqual(key, "YOUR_API_KEY_HERE", "API key should be replaced from template")
            print("✅ API Key configured (length: \(key.count))")
        } else {
            print("ℹ️ No API key configured (optional)")
        }
    }
    
    func testConfigurationValuesAccessible() {
        // Test that we can access all configuration values without crashing
        _ = Constants.API.baseURL
        _ = Constants.API.apiKey
        _ = Constants.Environment.current
        _ = Constants.Environment.isDevelopment
        _ = Constants.Environment.isProduction
        _ = Constants.Environment.enableAnalytics
        _ = Constants.Environment.enableCrashReporting
        _ = Constants.Environment.logLevel
        
        print("✅ All configuration values are accessible")
    }
    
    func testLogLevelIsValid() {
        let logLevel = Constants.Environment.logLevel
        let validLevels = ["debug", "info", "warning", "error"]
        
        XCTAssertTrue(
            validLevels.contains(logLevel.lowercased()),
            "Log level should be one of: debug, info, warning, error"
        )
        
        print("✅ Log Level: \(logLevel)")
    }
    
    func testAPIEndpointsConfigured() {
        // Verify all API endpoints are properly set
        XCTAssertEqual(Constants.API.laws, "/laws")
        XCTAssertEqual(Constants.API.lawOfDay, "/law-of-day")
        XCTAssertEqual(Constants.API.categories, "/categories")
        XCTAssertEqual(Constants.API.attributions, "/attributions")
        
        print("✅ All API endpoints configured correctly")
    }
}
