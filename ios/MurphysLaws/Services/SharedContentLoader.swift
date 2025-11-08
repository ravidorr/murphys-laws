//
//  SharedContentLoader.swift
//  MurphysLaws
//
//  Service for loading shared markdown content files
//

import Foundation

public class SharedContentLoader {
    public static let shared = SharedContentLoader()

    private var contentCache: [ContentPage: String] = [:]
    private var lastUpdatedCache: [ContentPage: String] = [:]

    private init() {}

    /// Load markdown content for a given page
    public func loadContent(for page: ContentPage) -> String? {
        // Check cache first
        if let cached = contentCache[page] {
            return cached
        }

        // Try to load from bundle
        guard let url = Bundle.main.url(forResource: page.rawValue, withExtension: "md"),
              let content = try? String(contentsOf: url, encoding: .utf8) else {
            // Return placeholder content if file not found
            return getPlaceholderContent(for: page)
        }

        // Cache and return
        contentCache[page] = content
        return content
    }

    /// Get last updated date for a given page
    public func getLastUpdated(for page: ContentPage) -> String? {
        // Check cache first
        if let cached = lastUpdatedCache[page] {
            return cached
        }

        // Try to get file modification date
        guard let url = Bundle.main.url(forResource: page.rawValue, withExtension: "md"),
              let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let modificationDate = attributes[.modificationDate] as? Date else {
            return nil
        }

        // Format date
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        let dateString = formatter.string(from: modificationDate)

        // Cache and return
        lastUpdatedCache[page] = dateString
        return dateString
    }

    /// Clear all cached content
    public func clearCache() {
        contentCache.removeAll()
        lastUpdatedCache.removeAll()
    }

    /// Get placeholder content when markdown file is not available
    private func getPlaceholderContent(for page: ContentPage) -> String {
        switch page {
        case .about:
            return """
            # About Murphy's Laws

            Murphy's Law is an adage that states: "Anything that can go wrong will go wrong."

            This app collects and shares these laws, allowing you to browse, vote on your favorites, and even calculate the probability of your own tasks going wrong!

            ## Features

            - **Daily Law**: Discover a new Murphy's Law every day
            - **Browse Laws**: Explore the complete archive of laws and corollaries
            - **Categories**: Filter laws by technology, office, daily life, and more
            - **Calculator**: Calculate the probability of your task going wrong
            - **Voting**: Vote on your favorite laws to help others discover them
            """

        case .privacy:
            return """
            # Privacy Policy

            Last updated: \(Date().formatted(date: .long, time: .omitted))

            ## Overview

            Your privacy is important to us. This privacy policy explains how we collect, use, and protect your information when you use Murphy's Laws.

            ## Information We Collect

            - **Device Information**: We collect anonymous device identifiers for voting functionality
            - **Usage Data**: We collect anonymous usage statistics to improve the app

            ## How We Use Your Information

            We use the collected information to:
            - Enable voting on laws
            - Improve app functionality
            - Provide better user experience

            ## Data Security

            We implement appropriate security measures to protect your information.

            ## Contact

            If you have questions about this privacy policy, please contact us at contact@murphys-laws.com
            """

        case .terms:
            return """
            # Terms of Service

            Last updated: \(Date().formatted(date: .long, time: .omitted))

            ## Acceptance of Terms

            By using Murphy's Laws, you agree to these terms of service.

            ## Use of Service

            You may use this app for personal, non-commercial purposes. You agree not to:
            - Submit offensive or inappropriate content
            - Attempt to manipulate voting systems
            - Reverse engineer the app

            ## Content

            Laws and content in this app are collected from various sources. We strive for accuracy but make no guarantees.

            ## User Submissions

            By submitting content, you grant us the right to use, modify, and display it in the app.

            ## Disclaimer

            This app is provided "as is" without warranties of any kind.

            ## Contact

            Questions about these terms? Contact us at contact@murphys-laws.com
            """

        case .contact:
            return """
            # Contact Us

            We'd love to hear from you!

            ## Email

            For general inquiries, support, or suggestions:
            **contact@murphys-laws.com**

            ## Website

            Visit us at: **https://murphys-laws.com**

            ## Submit a Law

            Have a Murphy's Law variation to share? Use the Submit feature in the More tab!

            ## Bug Reports

            Found a bug? Please email us with:
            - A description of the issue
            - Steps to reproduce
            - Your device and iOS version

            ## Feature Requests

            Have an idea for a new feature? We'd love to hear it! Send us an email with your suggestion.

            ---

            We aim to respond to all inquiries within 48 hours.
            """
        }
    }
}
