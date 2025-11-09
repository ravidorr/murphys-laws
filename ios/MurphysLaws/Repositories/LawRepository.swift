//
//  LawRepository.swift
//  MurphysLaws
//
//  Repository for law data access
//

import Foundation

class LawRepository: ObservableObject {
    private let apiService = APIService.shared
    
    // MARK: - Mock Data for Testing
#if DEBUG
    var useMockData: Bool {
        ProcessInfo.processInfo.arguments.contains("UI-TESTING")
    }
    
    private var mockLaws: [Law] {
        let mockCategories = self.mockCategories
        
        return [
            Law(
                id: 1,
                text: "Anything that can go wrong will go wrong.",
                title: "Murphy's Law",
                slug: "murphys-law",
                rawMarkdown: nil,
                originNote: "Classic Murphy's Law",
                upvotes: 100,
                downvotes: 5,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [mockCategories[0]]
            ),
            Law(
                id: 2,
                text: "The severity of an error is directly proportional to the importance of the presentation.",
                title: "Demo Effect",
                slug: "demo-effect",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 50,
                downvotes: 2,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [mockCategories[1]]
            ),
            Law(
                id: 3,
                text: "When you're at work, you want to be at home. When you're at home, you can't stop thinking about work.",
                title: "Work-Life Paradox",
                slug: "work-life",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 75,
                downvotes: 10,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [mockCategories[0]]
            ),
            Law(
                id: 4,
                text: "The moment you sit down to eat, someone will call you.",
                title: "Dinner Interruption Law",
                slug: "dinner-interruption",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 60,
                downvotes: 3,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [mockCategories[2]]
            ),
            Law(
                id: 5,
                text: "The line you're in will always move slower than the others.",
                title: "Queue Theory",
                slug: "queue-theory",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 85,
                downvotes: 4,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [mockCategories[3]]
            )
        ]
    }
    
