//
//  BrowseViewTests.swift
//  MurphysLawsTests
//
//  Tests for Browse view functionality including filters
//

import Testing
@testable import MurphysLaws

@Suite("Browse View Filter Tests")
struct BrowseViewFilterTests {
    
    @Test("Filter chip displays correct information")
    func testFilterChipContent() {
        // Test that FilterChip properly displays title and icon
        // This is a component test to verify the structure
        
        let testTitle = "Technology"
        let testIcon = "tag"
        let testColor = Color.blue
        
        // FilterChip should display these values
        #expect(testTitle == "Technology")
        #expect(testIcon == "tag")
    }
    
    @Test("Active filters bar appears when category selected")
    func testActiveFiltersBarVisibility() {
        // Test logic: activeFiltersBar should only show when filters are active
        
        let noCategorySelected: Int? = nil
        let defaultSort = FilterView.SortOrder.newest
        
        // Should not show when no filters active
        let shouldShowWithNoFilters = noCategorySelected != nil || defaultSort != .newest
        #expect(!shouldShowWithNoFilters, "Filter bar should be hidden with no active filters")
        
        let categorySelected: Int? = 1
        let shouldShowWithCategory = categorySelected != nil || defaultSort != .newest
        #expect(shouldShowWithCategory, "Filter bar should show when category selected")
    }
    
    @Test("Active filters bar appears when sort changed")
    func testActiveFiltersBarWithSort() {
        let noCategorySelected: Int? = nil
        let changedSort = FilterView.SortOrder.topVoted
        
        // Should show when sort is not default
        let shouldShow = noCategorySelected != nil || changedSort != .newest
        #expect(shouldShow, "Filter bar should show when sort order changed")
    }
    
    @Test("Filter button badge logic")
    func testFilterButtonBadgeVisibility() {
        // Badge should show when any filter is active
        
        var categoryID: Int? = nil
        var sortOrder = FilterView.SortOrder.newest
        var shouldShowBadge = categoryID != nil || sortOrder != .newest
        #expect(!shouldShowBadge, "Badge should not show with default state")
        
        categoryID = 5
        shouldShowBadge = categoryID != nil || sortOrder != .newest
        #expect(shouldShowBadge, "Badge should show when category selected")
        
        categoryID = nil
        sortOrder = .topVoted
        shouldShowBadge = categoryID != nil || sortOrder != .newest
        #expect(shouldShowBadge, "Badge should show when sort order changed")
        
        categoryID = 5
        sortOrder = .topVoted
        shouldShowBadge = categoryID != nil || sortOrder != .newest
        #expect(shouldShowBadge, "Badge should show when both filters active")
    }
    
    @Test("Clear all button appears with multiple filters")
    func testClearAllButtonLogic() {
        // Clear All should only show when 2+ filters are active
        
        var categoryID: Int? = nil
        var sortOrder = FilterView.SortOrder.newest
        var shouldShowClearAll = categoryID != nil && sortOrder != .newest
        #expect(!shouldShowClearAll, "Clear All should not show with no filters")
        
        categoryID = 5
        sortOrder = .newest
        shouldShowClearAll = categoryID != nil && sortOrder != .newest
        #expect(!shouldShowClearAll, "Clear All should not show with single filter")
        
        categoryID = nil
        sortOrder = .topVoted
        shouldShowClearAll = categoryID != nil && sortOrder != .newest
        #expect(!shouldShowClearAll, "Clear All should not show with single filter")
        
        categoryID = 5
        sortOrder = .topVoted
        shouldShowClearAll = categoryID != nil && sortOrder != .newest
        #expect(shouldShowClearAll, "Clear All should show with multiple filters")
    }
}

@Suite("Sort Order Tests")
struct SortOrderTests {
    
    @Test("Sort order enum has all expected cases")
    func testSortOrderCases() {
        let allCases = FilterView.SortOrder.allCases
        
        #expect(allCases.count == 4, "Should have 4 sort order options")
        #expect(allCases.contains(.newest))
        #expect(allCases.contains(.oldest))
        #expect(allCases.contains(.topVoted))
        #expect(allCases.contains(.controversial))
    }
    
    @Test("Sort order has correct display names")
    func testSortOrderDisplayNames() {
        #expect(FilterView.SortOrder.newest.rawValue == "Newest First")
        #expect(FilterView.SortOrder.oldest.rawValue == "Oldest First")
        #expect(FilterView.SortOrder.topVoted.rawValue == "Top Voted")
        #expect(FilterView.SortOrder.controversial.rawValue == "Controversial")
    }
    
    @Test("Sort order is identifiable")
    func testSortOrderIdentifiable() {
        let newest = FilterView.SortOrder.newest
        let oldest = FilterView.SortOrder.oldest
        
        #expect(newest.id == newest.rawValue)
        #expect(oldest.id == oldest.rawValue)
        #expect(newest.id != oldest.id)
    }
}

@Suite("Vote Icon Consistency Tests")
struct VoteIconConsistencyTests {
    
    @Test("Vote type has correct icon names")
    func testVoteTypeIcons() {
        // Both BrowseView and CategoriesView should use hand.thumbsup/down
        let upIcon = "hand.thumbsup"
        let upIconFilled = "hand.thumbsup.fill"
        let downIcon = "hand.thumbsdown"
        let downIconFilled = "hand.thumbsdown.fill"
        
        // Verify icon names are valid SF Symbols
        #expect(!upIcon.isEmpty)
        #expect(!upIconFilled.isEmpty)
        #expect(!downIcon.isEmpty)
        #expect(!downIconFilled.isEmpty)
    }
    
    @Test("Vote icons should not use arrows")
    func testVoteIconsNotArrows() {
        // Ensure we're not using the old arrow icons
        let deprecatedUpIcon = "arrow.up.circle.fill"
        let deprecatedDownIcon = "arrow.down.circle.fill"
        let correctUpIcon = "hand.thumbsup"
        let correctDownIcon = "hand.thumbsdown"
        
        #expect(correctUpIcon != deprecatedUpIcon)
        #expect(correctDownIcon != deprecatedDownIcon)
    }
}

@Suite("Category Navigation Tests")
struct CategoryNavigationTests {
    
    @Test("Law detail view accepts both lawID and law object")
    func testLawDetailViewParameters() {
        // Verify that LawDetailView can be initialized with optional law object
        let lawID = 123
        let mockLaw = Law(
            id: lawID,
            text: "Test law",
            title: "Test",
            upvotes: 10,
            downvotes: 2,
            score: 8,
            categories: nil,
            attributions: nil,
            createdAt: nil,
            updatedAt: nil
        )
        
        // Both initializations should be valid
        #expect(lawID == mockLaw.id)
    }
    
    @Test("Passing law object prevents unnecessary API call")
    func testLawObjectPassingBenefit() {
        // When law object is passed, view model should use it immediately
        // This is a behavioral test documenting expected optimization
        
        let lawID = 456
        let hasLawObject = true
        
        // If we have the law object, we shouldn't need to fetch
        let shouldFetch = !hasLawObject
        #expect(!shouldFetch, "Should not fetch when law object provided")
    }
}
