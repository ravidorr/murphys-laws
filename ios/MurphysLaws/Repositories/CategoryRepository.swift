//
//  CategoryRepository.swift
//  MurphysLaws
//
//  Repository for category data access with caching
//

import Foundation

class CategoryRepository: ObservableObject {
    private let apiService = APIService.shared
#if DEBUG
    private let mockCategories: [Category] = Category.mockList
#endif
    private let cacheKey = Constants.Storage.cachedCategories
    private let cacheMaxAge: TimeInterval = Constants.Performance.cacheMaxAge

    @Published var categories: [Category] = []

    init() {
        loadFromCache()
    }

    // MARK: - Fetch Categories
    func fetchCategories(forceRefresh: Bool = false) async throws -> [Category] {
        print("📂 CategoryRepository: fetchCategories called (forceRefresh: \(forceRefresh))")
        
        // Return cached if available and not forcing refresh
        if !forceRefresh, !categories.isEmpty {
            if isCacheValid() {
                print("✅ CategoryRepository: Returning \(categories.count) cached categories")
                return categories
            } else {
                print("⚠️ CategoryRepository: Cache expired")
            }
        } else if categories.isEmpty {
            print("📭 CategoryRepository: No cached categories")
        }

        // Fetch from API
        print("🌐 CategoryRepository: Fetching from API...")
        do {
            let fetchedCategories = try await apiService.fetchCategories()
            print("✅ CategoryRepository: Received \(fetchedCategories.count) categories from API")
            
#if DEBUG
            // In DEBUG mode, if API returns empty array, use mock data
            if fetchedCategories.isEmpty {
                print("⚠️ CategoryRepository: API returned empty array, using mock data in DEBUG mode")
                categories = mockCategories
                saveToCache(mockCategories)
                return mockCategories
            }
#endif
            
            categories = fetchedCategories
            // Save to cache
            saveToCache(fetchedCategories)
            return fetchedCategories
        } catch {
            print("❌ CategoryRepository: API error: \(error)")
#if DEBUG
            // Fallback to mock categories for UI tests
            print("🧪 CategoryRepository: Falling back to \(mockCategories.count) mock categories")
            categories = mockCategories
            saveToCache(mockCategories)
            return mockCategories
#else
            throw error
#endif
        }
    }

    // MARK: - Cache Management
    private func loadFromCache() {
        print("💾 CategoryRepository: Loading from cache...")
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let cached = try? JSONDecoder().decode([Category].self, from: data),
           isCacheValid() {
            print("✅ CategoryRepository: Loaded \(cached.count) categories from cache")
            categories = cached
        } else {
            print("📭 CategoryRepository: No valid cache found")
        }
    }

    private func saveToCache(_ categories: [Category]) {
        print("💾 CategoryRepository: Saving \(categories.count) categories to cache")
        if let encoded = try? JSONEncoder().encode(categories) {
            UserDefaults.standard.set(encoded, forKey: cacheKey)
            UserDefaults.standard.set(Date(), forKey: "\(cacheKey)_timestamp")
            print("✅ CategoryRepository: Cache saved successfully")
        } else {
            print("❌ CategoryRepository: Failed to encode categories for cache")
        }
    }

    private func isCacheValid() -> Bool {
        guard let timestamp = UserDefaults.standard.object(forKey: "\(cacheKey)_timestamp") as? Date else {
            return false
        }

        return Date().timeIntervalSince(timestamp) < cacheMaxAge
    }

    func clearCache() {
        UserDefaults.standard.removeObject(forKey: cacheKey)
        UserDefaults.standard.removeObject(forKey: "\(cacheKey)_timestamp")
        categories.removeAll()
    }
}

