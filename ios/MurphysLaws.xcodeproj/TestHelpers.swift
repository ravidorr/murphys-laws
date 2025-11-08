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
    let mockCategories = generateMockCategories()
    
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
        ),
        Law(
            id: 4,
            text: "The moment you sit down to eat, someone will call you.",
            title: "Dinner Interruption Law",
            slug: "dinner-interruption",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 60,
            downvotes: 3,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: [mockCategories[2]]
        ),
        Law(
            id: 5,
            text: "The line you're in will always move slower than the others.",
            title: "Queue Theory",
            slug: "queue-theory",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 85,
            downvotes: 4,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: [mockCategories[3]]
        )
    ]
}

/// Generate mock categories for testing
func generateMockCategories() -> [Category] {
    return [
        Category(
            id: 1,
            title: "Work",
            slug: "work",
            description: "Laws about workplace and office life",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        Category(
            id: 2,
            title: "Technology",
            slug: "tech",
            description: "Laws about computers and technology",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        Category(
            id: 3,
            title: "Life",
            slug: "life",
            description: "General life observations",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        Category(
            id: 4,
            title: "Travel",
            slug: "travel",
            description: "Laws about travel and commuting",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    ]
}
#endif
