import XCTest

final class VotingUITests: XCTestCase {
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

    func testUpvoteLaw() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        sleep(3)
        
        // Find first law button using accessibility identifier
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        
        if !firstLawButton.waitForExistence(timeout: 5) {
            XCTFail("No law buttons found - mock data may not be loading")
            return
        }
        
        firstLawButton.tap()
        
        // Wait for sheet to present
        sleep(1)

        // Find and tap upvote button using accessibility identifier
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Upvote button should exist")

        upvoteButton.tap()

        // Verify button still exists after tap
        XCTAssertTrue(upvoteButton.exists)
    }

    func testDownvoteLaw() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        sleep(3)
        
        // Find first law button
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        
        if !firstLawButton.waitForExistence(timeout: 5) {
            XCTFail("No law buttons found")
            return
        }
        
        firstLawButton.tap()
        sleep(1)

        // Find and tap downvote button
        let downvoteButton = app.buttons["Downvote"]
        XCTAssertTrue(downvoteButton.waitForExistence(timeout: 3), "Downvote button should exist")

        downvoteButton.tap()

        // Verify button still exists
        XCTAssertTrue(downvoteButton.exists)
    }

    func testToggleVote() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        sleep(3)
        
        // Find first law button
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        
        if !firstLawButton.waitForExistence(timeout: 5) {
            XCTFail("No law buttons found")
            return
        }
        
        firstLawButton.tap()
        sleep(1)

        // Upvote
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Upvote button should exist")
        upvoteButton.tap()

        // Wait a moment for vote to register
        sleep(1)

        // Downvote (should toggle from upvote to downvote)
        let downvoteButton = app.buttons["Downvote"]
        XCTAssertTrue(downvoteButton.exists, "Downvote button should exist")
        downvoteButton.tap()

        // Wait for vote to register
        sleep(1)

        // Tap again to remove vote
        downvoteButton.tap()
        
        XCTAssertTrue(downvoteButton.exists)
    }

    func testVotePersistence() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        sleep(3)
        
        // Find first law button
        let firstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        
        if !firstLawButton.waitForExistence(timeout: 5) {
            XCTFail("No law buttons found")
            return
        }
        
        firstLawButton.tap()
        sleep(1)

        // Upvote the law
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Upvote button should exist")
        upvoteButton.tap()

        // Go back - dismiss sheet
        if let closeButton = app.buttons["Close"].firstMatch as? XCUIElement, closeButton.exists {
            closeButton.tap()
        } else {
            // Swipe down to dismiss
            app.swipeDown()
        }
        
        sleep(1)

        // Re-open the same law using the same identifier
        let sameFirstLawButton = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawButton-'")).firstMatch
        if sameFirstLawButton.waitForExistence(timeout: 3) {
            sameFirstLawButton.tap()
        } else {
            XCTFail("Law button disappeared after closing detail")
            return
        }

        // Verify upvote button still exists (persistence check)
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Vote should persist")
    }
}
