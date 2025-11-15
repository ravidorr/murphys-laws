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
        // Try the working path first: content/metadata.json
        if let url = Bundle.main.url(forResource: "metadata", withExtension: "json", subdirectory: "content") {
            if let data = try? Data(contentsOf: url),
               let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) {
                self.metadata = decoded
                return
            }
        }
        
        // Fall back to Resources/content path
        if let url = Bundle.main.url(
            forResource: "metadata",
            withExtension: "json",
            subdirectory: "Resources/content"
        ) {
            if let data = try? Data(contentsOf: url),
               let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) {
                self.metadata = decoded
                return
            }
        }
    }

    /// Load markdown content for a given page
    public func loadContent(for page: ContentPage) -> String? {
        // Check cache first
        if let cached = contentCache[page] {
            return cached
        }

        // Try the working path first: content/
        if let url = Bundle.main.url(forResource: page.rawValue, withExtension: "md", subdirectory: "content") {
            if let content = try? String(contentsOf: url, encoding: .utf8) {
                contentCache[page] = content
                return content
            }
        }
        
        // Fall back to Resources/content path
        if let url = Bundle.main.url(
            forResource: page.rawValue,
            withExtension: "md",
            subdirectory: "Resources/content"
        ) {
            if let content = try? String(contentsOf: url, encoding: .utf8) {
                contentCache[page] = content
                return content
            }
        }
        
        return nil
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
