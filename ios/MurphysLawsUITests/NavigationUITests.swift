import XCTest

final class NavigationUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testTabBarNavigation() throws {
        // Test Home tab
        let homeTab = app.tabBars.buttons["Home"]
        XCTAssertTrue(homeTab.exists)
        homeTab.tap()

        // Verify Law of the Day card exists
        let lawOfDayCard = app.staticTexts["Law of the Day"]
        XCTAssertTrue(lawOfDayCard.waitForExistence(timeout: 5))

        // Test Browse tab
        let browseTab = app.tabBars.buttons["Browse"]
        XCTAssertTrue(browseTab.exists)
        browseTab.tap()

        // Verify search bar exists
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))

        // Test Categories tab
        let categoriesTab = app.tabBars.buttons["Categories"]
        XCTAssertTrue(categoriesTab.exists)
        categoriesTab.tap()

        // Verify category grid exists
        XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 2))

        // Test Calculator tab
        let calculatorTab = app.tabBars.buttons["Calculator"]
        XCTAssertTrue(calculatorTab.exists)
        calculatorTab.tap()

        // Verify calculator sliders exist
        let urgencySlider = app.sliders["Urgency Slider"]
        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))

        // Test More tab
        let moreTab = app.tabBars.buttons["More"]
        XCTAssertTrue(moreTab.exists)
        moreTab.tap()

        // Verify settings/more options exist
        let submitButton = app.buttons["Submit a Law"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 2))
    }

    func testLawDetailNavigation() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(firstLawCard.waitForExistence(timeout: 5))

        // Tap first law
        firstLawCard.tap()

        // Verify detail view elements
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        XCTAssertTrue(backButton.waitForExistence(timeout: 2))

        let upvoteButton = app.buttons["Upvote"]
        let downvoteButton = app.buttons["Downvote"]
        XCTAssertTrue(upvoteButton.exists || downvoteButton.exists)

        // Navigate back
        backButton.tap()

        // Verify we're back at browse view
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2))
    }

    func testSubmitLawNavigation() throws {
        // Navigate to More tab
        app.tabBars.buttons["More"].tap()

        // Tap Submit a Law
        let submitButton = app.buttons["Submit a Law"]
        submitButton.tap()

        // Verify form elements exist
        let lawTextField = app.textViews.firstMatch
        XCTAssertTrue(lawTextField.waitForExistence(timeout: 2))

        let categoryPicker = app.buttons["Select Category"]
        XCTAssertTrue(categoryPicker.exists)

        // Navigate back
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        backButton.tap()
    }
}
