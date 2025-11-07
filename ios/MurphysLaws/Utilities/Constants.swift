//
//  Constants.swift
//  MurphysLaws
//
//  App-wide constants and configuration
//

import Foundation

enum Constants {
    // MARK: - API Configuration
    enum API {
        static let baseURL = "https://murphys-laws.com/api/v1"

        // Endpoints
        static let laws = "/laws"
        static let lawOfDay = "/law-of-day"
        static let categories = "/categories"
        static let attributions = "/attributions"
        static let shareCalculation = "/share-calculation"

        // Pagination
        static let defaultLimit = 25
        static let maxLimit = 100

        // Rate Limiting
        static let maxVotesPerMinute = 30
    }

    // MARK: - Storage Keys
    enum Storage {
        static let votes = "user_votes"
        static let cachedCategories = "cached_categories"
        static let lastSync = "last_sync_date"
        static let deviceID = "device_identifier"
        static let notificationEnabled = "notification_enabled"
        static let notificationTime = "notification_time"
    }

    // MARK: - UI Constants
    enum UI {
        // Spacing
        static let spacingXS: CGFloat = 4
        static let spacingS: CGFloat = 8
        static let spacingM: CGFloat = 16
        static let spacingL: CGFloat = 24
        static let spacingXL: CGFloat = 32

        // Corner Radius
        static let cornerRadiusS: CGFloat = 8
        static let cornerRadiusM: CGFloat = 12
        static let cornerRadiusL: CGFloat = 16

        // Animation Duration
        static let animationFast: Double = 0.2
        static let animationNormal: Double = 0.3
        static let animationSlow: Double = 0.5
    }

    // MARK: - Performance
    enum Performance {
        static let cacheMaxAge: TimeInterval = 3600  // 1 hour
        static let searchDebounce: TimeInterval = 0.3
        static let prefetchThreshold = 5  // Load more when 5 items from end
    }

    // MARK: - Validation
    enum Validation {
        static let lawTextMinLength = 10
        static let lawTextMaxLength = 1000
        static let titleMaxLength = 200
    }

    // MARK: - Deep Linking
    enum DeepLink {
        static let scheme = "murphyslaws"
        static let lawPath = "law"
        static let categoryPath = "category"
        static let calculatorPath = "calculator"
    }
}
