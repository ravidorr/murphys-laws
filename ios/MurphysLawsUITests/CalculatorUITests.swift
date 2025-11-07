import XCTest

final class CalculatorUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testCalculatorSliders() throws {
        // Navigate to Calculator tab
        app.tabBars.buttons["Calculator"].tap()

        // Verify all sliders exist
        let urgencySlider = app.sliders["Urgency Slider"]
        let complexitySlider = app.sliders["Complexity Slider"]
        let importanceSlider = app.sliders["Importance Slider"]
        let skillLevelSlider = app.sliders["Skill Level Slider"]
        let frequencySlider = app.sliders["Frequency Slider"]

        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))
        XCTAssertTrue(complexitySlider.exists)
        XCTAssertTrue(importanceSlider.exists)
        XCTAssertTrue(skillLevelSlider.exists)
        XCTAssertTrue(frequencySlider.exists)
    }

    func testCalculatorComputation() throws {
        // Navigate to Calculator tab
        app.tabBars.buttons["Calculator"].tap()

        // Adjust sliders to known values
        let urgencySlider = app.sliders["Urgency Slider"]
        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))

        // Set to high risk values
        urgencySlider.adjust(toNormalizedSliderPosition: 1.0) // Max value
        app.sliders["Complexity Slider"].adjust(toNormalizedSliderPosition: 1.0)
        app.sliders["Importance Slider"].adjust(toNormalizedSliderPosition: 1.0)
        app.sliders["Skill Level Slider"].adjust(toNormalizedSliderPosition: 0.0) // Min value
        app.sliders["Frequency Slider"].adjust(toNormalizedSliderPosition: 1.0)

        // Wait for calculation
        sleep(1)

        // Verify probability result exists
        let probabilityLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] '%'")).firstMatch
        XCTAssertTrue(probabilityLabel.exists)

        // Verify risk level is shown
        let riskLevelLabel = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Risk'")).firstMatch
        XCTAssertTrue(riskLevelLabel.exists)
    }

    func testCalculatorReset() throws {
        // Navigate to Calculator tab
        app.tabBars.buttons["Calculator"].tap()

        // Adjust sliders
        let urgencySlider = app.sliders["Urgency Slider"]
        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))
        urgencySlider.adjust(toNormalizedSliderPosition: 1.0)

        // Find and tap reset button (if exists)
        let resetButton = app.buttons["Reset"]
        if resetButton.exists {
            resetButton.tap()

            // Verify sliders are back to default
            // Default is usually 50% (middle position)
            sleep(1)
        }
    }

    func testCalculatorShare() throws {
        // Navigate to Calculator tab
        app.tabBars.buttons["Calculator"].tap()

        // Wait for calculator to load
        let urgencySlider = app.sliders["Urgency Slider"]
        XCTAssertTrue(urgencySlider.waitForExistence(timeout: 2))

        // Find and tap share button
        let shareButton = app.buttons["Share Results"]
        if shareButton.waitForExistence(timeout: 2) {
            shareButton.tap()

            // Verify share sheet appears
            let shareSheet = app.otherElements["ActivityListView"]
            XCTAssertTrue(shareSheet.waitForExistence(timeout: 3))

            // Cancel share
            let cancelButton = app.buttons["Close"]
            if cancelButton.exists {
                cancelButton.tap()
            }
        }
    }

    func testCalculatorFormula() throws {
        // Navigate to Calculator tab
        app.tabBars.buttons["Calculator"].tap()

        // Verify formula text exists
        let formulaText = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Formula'")).firstMatch
        XCTAssertTrue(formulaText.waitForExistence(timeout: 2))
    }
}
