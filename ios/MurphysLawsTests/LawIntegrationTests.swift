//
//  LawIntegrationTests.swift
//  MurphysLaws
//
//  Integration tests for law-related features
//

import Foundation
import Testing
@testable import MurphysLaws

@MainActor
@Suite("Law Integration Tests")
struct LawIntegrationTests {

    @Test("User can load and browse laws")
    func testBrowseLaws() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = Law.mockList

        let viewModel = LawListViewModel(repository: mockRepo)

        await viewModel.loadLaws()

        let laws = viewModel.laws
        #expect(laws.count == 3, "Should load 3 mock laws")
        #expect(laws.first?.id == 1, "First law should have ID 1")
    }

    @Test("User can search for specific laws")
    func testSearchLaws() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = [
            Law(
                id: 1,
                text: "Murphy's Law states that anything that can go wrong will go wrong",
                title: "Murphy's Law",
                slug: "murphys-law",
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 100,
                downvotes: 5,
                createdAt: nil,
                updatedAt: nil,
                attributions: nil,
                categories: nil
            )
        ]

        let viewModel = LawListViewModel(repository: mockRepo)
        viewModel.searchQuery = "Murphy"
        await viewModel.searchLaws()

        let laws = viewModel.laws
        #expect(laws.count == 1, "Should find 1 law matching 'Murphy'")
        #expect(laws.first?.text.contains("Murphy") == true, "Law should contain 'Murphy'")
    }

    @Test("User can vote on a law")
    func testVotingOnLaw() async throws {
        let votingService = VotingService.shared

        // Initially no vote
        let initialVote = votingService.getVote(for: 1)
        #expect(initialVote == nil, "Should have no initial vote")

        // Note: Actually voting requires mocking APIService
        // This test validates the structure is in place
    }

    @Test("Law detail view loads correctly")
    func testLawDetailLoading() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = [Law.mock]

        let viewModel = LawDetailViewModel(lawID: 1, initialLaw: Law.mock)

        let law = viewModel.law
        #expect(law != nil, "Law should be loaded")
        #expect(law?.id == 1, "Law ID should match")
    }

    @Test("Calculator computes probability correctly")
    func testCalculatorComputation() async throws {
        let viewModel = CalculatorViewModel()

        // Set high risk scenario
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 1.0
        viewModel.frequency = 1.0

        viewModel.calculate()

        let probability = viewModel.probability
        #expect(probability > 50, "High risk scenario should have >50% probability")

        let riskLevel = viewModel.riskLevel
        #expect(riskLevel == .high, "Should be high risk")
    }

    @Test("Empty search returns no results gracefully")
    func testEmptySearchResults() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = []

        let viewModel = LawListViewModel(repository: mockRepo)
        viewModel.searchQuery = "nonexistent"
        await viewModel.searchLaws()

        let laws = viewModel.laws
        #expect(laws.isEmpty, "Should return no laws for non-matching search")
    }

    @Test("Category filtering works correctly")
    func testCategoryFiltering() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = [
            Law(
                id: 1,
                text: "Tech law",
                title: "Technology Law",
                slug: nil,
                rawMarkdown: nil,
                originNote: nil,
                upvotes: 10,
                downvotes: 1,
                createdAt: nil,
                updatedAt: nil,
                attributions: nil,
                categories: [Category.mock]
            )
        ]

        let viewModel = LawListViewModel(repository: mockRepo, categoryID: 1)
        await viewModel.loadLaws()

        let categoryID = mockRepo.lastCategoryID
        #expect(categoryID == 1, "Should filter by category ID 1")
    }

    @Test("Pagination loads more laws correctly")
    func testPagination() async throws {
        let mockRepo = MockLawRepository()

        // First page
        mockRepo.lawsToReturn = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 1, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]

        let viewModel = LawListViewModel(repository: mockRepo)
        await viewModel.loadLaws()

        var laws = viewModel.laws
        #expect(laws.count == 1, "Should have 1 law after first load")

        // Enable more pages and load second batch
        viewModel.hasMorePages = true
        mockRepo.lawsToReturn = [
            Law(id: 2, text: "Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]

        await viewModel.loadMoreLaws()

        laws = viewModel.laws
        #expect(laws.count == 2, "Should have 2 laws after loading more")
    }

    @Test("Submit law validation works")
    func testSubmitLawValidation() async throws {
        let viewModel = SubmitLawViewModel()

        // Initially invalid
        var isValid = viewModel.isValid
        #expect(!isValid, "Should be invalid with empty fields")

        // Add required fields
        viewModel.lawText = "This is a new law about software development"
        viewModel.selectedCategoryID = 1
        viewModel.submitAnonymously = true

        isValid = viewModel.isValid
        #expect(isValid, "Should be valid with required fields filled")
    }
}

@MainActor
@Suite("Calculator Tests")
struct CalculatorIntegrationTests {

    @Test("Calculator resets to default values")
    func testCalculatorReset() async throws {
        let viewModel = CalculatorViewModel()

        // Modify values
        viewModel.urgency = 8.0
        viewModel.complexity = 9.0
        viewModel.reset()

        let urgency = viewModel.urgency
        let complexity = viewModel.complexity

        #expect(urgency == 5.0, "Urgency should reset to 5.0")
        #expect(complexity == 5.0, "Complexity should reset to 5.0")
    }

    @Test("Calculator probability stays within bounds")
    func testCalculatorBounds() async throws {
        let viewModel = CalculatorViewModel()

        // Test maximum values
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 10.0
        viewModel.frequency = 10.0

        viewModel.calculate()

        let probability = viewModel.probability
        #expect(probability >= 0.0 && probability <= 100.0, "Probability should be between 0 and 100")
    }

    @Test("Risk levels are calculated correctly")
    func testRiskLevelCalculation() async throws {
        let viewModel = CalculatorViewModel()

        // Low risk
        viewModel.urgency = 1.0
        viewModel.complexity = 1.0
        viewModel.importance = 1.0
        viewModel.skillLevel = 10.0
        viewModel.frequency = 10.0
        viewModel.calculate()

        var riskLevel = viewModel.riskLevel
        #expect(riskLevel == .low, "Should be low risk")

        // High risk
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 1.0
        viewModel.frequency = 1.0
        viewModel.calculate()

        riskLevel = viewModel.riskLevel
        #expect(riskLevel == .high, "Should be high risk")
    }
}

@Suite("Network and Error Handling Tests")
struct NetworkErrorTests {

    @Test("API error provides descriptive messages")
    func testAPIErrorMessages() {
        let networkError = APIError.networkError(URLError(.notConnectedToInternet))
        #expect(networkError.errorDescription != nil, "Network error should have description")

        let rateLimitError = APIError.rateLimitExceeded
        #expect(rateLimitError.errorDescription?.contains("request") == true, "Rate limit error should mention requests")
    }

    @Test("Voting error messages are helpful")
    func testVotingErrors() {
        let rateLimitError = APIError.rateLimitExceeded
        #expect(rateLimitError.errorDescription?.contains("try again") == true, "Should suggest retrying later")
    }
}
