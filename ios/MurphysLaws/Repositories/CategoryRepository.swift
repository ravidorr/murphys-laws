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
        // Return cached if available and not forcing refresh
        if !forceRefresh, !categories.isEmpty {
            if isCacheValid() {
                return categories
            }
        }

        // Fetch from API
        do {
            let fetchedCategories = try await apiService.fetchCategories()
            categories = fetchedCategories
            // Save to cache
            saveToCache(fetchedCategories)
            return fetchedCategories
        } catch {
#if DEBUG
            // Fallback to mock categories for UI tests
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
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let cached = try? JSONDecoder().decode([Category].self, from: data),
           isCacheValid() {
            categories = cached
        }
    }

    private func saveToCache(_ categories: [Category]) {
        if let encoded = try? JSONEncoder().encode(categories) {
            UserDefaults.standard.set(encoded, forKey: cacheKey)
            UserDefaults.standard.set(Date(), forKey: "\(cacheKey)_timestamp")
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

