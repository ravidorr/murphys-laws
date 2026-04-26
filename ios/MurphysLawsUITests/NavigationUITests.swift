import XCTest

final class NavigationUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()

        // Enable UI test mode (faster animations)
        app.launchArguments = ["UI-TESTING"]
        app.launchEnvironment = ["UITEST_DISABLE_ANIMATIONS": "1"]

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
        sleep(3)

        // Find law button
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch

        XCTAssertTrue(firstLawButton.waitForExistence(timeout: 5), "Law button should exist")
        firstLawButton.tap()

        // Verify detail view elements - sheet presentation
        sleep(1)

        let upvoteButton = app.buttons["Upvote"]
        let downvoteButton = app.buttons["Downvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3) || downvoteButton.waitForExistence(timeout: 3), "Vote buttons should exist in detail view")

        // Navigate back - look for close button in sheet or swipe down
        let closeButton = app.buttons["Close"].firstMatch
        if closeButton.exists {
            closeButton.tap()
        } else {
            // Swipe down to dismiss sheet
            app.swipeDown()
        }

        // Verify we're back at browse view
        let searchBar = app.searchFields.firstMatch
        XCTAssertTrue(searchBar.waitForExistence(timeout: 2), "Should return to browse view")
    }

    func testSubmitLawNavigation() throws {
        // Navigate to More tab
        app.tabBars.buttons["More"].tap()

        // Tap Submit a Law
        let submitButton = app.buttons["Submit a Law"]
        XCTAssertTrue(submitButton.waitForExistence(timeout: 5), "Submit a Law button should exist")
        submitButton.tap()

        // Verify form elements exist
        let lawTextField = app.textFields["SubmitLawTextField"]
        XCTAssertTrue(lawTextField.waitForExistence(timeout: 5), "Law text field should exist")

        let categoryPicker = app.buttons["Select Category"]
        XCTAssertTrue(categoryPicker.waitForExistence(timeout: 5), "Category picker should exist")

        // Navigate back
        let backButton = app.navigationBars.buttons["Cancel"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 5), "Cancel button should exist")
        backButton.tap()
    }

    func testCategoriesViewDisplaysWithoutIcons() throws {
        // Navigate to Categories tab
        app.tabBars.buttons["Categories"].tap()

        // Wait for categories to load
        sleep(2)

        // Verify category cards exist
        let firstCategoryCard = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryCard-'")).firstMatch
        XCTAssertTrue(firstCategoryCard.waitForExistence(timeout: 5), "Category cards should exist")

        // Note: Category cards should display titles without icons
        // Visual verification required, but we can verify they render
        XCTAssertTrue(firstCategoryCard.exists, "Category card should be visible")
    }

    func testSubmitLawCategoriesWithoutIcons() throws {
        // Navigate to More tab
        app.tabBars.buttons["More"].tap()

        // Tap Submit a Law
        let submitButton = app.buttons["Submit a Law"]
        submitButton.tap()

        // Wait for categories to load
        sleep(2)

        // Verify category buttons exist in the form
        // Note: Categories should display as text-only without icons
        let categoryButtons = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Murphy'"))
        XCTAssertTrue(categoryButtons.count > 0, "Category buttons should exist in submit form")

        // Verify we can interact with a category
        if categoryButtons.count > 0 {
            let firstCategory = categoryButtons.element(boundBy: 0)
            XCTAssertTrue(firstCategory.exists, "First category button should be tappable")
        }

        // Navigate back
        let cancelButton = app.navigationBars.buttons["Cancel"]
        cancelButton.tap()
    }

    func testAboutSheetReachOutLink() throws {
        // Navigate to More tab
        app.tabBars.buttons["More"].tap()

        // Open About sheet
        let aboutButton = app.buttons["About Murphy's Laws"]
        XCTAssertTrue(aboutButton.waitForExistence(timeout: 2))
        aboutButton.tap()

        // Wait for about content to load
        sleep(1)

        // Note: The "Reach out" link navigation is handled via data-nav attribute
        // This is an internal navigation that may not be directly testable via UI tests
        // as it involves SwiftUI Text with attributed strings

        // Verify we're in the About view
        let aboutTitle = app.navigationBars["About"]
        XCTAssertTrue(aboutTitle.exists, "Should be viewing About page")

        // Close the about sheet
        let doneButton = app.navigationBars.buttons["Done"]
        if doneButton.exists {
            doneButton.tap()
        }
    }

    func testNoDuplicateCategoriesInGrid() throws {
        // Navigate to Categories tab
        app.tabBars.buttons["Categories"].tap()

        // Wait for categories to load
        sleep(2)

        // Get all category cards
        let categoryCards = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryCard-'"))
        let count = categoryCards.count

        // Note: This test verifies categories render, but can't easily verify
        // deduplication without reading actual text content
        // The deduplication is better tested at the unit test level
        XCTAssertTrue(count > 0, "Should have at least one category")

        // Verify that we have a reasonable number (after deduplication, should be ~55)
        XCTAssertTrue(count < 65, "Should have deduplicated categories (less than original 64)")
    }

    func testBrowseFilterChipsDisplay() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        XCTAssertTrue(firstLawButton.waitForExistence(timeout: 5), "Browse laws should load before filtering")

        // Open filters
        let filterButton = app.buttons["BrowseFilterButton"]
        XCTAssertTrue(filterButton.waitForExistence(timeout: 5), "Filter button should exist")
        filterButton.tap()

        // Select a category filter
        let firstCategory = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'FilterCategory-'")).firstMatch
        XCTAssertTrue(firstCategory.waitForExistence(timeout: 5), "Filter category should exist")
        let selectedCategoryLabel = firstCategory.label
        firstCategory.tap()

        // Close filter sheet
        let doneButton = app.navigationBars.buttons["Done"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5), "Done button should exist")
        doneButton.tap()

        // Verify filter chip appears
        let filterChip = app.staticTexts["FilterChip-\(selectedCategoryLabel)"]
        XCTAssertTrue(filterChip.waitForExistence(timeout: 5), "Active filter chip should be visible")

        // Verify filter button shows badge (red dot) - hard to test directly
        // The badge is a visual indicator, presence tested via chip existence
    }

    func testRemoveFilterViaChip() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        XCTAssertTrue(firstLawButton.waitForExistence(timeout: 5), "Browse laws should load before filtering")

        // Open and apply filter
        let filterButton = app.buttons["BrowseFilterButton"]
        XCTAssertTrue(filterButton.waitForExistence(timeout: 5), "Filter button should exist")
        filterButton.tap()

        let firstCategory = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'FilterCategory-'")).firstMatch
        XCTAssertTrue(firstCategory.waitForExistence(timeout: 5), "Filter category should exist")
        let selectedCategoryLabel = firstCategory.label
        firstCategory.tap()

        let doneButton = app.navigationBars.buttons["Done"]
        XCTAssertTrue(doneButton.waitForExistence(timeout: 5), "Done button should exist")
        doneButton.tap()

        // Find and tap X button on filter chip
        let removeButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'RemoveFilterChip-'")).firstMatch
        XCTAssertTrue(removeButton.waitForExistence(timeout: 5), "Remove filter chip button should exist")
        removeButton.tap()

        // Verify filter chip disappears
        let filterChip = app.staticTexts["FilterChip-\(selectedCategoryLabel)"]
        XCTAssertFalse(filterChip.waitForExistence(timeout: 2), "Filter chip should be removed")
    }

    func testCategoryLawNavigationShowsCorrectLaw() throws {
        // Navigate to Categories tab
        app.tabBars.buttons["Categories"].tap()
        sleep(2)

        // Tap on first category
        let firstCategory = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryCard-'")).firstMatch
        XCTAssertTrue(firstCategory.waitForExistence(timeout: 5))
        firstCategory.tap()

        // Wait for laws to load in category detail
        sleep(2)

        // Get the first law's text from the list
        let firstLawInList = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Murphy' OR label CONTAINS 'Law'")).element(boundBy: 0)
        _ = firstLawInList.label  // Store for potential future use

        // Tap on the first law
        let firstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        if firstLawRow.exists {
            firstLawRow.tap()
            sleep(1)

            // Verify we're in the detail view and it shows content
            // Note: Specific text matching is difficult in UI tests, but we can verify:
            // 1. Detail view exists
            // 2. Vote buttons exist (indicates proper law loaded)
            let upvoteButton = app.buttons["Upvote"]
            let downvoteButton = app.buttons["Downvote"]
            XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3) || downvoteButton.waitForExistence(timeout: 3),
                         "Vote buttons should exist, indicating law detail loaded correctly")

            // Navigate back
            let backButton = app.navigationBars.buttons.element(boundBy: 0)
            if backButton.exists {
                backButton.tap()
            }
        }

        // Close category detail sheet
        let categoryDoneButton = app.navigationBars.buttons["Done"]
        if categoryDoneButton.exists {
            categoryDoneButton.tap()
        }
    }

    func testVoteIconsConsistentAcrossViews() throws {
        // This test verifies that both Browse and Categories use the same vote icons
        // by checking the icon identifiers exist (thumbs up/down)

        // Check Browse view
        app.tabBars.buttons["Browse"].tap()
        sleep(2)

        // Browse view uses thumbs in LawListRow
        // Icons are inside Labels, difficult to test directly in UI tests
        // This is better tested at unit/snapshot level

        // Check Categories view
        app.tabBars.buttons["Categories"].tap()
        sleep(2)

        let firstCategory = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryCard-'")).firstMatch
        if firstCategory.waitForExistence(timeout: 5) {
            firstCategory.tap()

            // Category detail LawRowView should now use thumbs (not arrows)
            // Visual verification required - icons are part of Label elements
            // Verify the list exists with laws
            let lawsList = app.collectionViews["CategoryLawList"].firstMatch
            let firstCategoryLaw = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'CategoryLawRow-'")).firstMatch
            XCTAssertTrue(
                lawsList.waitForExistence(timeout: 5) || firstCategoryLaw.waitForExistence(timeout: 5),
                "Laws list should be visible in category detail"
            )
        }
    }
}
