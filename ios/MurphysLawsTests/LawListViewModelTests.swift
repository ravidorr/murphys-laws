import XCTest
@testable import MurphysLaws

@MainActor
final class LawListViewModelTests: XCTestCase {
    var viewModel: LawListViewModel!
    var mockRepository: MockLawRepository!

    override func setUp() {
        super.setUp()
        mockRepository = MockLawRepository()
        viewModel = LawListViewModel(repository: mockRepository)
    }

    override func tearDown() {
        viewModel = nil
        mockRepository = nil
        super.tearDown()
    }

    func testInitialState() {
        XCTAssertTrue(viewModel.laws.isEmpty)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.currentPage, 0)
    }

    func testLoadLawsSuccess() async {
        // Given
        let mockLaws = [
            Law(id: 1, text: "Test Law 1", title: nil, upvotes: 10, downvotes: 2, createdAt: Date(), attributions: nil, categories: nil),
            Law(id: 2, text: "Test Law 2", title: nil, upvotes: 5, downvotes: 1, createdAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = mockLaws

        // When
        await viewModel.loadLaws()

        // Then
        XCTAssertEqual(viewModel.laws.count, 2)
        XCTAssertEqual(viewModel.laws.first?.id, 1)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNil(viewModel.errorMessage)
        XCTAssertEqual(viewModel.currentPage, 1)
    }

    func testLoadLawsFailure() async {
        // Given
        mockRepository.shouldFail = true

        // When
        await viewModel.loadLaws()

        // Then
        XCTAssertTrue(viewModel.laws.isEmpty)
        XCTAssertFalse(viewModel.isLoading)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    func testLoadMoreLaws() async {
        // Given
        let firstBatch = [
            Law(id: 1, text: "Law 1", title: nil, upvotes: 10, downvotes: 2, createdAt: Date(), attributions: nil, categories: nil)
        ]
        let secondBatch = [
            Law(id: 2, text: "Law 2", title: nil, upvotes: 5, downvotes: 1, createdAt: Date(), attributions: nil, categories: nil)
        ]

        mockRepository.lawsToReturn = firstBatch
        await viewModel.loadLaws()

        mockRepository.lawsToReturn = secondBatch

        // When
        await viewModel.loadMoreLaws()

        // Then
        XCTAssertEqual(viewModel.laws.count, 2)
        XCTAssertEqual(viewModel.currentPage, 2)
    }

    func testRefreshLaws() async {
        // Given
        let initialLaws = [
            Law(id: 1, text: "Old Law", title: nil, upvotes: 10, downvotes: 2, createdAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = initialLaws
        await viewModel.loadLaws()

        let refreshedLaws = [
            Law(id: 2, text: "New Law", title: nil, upvotes: 5, downvotes: 1, createdAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = refreshedLaws

        // When
        await viewModel.refreshLaws()

        // Then
        XCTAssertEqual(viewModel.laws.count, 1)
        XCTAssertEqual(viewModel.laws.first?.id, 2)
        XCTAssertEqual(viewModel.currentPage, 1)
    }

    func testSearchLaws() async {
        // Given
        let searchResults = [
            Law(id: 3, text: "Murphy's Law", title: nil, upvotes: 100, downvotes: 5, createdAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = searchResults

        // When
        viewModel.searchQuery = "Murphy"
        await viewModel.searchLaws()

        // Then
        XCTAssertEqual(viewModel.laws.count, 1)
        XCTAssertTrue(viewModel.laws.first?.text.contains("Murphy") ?? false)
    }

    func testFilterByCategory() async {
        // Given
        let filteredLaws = [
            Law(id: 4, text: "Tech Law", title: nil, upvotes: 20, downvotes: 3, createdAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = filteredLaws

        // When
        viewModel.selectedCategoryID = 1
        await viewModel.loadLaws()

        // Then
        XCTAssertEqual(viewModel.laws.count, 1)
        XCTAssertEqual(mockRepository.lastCategoryID, 1)
    }
}

// MARK: - Mock Repository

class MockLawRepository: LawRepository {
    var lawsToReturn: [Law] = []
    var shouldFail = false
    var lastSearchQuery: String?
    var lastCategoryID: Int?

    override func fetchLaws(limit: Int = 25, offset: Int = 0, query: String? = nil, categoryID: Int? = nil) async throws -> [Law] {
        lastSearchQuery = query
        lastCategoryID = categoryID

        if shouldFail {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock error"])
        }

        return lawsToReturn
    }

    override func fetchLaw(id: Int) async throws -> Law {
        if shouldFail {
            throw NSError(domain: "TestError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Mock error"])
        }

        return lawsToReturn.first ?? Law(id: id, text: "Mock Law", title: nil, upvotes: 0, downvotes: 0, createdAt: Date(), attributions: nil, categories: nil)
    }
}
