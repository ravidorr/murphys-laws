//
//  ImprovedTestExample.swift
//  MurphysLawsUITests
//
//  Example of improved test patterns using the new infrastructure
//

import XCTest

final class ImprovedTestExample: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-TESTING"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - Example: Improved Test Patterns
    
    /// Example showing cleaner test with helper extensions
    func exampleImprovedUpvoteTest() throws {
        // Navigate using helper
        app.navigateToTab("Browse")
        
        // Wait for laws with better feedback
        XCTAssertTrue(app.waitForLaws(), "Laws should load in UI testing mode")
        
        // Find and tap law using helper
        let firstLaw = app.anyLawRow()
        XCTAssertTrue(firstLaw.exists, "At least one law should exist")
        firstLaw.tap()
        
        // Find vote button using helper
        let upvoteButton = app.voteButton(.upvote)
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Upvote button should appear in detail view")
        
        upvoteButton.tap()
        
        // Verify
        XCTAssertTrue(upvoteButton.exists)
    }
    
    /// Example showing specific law targeting
    func exampleTargetSpecificLaw() throws {
        app.navigateToTab("Browse")
        app.waitForLaws()
        
        // Target specific law by ID
        let murphysLaw = app.lawRow(id: 1)
        if murphysLaw.waitForExistence(timeout: 2) {
            murphysLaw.tap()
        } else {
            // Fallback to any law
            app.anyLawRow().tap()
        }
        
        app.voteButton(.downvote).tap()
    }
    
    /// Example showing category filtering
    func exampleCategoryTest() throws {
        app.navigateToTab("Categories")
        
        // Wait for categories
        let category = app.anyCategoryCard()
        XCTAssertTrue(category.waitForExistence(timeout: 3))
        
        category.tap()
        
        // Could also target specific category
        // app.categoryCard(id: 1).tap()
    }
    
    /// Example showing calculator interaction
    func exampleCalculatorTest() throws {
        app.navigateToTab("Calculator")
        
        // Interact with sliders using helpers
        let urgencySlider = app.parameterSlider("Urgency")
        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))
        
        urgencySlider.adjust(toNormalizedSliderPosition: 1.0)
        app.parameterSlider("Complexity").adjust(toNormalizedSliderPosition: 1.0)
        app.parameterSlider("Importance").adjust(toNormalizedSliderPosition: 1.0)
        
        // Verify result exists
        let percentageLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS '%'")).firstMatch
        XCTAssertTrue(percentageLabel.exists)
    }
    
    /// Example showing robust element finding
    func exampleRobustElementFinding() throws {
        app.navigateToTab("Browse")
        
        // Multiple strategies with helpers
        let lawRow: XCUIElement
        
        // Strategy 1: Find specific law
        if app.lawRow(id: 1).waitForExistence(timeout: 2) {
            lawRow = app.lawRow(id: 1)
        }
        // Strategy 2: Find any law
        else if app.anyLawRow().waitForExistence(timeout: 2) {
            lawRow = app.anyLawRow()
        }
        // Strategy 3: Fallback to first hittable button
        else if let hittable = app.buttons.firstHittable {
            lawRow = hittable
        }
        else {
            XCTFail("No law rows found with any strategy")
            return
        }
        
        lawRow.tap()
    }
    
    /// Example showing search functionality
    func exampleSearchTest() throws {
        app.navigateToTab("Browse")
        
        let searchField = app.searchFields.firstMatch
        XCTAssertTrue(searchField.waitForExistence(timeout: 2))
        
        searchField.tap()
        searchField.typeText("Murphy")
        
        // Wait for results to filter
        sleep(1)
        
        // Verify we can still find laws
        XCTAssertTrue(app.anyLawRow().waitForExistence(timeout: 2) || app.waitForLaws())
    }
}
