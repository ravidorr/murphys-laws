//
//  ConfigurationTests.swift
//  MurphysLawsTests
//
//  Tests for app configuration and constants
//

import XCTest
@testable import MurphysLaws

final class ConfigurationTests: XCTestCase {

    // MARK: - API Configuration Tests

    func testAPIBaseURL() {
        XCTAssertEqual(Constants.API.baseURL, "https://murphys-laws.com/api/v1")
        XCTAssertFalse(Constants.API.baseURL.isEmpty)
    }

    func testAPIEndpoints() {
        XCTAssertEqual(Constants.API.laws, "/laws")
        XCTAssertEqual(Constants.API.lawOfDay, "/law-of-day")
        XCTAssertEqual(Constants.API.categories, "/categories")
        XCTAssertEqual(Constants.API.attributions, "/attributions")
        XCTAssertEqual(Constants.API.shareCalculation, "/share-calculation")
    }

    func testAPIPaginationLimits() {
        XCTAssertEqual(Constants.API.defaultLimit, 25)
        XCTAssertEqual(Constants.API.maxLimit, 100)
        XCTAssertLessThan(Constants.API.defaultLimit, Constants.API.maxLimit)
    }

    func testAPIRateLimits() {
        XCTAssertEqual(Constants.API.maxVotesPerMinute, 30)
        XCTAssertGreaterThan(Constants.API.maxVotesPerMinute, 0)
    }

    // MARK: - Storage Keys Tests

    func testStorageKeys() {
        XCTAssertEqual(Constants.Storage.votes, "user_votes")
        XCTAssertEqual(Constants.Storage.cachedCategories, "cached_categories")
        XCTAssertEqual(Constants.Storage.lastSync, "last_sync_date")
        XCTAssertEqual(Constants.Storage.deviceID, "device_identifier")
        XCTAssertEqual(Constants.Storage.notificationEnabled, "notification_enabled")
        XCTAssertEqual(Constants.Storage.notificationTime, "notification_time")
    }

    func testStorageKeysAreUnique() {
        let keys = [
            Constants.Storage.votes,
            Constants.Storage.cachedCategories,
            Constants.Storage.lastSync,
            Constants.Storage.deviceID,
            Constants.Storage.notificationEnabled,
            Constants.Storage.notificationTime
        ]

        let uniqueKeys = Set(keys)
        XCTAssertEqual(keys.count, uniqueKeys.count, "Storage keys should be unique")
    }

    // MARK: - UI Constants Tests

    func testUISpacing() {
        XCTAssertEqual(Constants.UI.spacingXS, 4)
        XCTAssertEqual(Constants.UI.spacingS, 8)
        XCTAssertEqual(Constants.UI.spacingM, 16)
        XCTAssertEqual(Constants.UI.spacingL, 24)
        XCTAssertEqual(Constants.UI.spacingXL, 32)

        // Verify spacing increases
        XCTAssertLessThan(Constants.UI.spacingXS, Constants.UI.spacingS)
        XCTAssertLessThan(Constants.UI.spacingS, Constants.UI.spacingM)
        XCTAssertLessThan(Constants.UI.spacingM, Constants.UI.spacingL)
        XCTAssertLessThan(Constants.UI.spacingL, Constants.UI.spacingXL)
    }

    func testUICornerRadius() {
        XCTAssertEqual(Constants.UI.cornerRadiusS, 8)
        XCTAssertEqual(Constants.UI.cornerRadiusM, 12)
        XCTAssertEqual(Constants.UI.cornerRadiusL, 16)

        // Verify corner radius increases
        XCTAssertLessThan(Constants.UI.cornerRadiusS, Constants.UI.cornerRadiusM)
        XCTAssertLessThan(Constants.UI.cornerRadiusM, Constants.UI.cornerRadiusL)
    }

    func testUIAnimationDuration() {
        XCTAssertEqual(Constants.UI.animationFast, 0.2)
        XCTAssertEqual(Constants.UI.animationNormal, 0.3)
        XCTAssertEqual(Constants.UI.animationSlow, 0.5)

        // Verify animation duration increases
        XCTAssertLessThan(Constants.UI.animationFast, Constants.UI.animationNormal)
        XCTAssertLessThan(Constants.UI.animationNormal, Constants.UI.animationSlow)
    }

    // MARK: - Performance Tests

    func testPerformanceConstants() {
        XCTAssertEqual(Constants.Performance.cacheMaxAge, 3600)
        XCTAssertEqual(Constants.Performance.searchDebounce, 0.3)
        XCTAssertEqual(Constants.Performance.prefetchThreshold, 5)

        // Verify reasonable values
        XCTAssertGreaterThan(Constants.Performance.cacheMaxAge, 0)
        XCTAssertGreaterThan(Constants.Performance.searchDebounce, 0)
        XCTAssertGreaterThan(Constants.Performance.prefetchThreshold, 0)
    }

    // MARK: - Validation Tests

    func testValidationRules() {
        XCTAssertEqual(Constants.Validation.lawTextMinLength, 10)
        XCTAssertEqual(Constants.Validation.lawTextMaxLength, 1000)
        XCTAssertEqual(Constants.Validation.titleMaxLength, 200)

        // Verify logical constraints
        XCTAssertLessThan(Constants.Validation.lawTextMinLength, Constants.Validation.lawTextMaxLength)
        XCTAssertLessThan(Constants.Validation.titleMaxLength, Constants.Validation.lawTextMaxLength)
    }

    // MARK: - Deep Linking Tests

    func testDeepLinkConfiguration() {
        XCTAssertEqual(Constants.DeepLink.scheme, "murphyslaws")
        XCTAssertEqual(Constants.DeepLink.lawPath, "law")
        XCTAssertEqual(Constants.DeepLink.categoryPath, "category")
        XCTAssertEqual(Constants.DeepLink.calculatorPath, "calculator")

        // Verify scheme is lowercase
        XCTAssertEqual(Constants.DeepLink.scheme, Constants.DeepLink.scheme.lowercased())
    }
}
