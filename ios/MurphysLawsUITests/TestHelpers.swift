//
//  TestHelpers.swift
//  MurphysLaws
//
//  Test utilities and mock data
//

import Foundation

#if DEBUG
/// Check if app is running in UI test mode
var isUITesting: Bool {
    ProcessInfo.processInfo.arguments.contains("UI-TESTING")
}

/// Generate mock laws for testing
func generateMockLaws() -> [Law] {
    let mockCategories = [
        Category(id: 1, title: "Work", slug: "work", iconName: "briefcase", colorHex: "#007AFF", lawCount: 10),
        Category(id: 2, title: "Technology", slug: "tech", iconName: "laptopcomputer", colorHex: "#FF9500", lawCount: 8)
    ]
    
    return [
        Law(
            id: 1,
            text: "Anything that can go wrong will go wrong.",
            title: "Murphy's Law",
            slug: "murphys-law",
            rawMarkdown: nil,
            originNote: "Classic Murphy's Law",
            upvotes: 100,
            downvotes: 5,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: [mockCategories[0]]
        ),
        Law(
            id: 2,
            text: "The severity of an error is directly proportional to the importance of the presentation.",
            title: "Demo Effect",
            slug: "demo-effect",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 50,
            downvotes: 2,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: [mockCategories[1]]
        ),
        Law(
            id: 3,
            text: "When you're at work, you want to be at home. When you're at home, you can't stop thinking about work.",
            title: "Work-Life Paradox",
            slug: "work-life",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 75,
            downvotes: 10,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: [mockCategories[0]]
        )
    ]
}

/// Generate mock categories for testing
func generateMockCategories() -> [Category] {
    return [
        Category(id: 1, title: "Work", slug: "work", iconName: "briefcase", colorHex: "#007AFF", lawCount: 10),
        Category(id: 2, title: "Technology", slug: "tech", iconName: "laptopcomputer", colorHex: "#FF9500", lawCount: 8),
        Category(id: 3, title: "Life", slug: "life", iconName: "heart", colorHex: "#FF3B30", lawCount: 15),
        Category(id: 4, title: "Science", slug: "science", iconName: "flask", colorHex: "#5856D6", lawCount: 12)
    ]
}
#endif
