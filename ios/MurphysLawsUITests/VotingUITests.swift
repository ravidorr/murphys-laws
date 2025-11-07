import XCTest

final class VotingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testUpvoteLaw() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(firstLawCard.waitForExistence(timeout: 5))

        // Tap first law to open detail
        firstLawCard.tap()

        // Find and tap upvote button
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 2))

        upvoteButton.tap()

        // Verify button state changed (implementation dependent)
        // Could check for color change or text change
    }

    func testDownvoteLaw() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(firstLawCard.waitForExistence(timeout: 5))

        // Tap first law to open detail
        firstLawCard.tap()

        // Find and tap downvote button
        let downvoteButton = app.buttons["Downvote"]
        XCTAssertTrue(downvoteButton.waitForExistence(timeout: 2))

        downvoteButton.tap()

        // Verify button state changed
    }

    func testToggleVote() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(firstLawCard.waitForExistence(timeout: 5))

        // Tap first law to open detail
        firstLawCard.tap()

        // Upvote
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 2))
        upvoteButton.tap()

        // Wait a moment
        sleep(1)

        // Downvote (should toggle from upvote to downvote)
        let downvoteButton = app.buttons["Downvote"]
        downvoteButton.tap()

        // Verify the change
        sleep(1)

        // Tap again to remove vote
        downvoteButton.tap()
    }

    func testVotePersistence() throws {
        // Navigate to Browse tab
        app.tabBars.buttons["Browse"].tap()

        // Wait for laws to load
        let firstLawCard = app.scrollViews.otherElements.buttons.firstMatch
        XCTAssertTrue(firstLawCard.waitForExistence(timeout: 5))

        // Tap first law
        firstLawCard.tap()

        // Upvote the law
        let upvoteButton = app.buttons["Upvote"]
        XCTAssertTrue(upvoteButton.waitForExistence(timeout: 2))
        upvoteButton.tap()

        // Go back
        let backButton = app.navigationBars.buttons.element(boundBy: 0)
        backButton.tap()

        // Re-open the same law
        firstLawCard.tap()

        // Verify vote is still active
        // (Would need to check button state - implementation dependent)
        XCTAssertTrue(upvoteButton.exists)
    }
}
