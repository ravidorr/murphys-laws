//
//  MockLawRepository.swift
//  MurphysLawsTests
//
//  Shared mock repository for testing
//

import Foundation
@testable import MurphysLaws

class MockLawRepository: LawRepository {
    var shouldFail = false
    var lawsToReturn: [Law] = []
    var lawOfDayToReturn: Law?
    var topVotedToReturn: [Law] = []
    var trendingToReturn: [Law] = []
    var lastSearchQuery: String?
    var lastCategoryID: Int?

    override func fetchLawOfDay() async throws -> LawOfDayResponse {
        if shouldFail {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock error"])
        }

        guard let law = lawOfDayToReturn else {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "No law of day"])
        }

        let dateFormatter = ISO8601DateFormatter()
        return LawOfDayResponse(law: law, featuredDate: dateFormatter.string(from: Date()))
    }

    override func fetchLaws(
        limit: Int = 25,
        offset: Int = 0,
        query: String? = nil,
        categoryID: Int? = nil,
        attributionID: Int? = nil,
        sort: String = "score",
        order: String = "desc"
    ) async throws -> LawsResponse {
        lastSearchQuery = query
        lastCategoryID = categoryID

        if shouldFail {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock error"])
        }

        // Return appropriate laws based on sort parameter
        let laws: [Law]
        if sort == "trending" {
            laws = trendingToReturn
        } else if sort == "score" {
            laws = topVotedToReturn
        } else {
            laws = lawsToReturn.isEmpty ? topVotedToReturn : lawsToReturn
        }

        return LawsResponse(data: laws, total: laws.count, limit: limit, offset: offset)
    }

    override func fetchLawDetail(id: Int) async throws -> Law {
        if shouldFail {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock error"])
        }

        return lawsToReturn.first ?? Law(
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
            categories: nil
        )
    }
}
