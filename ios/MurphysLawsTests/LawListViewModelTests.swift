import XCTest
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
            Law(id: 1, text: "Test Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 2, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil),
            Law(id: 2, text: "Test Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
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
        // Given - Set up initial batch with enough items to trigger hasMorePages
        // The limit is typically 25, so we need to return at least that many or manually set hasMorePages
        let firstBatch = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 2, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        ]
        
        mockRepository.lawsToReturn = firstBatch
        await viewModel.loadLaws()
        
        XCTAssertEqual(viewModel.laws.count, 1, "Should have 1 law after initial load")
        XCTAssertEqual(viewModel.currentPage, 1)

        // Manually set hasMorePages to true so loadMore doesn't early return
        viewModel.hasMorePages = true

        // When - Provide a second batch (simulating next page)
        let secondBatch = [
            Law(id: 2, text: "Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = secondBatch
        
        await viewModel.loadMoreLaws()

        // Then
        // After loading more, we should have both laws
        XCTAssertEqual(viewModel.laws.count, 2, "Should have 2 laws total (first batch + second batch)")
        XCTAssertEqual(viewModel.laws[0].id, 1, "First law should still be Law 1")
        XCTAssertEqual(viewModel.laws[1].id, 2, "Second law should be Law 2")
        XCTAssertEqual(viewModel.currentPage, 2, "Should be on page 2")
    }

    func testRefreshLaws() async {
        // Given
        let initialLaws = [
            Law(id: 1, text: "Old Law", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 2, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.lawsToReturn = initialLaws
        await viewModel.loadLaws()

        let refreshedLaws = [
            Law(id: 2, text: "New Law", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
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
            Law(id: 3, text: "Murphy's Law", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 100, downvotes: 5, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
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
            Law(id: 4, text: "Tech Law", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 20, downvotes: 3, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
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