    private var mockCategories: [Category] {
        return [
            Category(
                id: 1,
                title: "Work",
                slug: "work",
                description: "Laws about workplace and office life",
                sourceFilePath: nil,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Category(
                id: 2,
                title: "Technology",
                slug: "tech",
                description: "Laws about computers and technology",
                sourceFilePath: nil,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Category(
                id: 3,
                title: "Life",
                slug: "life",
                description: "General life observations",
                sourceFilePath: nil,
                createdAt: Date(),
                updatedAt: Date()
            ),
            Category(
                id: 4,
                title: "Travel",
                slug: "travel",
                description: "Laws about travel and commuting",
                sourceFilePath: nil,
                createdAt: Date(),
                updatedAt: Date()
            )
        ]
    }
#endif

    // MARK: - Fetch Laws
    open func fetchLaws(
        limit: Int = Constants.API.defaultLimit,
        offset: Int = 0,
        query: String? = nil,
        categoryID: Int? = nil,
        attributionID: Int? = nil,
        sort: String = "score",
        order: String = "desc"
    ) async throws -> APIService.LawsResponse {
#if DEBUG
        // Use mock data in UI testing mode
        if useMockData {
            return await fetchMockLaws(
                limit: limit,
                offset: offset,
                query: query,
                categoryID: categoryID
            )
        }
#endif
        
        do {
            return try await apiService.fetchLaws(
                limit: limit,
                offset: offset,
                query: query,
                categoryID: categoryID,
                attributionID: attributionID,
                sort: sort,
                order: order
            )
        } catch {
#if DEBUG
            // Fallback to mock data on error in debug mode
            logWarning("API failed, falling back to mock data: \(error.localizedDescription)")
            return await fetchMockLaws(
                limit: limit,
                offset: offset,
                query: query,
                categoryID: categoryID
            )
#else
            throw error
#endif
        }
    }
    
#if DEBUG
    /// Fetch mock laws with filtering and pagination
    private func fetchMockLaws(
        limit: Int,
        offset: Int,
        query: String?,
        categoryID: Int?
    ) async -> APIService.LawsResponse {
        var filteredLaws = mockLaws
        
        // Apply search filter
        if let query = query, !query.isEmpty {
            filteredLaws = filteredLaws.filter { law in
                law.text.localizedCaseInsensitiveContains(query) ||
                (law.title?.localizedCaseInsensitiveContains(query) ?? false)
            }
        }
        
        // Apply category filter
        if let categoryID = categoryID {
            filteredLaws = filteredLaws.filter { law in
                law.categories?.contains(where: { $0.id == categoryID }) ?? false
            }
        }
        
        // Apply pagination
        let start = min(offset, filteredLaws.count)
        let end = min(offset + limit, filteredLaws.count)
        let page = Array(filteredLaws[start..<end])
        
        // Simulate network delay
        try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
        
        return APIService.LawsResponse(
            data: page,
            total: filteredLaws.count,
            limit: limit,
            offset: offset
        )
    }
#endif

    // MARK: - Fetch Law Detail
    open func fetchLawDetail(id: Int) async throws -> Law {
        logDebug("LawRepository.fetchLawDetail called for ID: \(id)")
#if DEBUG
        if useMockData {
            logInfo("Using mock data mode")
            if let law = mockLaws.first(where: { $0.id == id }) {
                logDebug("Found mock law with ID \(id): \(law.title ?? law.text)")
                try? await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds
                return law
            }
            logWarning("No mock law found for ID \(id)")
            throw NSError(domain: "LawRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Law not found"])
        }
#endif
        
        do {
            logDebug("Fetching from API for ID \(id)...")
            let result = try await apiService.fetchLawDetail(id: id)
            logInfo("API returned law: \(result.title ?? result.text)")
            return result
        } catch {
            logError("API error: \(error.localizedDescription)")
#if DEBUG
            // Fallback to mock data
            if let law = mockLaws.first(where: { $0.id == id }) {
                logWarning("Falling back to mock law with matching ID \(id)")
                return law
            }
            logWarning("No matching mock law, returning first mock law (ID: \(mockLaws.first?.id ?? -1))")
            return mockLaws.first ?? Law(
                id: id,
                text: "Mock Law (Error Fallback)",
                title: "Error: Could not load law \(id)",
                slug: "mock-law",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 0,
                downvotes: 0,
                createdAt: Date(),
                updatedAt: Date(),
                attributions: nil,
                categories: [Category.mock]
            )
#else
            throw error
#endif
        }
    }

    // MARK: - Fetch Law of Day
    open func fetchLawOfDay() async throws -> APIService.LawOfDayResponse {
#if DEBUG
        if useMockData {
            let dateFormatter = ISO8601DateFormatter()
            try? await Task.sleep(nanoseconds: 300_000_000)
            return APIService.LawOfDayResponse(
                law: mockLaws.first ?? Law.mock,
                featuredDate: dateFormatter.string(from: Date())
            )
        }
#endif
        
        do {
            return try await apiService.fetchLawOfDay()
        } catch {
#if DEBUG
            let dateFormatter = ISO8601DateFormatter()
            return APIService.LawOfDayResponse(
                law: mockLaws.first ?? Law.mock,
                featuredDate: dateFormatter.string(from: Date())
            )
#else
            throw error
#endif
        }
    }

    // MARK: - Submit Law
    func submitLaw(
        text: String,
        title: String?,
        categoryID: Int,
        authorName: String?,
        authorEmail: String?,
        isAnonymous: Bool
    ) async throws -> APIService.SubmitLawResponse {
#if DEBUG
        if useMockData {
            try? await Task.sleep(nanoseconds: 500_000_000)
            return APIService.SubmitLawResponse(
                success: true,
                message: "Law submitted successfully (mock)",
                lawID: 999
            )
        }
#endif
        
        return try await apiService.submitLaw(
            text: text,
            title: title,
            categoryID: categoryID,
            authorName: authorName,
            authorEmail: authorEmail,
            isAnonymous: isAnonymous
        )
    }
}

