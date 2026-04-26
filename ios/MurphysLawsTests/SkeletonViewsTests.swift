//
//  SkeletonViewsTests.swift
//  MurphysLawsTests
//
//  Tests for skeleton loading view styling contracts
//

import XCTest

final class SkeletonViewsTests: XCTestCase {

    func testSkeletonModifierHidesSourceContentUnderOverlay() throws {
        let sourceURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("MurphysLaws/Views/Home/SkeletonViews.swift")
        let source = try String(contentsOf: sourceURL, encoding: .utf8)

        XCTAssertTrue(
            source.contains("""
        content
            .hidden()
            .overlay(
"""),
            "Skeleton placeholders should hide their source shapes before drawing the shimmer overlay"
        )
    }
}
