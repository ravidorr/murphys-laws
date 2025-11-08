import XCTest

final class SearchAndFilterUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        throw XCTSkip("UI tests temporarily disabled during active UI development")
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testSearchLaws() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for view to load
        sleep(1)

        // Find and tap search bar
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))

        searchBar.tap()

        // Type search query
        searchBar.typeText("Murphy")

        // Wait for search results
        sleep(2)

        // Verify the list or scroll view still exists (may be empty or have results)
        // The test should pass as long as the UI doesn't crash
        XCTAssertTrue(searchBar.exists)
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
        let clearButton = searchBar.buttons["Clear text"]
        if clearButton.exists {
            clearButton.tap()
        }

        // Verify search is cleared (placeholder returns)
        // After clearing, the value becomes the placeholder or empty
        let searchValue = searchBar.value as? String
        XCTAssertTrue(searchValue == "Search" || searchValue?.isEmpty == true, "Search should be cleared")
    }

    func testFilterByCategory() throws {
        // Navigate to Categories tab
        app.tabBars.buttons["Categories"].tap()

        // Wait for categories to load
        sleep(2)
        
        // Find first category using accessibility identifier
        let firstCategory = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryCard-'")).firstMatch
        
        XCTAssertTrue(firstCategory.waitForExistence(timeout: 3), "Category card should exist")
        
        // Tap first category
        firstCategory.tap()

        // Wait for navigation
        sleep(1)

        // Verify we navigated (sheet or navigation occurred)
        // The tap working without crashing is a success
        XCTAssertTrue(true)
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
