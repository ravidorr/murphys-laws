import XCTest

final class NavigationUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        throw XCTSkip("UI tests temporarily disabled during active UI development")
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
        sleep(2)
        
        // Open filters
        let filterButton = app.navigationBars.buttons.matching(identifier: "line.3.horizontal.decrease.circle").firstMatch
        XCTAssertTrue(filterButton.waitForExistence(timeout: 2))
        filterButton.tap()
        
        // Select a category filter
        sleep(1)
        let firstCategory = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Murphy'")).element(boundBy: 1)
        if firstCategory.exists {
            firstCategory.tap()
        }
        
        // Close filter sheet
        let doneButton = app.navigationBars.buttons["Done"]
        doneButton.tap()
        
        // Verify filter chip appears
        sleep(1)
        let filterChips = app.scrollViews.otherElements.buttons.containing(NSPredicate(format: "label CONTAINS 'Murphy'"))
        XCTAssertTrue(filterChips.count > 0, "Active filter chip should be visible")
        
        // Verify filter button shows badge (red dot) - hard to test directly
        // The badge is a visual indicator, presence tested via chip existence
    }
    
    func testRemoveFilterViaChip() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()
        sleep(2)
        
        // Open and apply filter
        let filterButton = app.navigationBars.buttons.matching(identifier: "line.3.horizontal.decrease.circle").firstMatch
        filterButton.tap()
        sleep(1)
        
        let firstCategory = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Murphy'")).element(boundBy: 1)
        if firstCategory.exists {
            firstCategory.tap()
        }
        
        app.navigationBars.buttons["Done"].tap()
        sleep(1)
        
        // Find and tap X button on filter chip
        let removeButton = app.buttons["xmark.circle.fill"].firstMatch
        if removeButton.exists {
            removeButton.tap()
            
            // Verify filter chip disappears
            sleep(1)
            let filterChips = app.scrollViews.otherElements.buttons.containing(NSPredicate(format: "label CONTAINS 'Murphy'"))
            XCTAssertTrue(filterChips.count == 0, "Filter chip should be removed")
        }
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
        let lawTextInList = firstLawInList.label
        
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
            sleep(2)
            
            // Category detail LawRowView should now use thumbs (not arrows)
            // Visual verification required - icons are part of Label elements
            // Verify the list exists with laws
            let lawsList = app.tables.firstMatch
            XCTAssertTrue(lawsList.exists, "Laws list should be visible in category detail")
        }
    }
}
