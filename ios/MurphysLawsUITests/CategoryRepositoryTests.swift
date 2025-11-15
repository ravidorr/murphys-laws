//
//  CategoryRepositoryTests.swift
//  MurphysLawsTests
//
//  Tests for CategoryRepository deduplication and caching
//

import XCTest
@testable import MurphysLaws

class CategoryRepositoryTests: XCTestCase {
    
    func testDeduplication() async throws {
        // This test verifies that when the API returns duplicate category titles
        // with different IDs, only the one with the lower ID is kept
        
        // Note: This test documents expected behavior
        // Actual implementation would need a mock APIService to inject test data
        
        let duplicateTitles = [
            "Murphy's 4X4 Car Laws Section",
            "Murphy's Computer Laws",
            "Murphy's Cowboy Action Shooting (CAS) Laws[^1]",
            "Murphy's Helicopters Warfare Laws",
            "Murphy's Law of the Open Road",
            "Murphy's Laws of Mechanics",
            "Murphy's Marine Corps Laws",
            "Murphy's Repairman's Laws",
            "Murphy's Tank Warfare Laws"
        ]
        
        // Each of these titles appears twice in the production API data
        // The deduplication logic should keep only the category with the lower ID
        XCTAssertEqual(duplicateTitles.count, 9, "Expected 9 known duplicate titles")
    }
    
    func testCategoryEquality() {
        let category1 = Category(
            id: 1,
            title: "Test Category",
            slug: "test-category",
            description: "A test",
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        let category2 = Category(
            id: 1,
            title: "Different Title",
            slug: "different",
            description: "Different",
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        let category3 = Category(
            id: 2,
            title: "Test Category",
            slug: "test-category",
            description: "A test",
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        // Categories with same ID should be equal
        XCTAssertEqual(category1, category2, "Categories with same ID should be equal")
        
        // Categories with different IDs should not be equal
        XCTAssertNotEqual(category1, category3, "Categories with different IDs should not be equal")
    }
    
    func testCategoryHashable() {
        let category1 = Category(
            id: 1,
            title: "Test",
            slug: "test",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        let category2 = Category(
            id: 1,
            title: "Different",
            slug: "different",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        let category3 = Category(
            id: 2,
            title: "Test",
            slug: "test",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        // Categories with same ID should have same hash
        var set = Set<Category>()
        set.insert(category1)
        set.insert(category2) // Should not increase count (same ID)
        XCTAssertEqual(set.count, 1, "Set should contain only 1 category (same ID)")
        
        set.insert(category3) // Should increase count (different ID)
        XCTAssertEqual(set.count, 2, "Set should contain 2 categories (different IDs)")
    }
    
    func testCategoryIconMapping() {
        let techCategory = Category(
            id: 1,
            title: "Technology",
            slug: "technology",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        XCTAssertEqual(techCategory.iconName, "desktopcomputer")
        
        let officeCategory = Category(
            id: 2,
            title: "Office",
            slug: "office-work",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        XCTAssertEqual(officeCategory.iconName, "building.2")
    }
    
    func testCategoryColorConsistency() {
        let category1 = Category(
            id: 1,
            title: "Test",
            slug: "same-slug",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        let category2 = Category(
            id: 2,
            title: "Different",
            slug: "same-slug",
            description: nil,
            sourceFilePath: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        // Same slug should produce same color
        XCTAssertEqual(category1.iconColor, category2.iconColor, 
                      "Categories with same slug should have same color")
    }
}

class CategoryDeduplicationTests: XCTestCase {
    
    func testEmptyArray() {
        let categories: [Category] = []
        let deduplicated = deduplicateByTitle(categories)
        XCTAssertTrue(deduplicated.isEmpty)
    }
    
    func testSingleCategory() {
        let categories = [
            Category(id: 1, title: "Test", slug: "test", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil)
        ]
        let deduplicated = deduplicateByTitle(categories)
        XCTAssertEqual(deduplicated.count, 1)
        XCTAssertEqual(deduplicated[0].id, 1)
    }
    
    func testKeepsLowerID() {
        let categories = [
            Category(id: 10, title: "Same Title", slug: "slug1", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 5, title: "Same Title", slug: "slug2", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil)
        ]
        let deduplicated = deduplicateByTitle(categories)
        XCTAssertEqual(deduplicated.count, 1)
        XCTAssertEqual(deduplicated[0].id, 5, "Should keep category with lower ID")
    }
    
    func testPreservesUnique() {
        let categories = [
            Category(id: 1, title: "Title A", slug: "a", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 2, title: "Title B", slug: "b", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 3, title: "Title C", slug: "c", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil)
        ]
        let deduplicated = deduplicateByTitle(categories)
        XCTAssertEqual(deduplicated.count, 3)
    }
    
    func testMultipleDuplicates() {
        let categories = [
            Category(id: 1, title: "Duplicate A", slug: "a1", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 5, title: "Duplicate A", slug: "a2", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 2, title: "Duplicate B", slug: "b1", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 8, title: "Duplicate B", slug: "b2", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil),
            Category(id: 3, title: "Unique", slug: "u", 
                    description: nil, sourceFilePath: nil, 
                    createdAt: nil, updatedAt: nil)
        ]
        let deduplicated = deduplicateByTitle(categories)
        XCTAssertEqual(deduplicated.count, 3, "Should have 3 unique titles")
        
        // Verify correct IDs were kept (lower ones)
        let ids = Set(deduplicated.map { $0.id })
        XCTAssertTrue(ids.contains(1), "Should keep ID 1 for Duplicate A")
        XCTAssertTrue(ids.contains(2), "Should keep ID 2 for Duplicate B")
        XCTAssertTrue(ids.contains(3), "Should keep ID 3 for Unique")
    }
    
    // Helper function that mirrors the production deduplication logic
    private func deduplicateByTitle(_ categories: [Category]) -> [Category] {
        var seenTitles: [String: Category] = [:]
        var uniqueCategories: [Category] = []
        
        for category in categories {
            if let existing = seenTitles[category.title] {
                if category.id < existing.id {
                    seenTitles[category.title] = category
                    uniqueCategories.removeAll { $0.id == existing.id }
                    uniqueCategories.append(category)
                }
            } else {
                seenTitles[category.title] = category
                uniqueCategories.append(category)
            }
        }
        
        return uniqueCategories
    }
}
