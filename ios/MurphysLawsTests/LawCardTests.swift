//
//  LawCardTests.swift
//  MurphysLawsTests
//
//  Tests for reusable law card styling contracts
//

import XCTest

final class LawCardTests: XCTestCase {

    func testLawCardFooterUsesShareActionInsteadOfCategoryPill() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("MurphysLaws/Views/Shared/LawCard.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        XCTAssertTrue(
            source.contains("ShareLink(item: law.shareText)"),
            "Law cards should expose sharing from the footer row"
        )
        XCTAssertTrue(
            source.contains(".frame(maxHeight: .infinity, alignment: .top)"),
            "Law card contents should stay top-aligned when cards share a row height"
        )
        XCTAssertFalse(
            source.contains("if let firstCategory = law.categories?.first"),
            "Law cards should not reserve the footer trailing slot for a category pill"
        )
    }
}
