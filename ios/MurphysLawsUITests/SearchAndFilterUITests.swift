import XCTest

final class SearchAndFilterUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testSearchLaws() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Find and tap search bar
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))

        searchBar.tap()

        // Type search query
        searchBar.typeText("Murphy")

        // Wait for search results
        sleep(2)

        // Verify results appear
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.exists)
    }

    func testClearSearch() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Search for something
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))

        searchBar.tap()
        searchBar.typeText("Test")

        // Clear search
        if let clearButton = searchBar.buttons["Clear text"].firstMatch as? XCUIElement, clearButton.exists {
            clearButton.tap()
        }

        // Verify search is cleared
        XCTAssertEqual(searchBar.value as? String, "Search")
    }

    func testFilterByCategory() throws {
        // Navigate to Categories tab
        app.tabBars.buttons["Categories"].tap()

        // Wait for categories to load
        let firstCategory = app.buttons.matching(identifier: "CategoryCard").firstMatch
        XCTAssertTrue(firstCategory.waitForExistence(timeout: 5))

        // Tap first category
        firstCategory.tap()

        // Verify filtered laws appear
        let lawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(lawCard.waitForExistence(timeout: 3))
    }

    func testSearchWithFilters() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Search for something
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))

        searchBar.tap()
        searchBar.typeText("work")

        // If there are filter chips, tap one
        let filterChip = app.buttons.matching(identifier: "CategoryFilterChip").firstMatch
        if filterChip.waitForExistence(timeout: 2) {
            filterChip.tap()
        }

        // Wait for filtered results
        sleep(2)

        // Verify results exist
        let scrollView = app.scrollViews.firstMatch
        XCTAssertTrue(scrollView.exists)
    }
}
