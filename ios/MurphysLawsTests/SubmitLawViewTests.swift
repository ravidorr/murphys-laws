//
//  SubmitLawViewTests.swift
//  MurphysLawsTests
//
//  Tests for submit-law view styling contracts
//

import XCTest

final class SubmitLawViewTests: XCTestCase {

    func testSubmittingOverlayUsesStableBlackScrim() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("MurphysLaws/Views/Submit/SubmitLawView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        XCTAssertTrue(
            source.contains("Color.black.opacity(0.3)"),
            "Submitting overlay should dim in both light and dark mode with a stable black scrim"
        )
        XCTAssertFalse(
            source.contains("DS.Color.fg.opacity(0.3)"),
            "Adaptive foreground becomes near-white in dark mode and brightens the page"
        )
    }
}
