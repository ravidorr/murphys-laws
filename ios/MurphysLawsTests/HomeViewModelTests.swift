import XCTest
@testable import MurphysLaws

@MainActor
final class HomeViewModelTests: XCTestCase {
    var viewModel: HomeViewModel!
    var mockRepository: MockLawRepository!

    override func setUp() {
        super.setUp()
        mockRepository = MockLawRepository()
        viewModel = HomeViewModel(repository: mockRepository)
    }

    override func tearDown() {
        viewModel = nil
        mockRepository = nil
        super.tearDown()
    }

    func testInitialState() {
        XCTAssertNil(viewModel.lawOfTheDay)
        XCTAssertTrue(viewModel.topVotedLaws.isEmpty)
        XCTAssertTrue(viewModel.trendingLaws.isEmpty)
        XCTAssertTrue(viewModel.isLoadingLawOfDay) // Starts as true to show skeleton
        XCTAssertNil(viewModel.errorMessage)
    }

    func testLoadLawOfTheDaySuccess() async {
        // Given
        let mockLaw = Law(
            id: 1,
            text: "If anything can go wrong, it will.",
            title: "Murphy's Law",
            slug: "murphys-law",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 100,
            downvotes: 5,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: nil
        )
        mockRepository.lawOfDayToReturn = mockLaw

        // When
        await viewModel.loadLawOfTheDay()

        // Then
        XCTAssertNotNil(viewModel.lawOfTheDay)
        XCTAssertEqual(viewModel.lawOfTheDay?.id, 1)
        XCTAssertFalse(viewModel.isLoadingLawOfDay)
        XCTAssertNil(viewModel.errorMessage)
    }

    func testLoadLawOfTheDayFailure() async {
        // Given
        mockRepository.shouldFail = true

        // When
        await viewModel.loadLawOfTheDay()

        // Then
        XCTAssertNil(viewModel.lawOfTheDay)
        XCTAssertFalse(viewModel.isLoadingLawOfDay)
        XCTAssertNotNil(viewModel.errorMessage)
    }

    func testLoadTopVotedLawsSuccess() async {
        // Given
        let mockLaws = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 50, downvotes: 2, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil),
            Law(id: 2, text: "Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 40, downvotes: 1, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.topVotedToReturn = mockLaws

        // When
        await viewModel.loadTopVotedLaws()

        // Then
        XCTAssertEqual(viewModel.topVotedLaws.count, 2)
        XCTAssertEqual(viewModel.topVotedLaws.first?.upvotes, 50)
    }

    func testLoadTrendingLawsSuccess() async {
        // Given
        let mockLaws = [
            Law(id: 3, text: "Trending Law", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 30, downvotes: 1, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        ]
        mockRepository.trendingToReturn = mockLaws

        // When
        await viewModel.loadTrendingLaws()

        // Then
        XCTAssertEqual(viewModel.trendingLaws.count, 1)
    }

    func testRefreshAllContent() async {
        // Given
        let mockLaw = Law(id: 1, text: "Test", title: nil, slug: nil, rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 0, createdAt: Date(), updatedAt: Date(), attributions: nil, categories: nil)
        mockRepository.lawOfDayToReturn = mockLaw
        mockRepository.topVotedToReturn = [mockLaw]
        mockRepository.trendingToReturn = [mockLaw]

        // When
        await viewModel.refreshAll()

        // Then
        XCTAssertNotNil(viewModel.lawOfTheDay)
        XCTAssertFalse(viewModel.topVotedLaws.isEmpty)
        XCTAssertFalse(viewModel.trendingLaws.isEmpty)
    }
}
