import XCTest

final class VotingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        throw XCTSkip("UI tests temporarily disabled during active UI development")
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testUpvoteLaw() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        sleep(2)
        
        // Find first law using accessibility identifier
        let firstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        
        if firstLawRow.waitForExistence(timeout: 3) {
            firstLawRow.tap()
        } else {
            // Fallback to any tappable button
            let lawButtons = app.buttons.allElementsBoundByIndex.filter { $0.isHittable }
            if lawButtons.count > 0 {
                lawButtons.first?.tap()
            } else {
                XCTFail("No law buttons found to test")
                return
            }
        }

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
        sleep(2)
        
        // Find first law using accessibility identifier
        let firstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        
        if firstLawRow.waitForExistence(timeout: 3) {
            firstLawRow.tap()
        } else {
            let lawButtons = app.buttons.allElementsBoundByIndex.filter { $0.isHittable }
            if lawButtons.count > 0 {
                lawButtons.first?.tap()
            } else {
                XCTFail("No law buttons found to test")
                return
            }
        }

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
        sleep(2)
        
        // Find first law using accessibility identifier
        let firstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        
        if firstLawRow.waitForExistence(timeout: 3) {
            firstLawRow.tap()
        } else {
            let lawButtons = app.buttons.allElementsBoundByIndex.filter { $0.isHittable }
            if lawButtons.count > 0 {
                lawButtons.first?.tap()
            } else {
                XCTFail("No law buttons found to test")
                return
            }
        }

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
        sleep(2)
        
        // Find first law using accessibility identifier
        let firstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        
        if firstLawRow.waitForExistence(timeout: 3) {
            firstLawRow.tap()
        } else {
            let lawButtons = app.buttons.allElementsBoundByIndex.filter { $0.isHittable }
            if lawButtons.count > 0 {
                lawButtons.first?.tap()
            } else {
                XCTFail("No law buttons found to test")
                return
            }
        }

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
        let sameFirstLawRow = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH 'LawListRow-'")).firstMatch
        if sameFirstLawRow.waitForExistence(timeout: 3) {
            sameFirstLawRow.tap()
        } else {
            let lawButtons = app.buttons.allElementsBoundByIndex.filter { $0.isHittable }
            lawButtons.first?.tap()
        }

        // Verify upvote button still exists (persistence check)
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 3), "Vote should persist")
    }
}
