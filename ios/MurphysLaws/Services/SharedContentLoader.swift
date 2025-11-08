//
//  SharedContentLoader.swift
//  MurphysLaws
//
//  Service for loading shared markdown content files
//

import Foundation

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

public class SharedContentLoader {
    public static let shared = SharedContentLoader()

    private var contentCache: [ContentPage: String] = [:]
    private var metadata: ContentMetadataRoot?

    private init() {
        loadMetadata()
    }

    /// Load metadata from JSON file
    private func loadMetadata() {
        guard let url = Bundle.main.url(
            forResource: "metadata",
            withExtension: "json",
            subdirectory: "Resources/content"
        ),
        let data = try? Data(contentsOf: url),
        let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) else {
            print("Warning: Could not load content metadata from Resources/content/metadata.json")
            return
        }

        self.metadata = decoded
    }

    /// Load markdown content for a given page
    public func loadContent(for page: ContentPage) -> String? {
        // Check cache first
        if let cached = contentCache[page] {
            return cached
        }

        // Try to load from bundle's Resources/content directory
        guard let url = Bundle.main.url(
            forResource: page.rawValue,
            withExtension: "md",
            subdirectory: "Resources/content"
        ) else {
            print("Error: Could not find \(page.rawValue).md in Resources/content")
            return nil
        }

        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            print("Error: Could not read content from \(page.rawValue).md")
            return nil
        }

        // Cache and return
        contentCache[page] = content
        return content
    }

    /// Get metadata for a specific page
    private func getMetadata(for page: ContentPage) -> ContentMetadata? {
        guard let metadata = metadata else { return nil }

        switch page {
        case .about: return metadata.about
        case .privacy: return metadata.privacy
        case .terms: return metadata.terms
        case .contact: return metadata.contact
        }
    }

    /// Get last updated date for a given page from metadata
    public func getLastUpdated(for page: ContentPage) -> String? {
        return getMetadata(for: page)?.lastUpdated
    }

    /// Clear all cached content
    public func clearCache() {
        contentCache.removeAll()
    }
}
