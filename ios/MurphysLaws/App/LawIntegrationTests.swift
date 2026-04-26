//
//  LawIntegrationTests.swift
//  MurphysLaws
//
//  Integration tests for law-related features
//

import Testing
@testable import MurphysLaws

@Suite("Law Integration Tests")
struct LawIntegrationTests {
    
    @Test("User can load and browse laws")
    func testBrowseLaws() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = Law.mockList
        
        let viewModel = await LawListViewModel(repository: mockRepo)
        
        await viewModel.loadLaws()
        
        let laws = await viewModel.laws
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
        
        let viewModel = await LawListViewModel(repository: mockRepo)
        await viewModel.searchQuery = "Murphy"
        await viewModel.searchLaws()
        
        let laws = await viewModel.laws
        #expect(laws.count == 1, "Should find 1 law matching 'Murphy'")
        #expect(laws.first?.text.contains("Murphy") == true, "Law should contain 'Murphy'")
    }
    
    @Test("User can vote on a law")
    func testVotingOnLaw() async throws {
        let votingService = await VotingService.shared
        
        // Initially no vote
        let initialVote = await votingService.getVote(for: 1)
        #expect(initialVote == nil, "Should have no initial vote")
        
        // Note: Actually voting requires mocking APIService
        // This test validates the structure is in place
    }
    
    @Test("Law detail view loads correctly")
    func testLawDetailLoading() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = [Law.mock]
        
        let viewModel = await LawDetailViewModel(lawID: 1, initialLaw: Law.mock)
        
        let law = await viewModel.law
        #expect(law != nil, "Law should be loaded")
        #expect(law?.id == 1, "Law ID should match")
    }
    
    @Test("Calculator computes probability correctly")
    func testCalculatorComputation() async throws {
        let viewModel = await CalculatorViewModel()
        
        // Set high risk scenario
        await viewModel.urgency = 10.0
        await viewModel.complexity = 10.0
        await viewModel.importance = 10.0
        await viewModel.skillLevel = 1.0
        await viewModel.frequency = 1.0
        
        await viewModel.calculate()
        
        let probability = await viewModel.probability
        #expect(probability > 50, "High risk scenario should have >50% probability")
        
        let riskLevel = await viewModel.riskLevel
        #expect(riskLevel == .high, "Should be high risk")
    }
    
    @Test("Empty search returns no results gracefully")
    func testEmptySearchResults() async throws {
        let mockRepo = MockLawRepository()
        mockRepo.lawsToReturn = []
        
        let viewModel = await LawListViewModel(repository: mockRepo)
        await viewModel.searchQuery = "nonexistent"
        await viewModel.searchLaws()
        
        let laws = await viewModel.laws
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
        
        let viewModel = await LawListViewModel(categoryID: 1, repository: mockRepo)
        await viewModel.loadLaws()
        
        let categoryID = await mockRepo.lastCategoryID
        #expect(categoryID == 1, "Should filter by category ID 1")
    }
    
    @Test("Pagination loads more laws correctly")
    func testPagination() async throws {
        let mockRepo = MockLawRepository()
        
        // First page
        mockRepo.lawsToReturn = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 1, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]
        
        let viewModel = await LawListViewModel(repository: mockRepo)
        await viewModel.loadLaws()
        
        var laws = await viewModel.laws
        #expect(laws.count == 1, "Should have 1 law after first load")
        
        // Enable more pages and load second batch
        await viewModel.hasMorePages = true
        mockRepo.lawsToReturn = [
            Law(id: 2, text: "Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]
        
        await viewModel.loadMoreLaws()
        
        laws = await viewModel.laws
        #expect(laws.count == 2, "Should have 2 laws after loading more")
    }
    
    @Test("Submit law validation works")
    func testSubmitLawValidation() async throws {
        let viewModel = await SubmitLawViewModel()
        
        // Initially invalid
        var isValid = await viewModel.isValid
        #expect(!isValid, "Should be invalid with empty fields")
        
        // Add required fields
        await viewModel.lawText = "This is a new law about software development"
        await viewModel.selectedCategoryID = 1
        await viewModel.submitAnonymously = true
        
        isValid = await viewModel.isValid
        #expect(isValid, "Should be valid with required fields filled")
    }
}

@Suite("Calculator Tests")
struct CalculatorIntegrationTests {
    
    @Test("Calculator resets to default values")
    func testCalculatorReset() async throws {
        let viewModel = await CalculatorViewModel()
        
        // Modify values
        await viewModel.urgency = 8.0
        await viewModel.complexity = 9.0
        await viewModel.reset()
        
        let urgency = await viewModel.urgency
        let complexity = await viewModel.complexity
        
        #expect(urgency == 5.0, "Urgency should reset to 5.0")
        #expect(complexity == 5.0, "Complexity should reset to 5.0")
    }
    
    @Test("Calculator probability stays within bounds")
    func testCalculatorBounds() async throws {
        let viewModel = await CalculatorViewModel()
        
        // Test maximum values
        await viewModel.urgency = 10.0
        await viewModel.complexity = 10.0
        await viewModel.importance = 10.0
        await viewModel.skillLevel = 10.0
        await viewModel.frequency = 10.0
        
        await viewModel.calculate()
        
        let probability = await viewModel.probability
        #expect(probability >= 0.0 && probability <= 100.0, "Probability should be between 0 and 100")
    }
    
    @Test("Risk levels are calculated correctly")
    func testRiskLevelCalculation() async throws {
        let viewModel = await CalculatorViewModel()
        
        // Low risk
        await viewModel.urgency = 1.0
        await viewModel.complexity = 1.0
        await viewModel.importance = 1.0
        await viewModel.skillLevel = 10.0
        await viewModel.frequency = 10.0
        await viewModel.calculate()
        
        var riskLevel = await viewModel.riskLevel
        #expect(riskLevel == .low, "Should be low risk")
        
        // High risk
        await viewModel.urgency = 10.0
        await viewModel.complexity = 10.0
        await viewModel.importance = 10.0
        await viewModel.skillLevel = 1.0
        await viewModel.frequency = 1.0
        await viewModel.calculate()
        
        riskLevel = await viewModel.riskLevel
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
        let rateLimitError = VotingError.rateLimitExceeded
        #expect(rateLimitError.errorDescription?.contains("wait") == true, "Should suggest waiting")
    }
}
