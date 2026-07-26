//
//  SubmitLawViewTests.swift
//  MurphysLawsTests
//
//  Tests for submit-law view styling contracts
//

import XCTest

final class SubmitLawViewTests: XCTestCase {

    func testSubmittingOverlayUsesSemanticScrimToken() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("MurphysLaws/Views/Submit/SubmitLawView.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        XCTAssertTrue(
            source.contains("DS.Color.overlayScrim"),
            "Submitting overlay should use the stable semantic scrim token"
        )
        XCTAssertFalse(
            source.contains(".opacity("),
            "Submitting overlay opacity belongs in the shared color token"
        )
    }
}
