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
        print("🔍 Loading metadata from Resources/content/metadata.json")
        
        guard let url = Bundle.main.url(
            forResource: "metadata",
            withExtension: "json",
            subdirectory: "Resources/content"
        ) else {
            print("⚠️ Warning: Could not find metadata.json in Resources/content")
            
            // Try alternative path
            if let altUrl = Bundle.main.url(forResource: "metadata", withExtension: "json", subdirectory: "content") {
                print("✅ Found metadata at content/metadata.json")
                if let data = try? Data(contentsOf: altUrl),
                   let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) {
                    self.metadata = decoded
                    return
                }
            }
            
            print("⚠️ Continuing without metadata")
            return
        }
        
        guard let data = try? Data(contentsOf: url) else {
            print("⚠️ Warning: Could not read metadata.json")
            return
        }
        
        guard let decoded = try? JSONDecoder().decode(ContentMetadataRoot.self, from: data) else {
            print("⚠️ Warning: Could not decode metadata.json")
            return
        }

        self.metadata = decoded
        print("✅ Successfully loaded metadata")
    }

    /// Load markdown content for a given page
    public func loadContent(for page: ContentPage) -> String? {
        // Check cache first
        if let cached = contentCache[page] {
            return cached
        }

        // Debug: Print bundle information
        print("🔍 Looking for: \(page.rawValue).md in subdirectory: Resources/content")
        print("🔍 Bundle path: \(Bundle.main.bundlePath)")
        
        // List all resources in the bundle for debugging
        if let resourcePath = Bundle.main.resourcePath {
            print("🔍 Resource path: \(resourcePath)")
            let fileManager = FileManager.default
            
            // Check if Resources directory exists
            let resourcesPath = (resourcePath as NSString).appendingPathComponent("Resources")
            if fileManager.fileExists(atPath: resourcesPath) {
                print("✅ Resources directory exists")
                
                // Check if content subdirectory exists
                let contentPath = (resourcesPath as NSString).appendingPathComponent("content")
                if fileManager.fileExists(atPath: contentPath) {
                    print("✅ Resources/content directory exists")
                    
                    // List files in content directory
                    if let files = try? fileManager.contentsOfDirectory(atPath: contentPath) {
                        print("📁 Files in Resources/content: \(files)")
                    }
                } else {
                    print("❌ Resources/content directory does NOT exist")
                }
            } else {
                print("❌ Resources directory does NOT exist")
            }
        }

        // Try to load from bundle's Resources/content directory
        guard let url = Bundle.main.url(
            forResource: page.rawValue,
            withExtension: "md",
            subdirectory: "Resources/content"
        ) else {
            print("❌ Error: Could not find \(page.rawValue).md in Resources/content")
            
            // Try alternative paths
            print("🔍 Trying alternative path: content/\(page.rawValue).md")
            if let altUrl = Bundle.main.url(forResource: page.rawValue, withExtension: "md", subdirectory: "content") {
                print("✅ Found at content/\(page.rawValue).md")
                if let content = try? String(contentsOf: altUrl, encoding: .utf8) {
                    contentCache[page] = content
                    return content
                }
            }
            
            return nil
        }

        guard let content = try? String(contentsOf: url, encoding: .utf8) else {
            print("❌ Error: Could not read content from \(page.rawValue).md")
            return nil
        }

        // Cache and return
        contentCache[page] = content
        print("✅ Successfully loaded \(page.rawValue).md")
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
