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
        generateMockLaws()
    }
    
    private var mockCategories: [Category] {
        generateMockCategories()
    }
#endif

    // MARK: - Fetch Laws
    func fetchLaws(
        limit: Int = Constants.API.defaultLimit,
        offset: Int = 0,
        query: String? = nil,
        categoryID: Int? = nil,
        attributionID: Int? = nil,
        sort: String = "score",
        order: String = "desc"
    ) async throws -> LawsResponse {
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
            print("⚠️ API failed, falling back to mock data: \(error)")
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
    ) async -> LawsResponse {
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
        
        return LawsResponse(
            data: page,
            total: filteredLaws.count,
            limit: limit,
            offset: offset
        )
    }
#endif

    // MARK: - Fetch Law Detail
    func fetchLawDetail(id: Int) async throws -> Law {
#if DEBUG
        if useMockData {
            if let law = mockLaws.first(where: { $0.id == id }) {
                try? await Task.sleep(nanoseconds: 300_000_000) // 0.3 seconds
                return law
            }
            throw NSError(domain: "LawRepository", code: 404, userInfo: [NSLocalizedDescriptionKey: "Law not found"])
        }
#endif
        
        do {
            return try await apiService.fetchLawDetail(id: id)
        } catch {
#if DEBUG
            // Fallback to mock data
            if let law = mockLaws.first(where: { $0.id == id }) {
                return law
            }
            return mockLaws.first ?? Law(
                id: id,
                text: "Mock Law",
                title: nil,
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
    func fetchLawOfDay() async throws -> LawOfDayResponse {
#if DEBUG
        if useMockData {
            let dateFormatter = ISO8601DateFormatter()
            try? await Task.sleep(nanoseconds: 300_000_000)
            return LawOfDayResponse(
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
            return LawOfDayResponse(
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

