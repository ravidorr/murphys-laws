//
//  XCUIElementQuery+Extensions.swift
//  MurphysLawsUITests
//
//  Convenience extensions for UI testing
//

import XCTest

extension XCUIElementQuery {
    /// Find elements with identifier starting with the given prefix
    func matching(identifierPrefix prefix: String) -> XCUIElementQuery {
        return matching(NSPredicate(format: "identifier BEGINSWITH %@", prefix))
    }
    
    /// Find elements with identifier containing the given string
    func matching(identifierContaining substring: String) -> XCUIElementQuery {
        return matching(NSPredicate(format: "identifier CONTAINS %@", substring))
    }
    
    /// Get first hittable element (useful for fallbacks)
    var firstHittable: XCUIElement? {
        return allElementsBoundByIndex.first { $0.isHittable }
    }
}

extension XCUIApplication {
    /// Find law row by ID
    func lawRow(id: Int) -> XCUIElement {
        return buttons["LawListRow-\(id)"]
    }
    
    /// Find any law row
    func anyLawRow() -> XCUIElement {
        return buttons.matching(identifierPrefix: "LawListRow-").firstMatch
    }
    
    /// Find category card by ID
    func categoryCard(id: Int) -> XCUIElement {
        return buttons["CategoryCard-\(id)"]
    }
    
    /// Find any category card
    func anyCategoryCard() -> XCUIElement {
        return buttons.matching(identifierPrefix: "CategoryCard-").firstMatch
    }
    
    /// Find vote button
    func voteButton(_ type: VoteType) -> XCUIElement {
        return buttons[type == .upvote ? "Upvote" : "Downvote"]
    }
    
    /// Find slider by parameter name
    func parameterSlider(_ parameter: String) -> XCUIElement {
        return sliders["\(parameter) Slider"]
    }
    
    /// Wait for any law to appear with better error messaging
    @discardableResult
    func waitForLaws(timeout: TimeInterval = 5) -> Bool {
        let lawExists = anyLawRow().waitForExistence(timeout: timeout)
        if !lawExists {
            print("⚠️ No laws found after \(timeout) seconds")
        }
        return lawExists
    }
    
    /// Navigate to tab by name
    func navigateToTab(_ tabName: String) {
        tabBars.buttons[tabName].tap()
    }
}

/// Vote type enum for clarity
enum VoteType {
    case upvote
    case downvote
}
