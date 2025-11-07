//
//  SharedContentLoader.swift
//  MurphysLaws
//
//  Loads shared legal content from markdown files
//

import Foundation

enum ContentPage: String {
    case about
    case privacy
    case terms
    case contact

    var title: String {
        switch self {
        case .about: return "About"
        case .privacy: return "Privacy Policy"
        case .terms: return "Terms of Service"
        case .contact: return "Contact"
        }
    }
}

struct ContentMetadata: Codable {
    let version: String
    let lastUpdated: String
    let description: String
}

struct ContentMetadataRoot: Codable {
    let about: ContentMetadata
    let privacy: ContentMetadata
    let terms: ContentMetadata
    let contact: ContentMetadata
}

class SharedContentLoader {
    static let shared = SharedContentLoader()

    private var metadata: ContentMetadataRoot?

    private init() {
        loadMetadata()
    }

    /// Load metadata from JSON file
    private func loadMetadata() {
        guard let url = Bundle.main.url(forResource: "metadata", withExtension: "json", subdirectory: "shared/content/legal"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) else {
            print("Warning: Could not load content metadata")
            return
        }

        self.metadata = decoded
    }

    /// Load markdown content for a specific page
    /// - Parameter page: The page to load
    /// - Returns: Markdown string or nil if not found
    func loadContent(for page: ContentPage) -> String? {
        guard let url = Bundle.main.url(
            forResource: page.rawValue,
            withExtension: "md",
            subdirectory: "shared/content/legal"
        ) else {
            print("Could not find \(page.rawValue).md in bundle")
            return nil
        }

        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            print("Could not read content from \(page.rawValue).md")
            return nil
        }

        return content
    }

    /// Get metadata for a specific page
    /// - Parameter page: The page to get metadata for
    /// - Returns: ContentMetadata or nil
    func getMetadata(for page: ContentPage) -> ContentMetadata? {
        guard let metadata = metadata else { return nil }

        switch page {
        case .about: return metadata.about
        case .privacy: return metadata.privacy
        case .terms: return metadata.terms
        case .contact: return metadata.contact
        }
    }

    /// Get last updated date for a page
    /// - Parameter page: The page to get date for
    /// - Returns: Formatted date string or nil
    func getLastUpdated(for page: ContentPage) -> String? {
        return getMetadata(for: page)?.lastUpdated
    }
}
