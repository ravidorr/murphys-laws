//
//  VoteSyncTests.swift
//  MurphysLawsTests
//
//  Tests for vote synchronization via NotificationCenter
//

import Testing
import Combine
@testable import MurphysLaws

@Suite("Vote Synchronization Tests")
struct VoteSyncTests {
    
    @Test("Notification name is defined correctly")
    func testNotificationName() {
        let name = Notification.Name.lawVotesDidChange
        #expect(name.rawValue == "lawVotesDidChange")
    }
    
    @Test("Law equality includes vote counts")
    func testLawEqualityWithVotes() {
        let law1 = Law(
            id: 1,
            text: "Test",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law2 = Law(
            id: 1,
            text: "Test",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law3 = Law(
            id: 1,
            text: "Test",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 15,  // Different vote count
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        // Same vote counts should be equal
        #expect(law1 == law2)
        
        // Different vote counts should NOT be equal
        #expect(law1 != law3)
    }
    
    @Test("Law hash includes vote counts")
    func testLawHashWithVotes() {
        let law1 = Law(
            id: 1,
            text: "Test",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law2 = Law(
            id: 1,
            text: "Test",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 15,  // Different vote count
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        // Laws with different vote counts should have different hashes
        #expect(law1.hashValue != law2.hashValue)
    }
    
    @Test("Vote response handles optional vote type")
    func testVoteResponseOptionalVoteType() {
        // Test with voteType present (vote operation)
        let jsonWithVoteType = """
        {
            "law_id": 42,
            "vote_type": "up",
            "upvotes": 10,
            "downvotes": 2
        }
        """.data(using: .utf8)!
        
        let responseWithType = try? JSONDecoder().decode(VoteResponse.self, from: jsonWithVoteType)
        #expect(responseWithType != nil)
        #expect(responseWithType?.voteType == "up")
        #expect(responseWithType?.upvotes == 10)
        
        // Test without voteType (remove vote operation)
        let jsonWithoutVoteType = """
        {
            "law_id": 42,
            "upvotes": 8,
            "downvotes": 2
        }
        """.data(using: .utf8)!
        
        let responseWithoutType = try? JSONDecoder().decode(VoteResponse.self, from: jsonWithoutVoteType)
        #expect(responseWithoutType != nil)
        #expect(responseWithoutType?.voteType == nil)
        #expect(responseWithoutType?.upvotes == 8)
    }
}

@Suite("Law Update ViewModel Tests")
@MainActor
struct LawUpdateViewModelTests {
    
    @Test("updateLawVotes updates correct law in list")
    func testUpdateLawVotesFindsAndUpdates() async {
        let viewModel = LawListViewModel()
        
        // Create test laws
        let law1 = Law(id: 1, text: "Law 1", title: "One", slug: "one", 
                      rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1,
                      createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        let law2 = Law(id: 2, text: "Law 2", title: "Two", slug: "two",
                      rawMarkdown: nil, originNote: nil, upvotes: 10, downvotes: 2,
                      createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        
        // Manually set laws (simulating loaded state)
        viewModel.laws = [law1, law2]
        
        // Update votes for law 2
        viewModel.updateLawVotes(lawID: 2, upvotes: 15, downvotes: 3)
        
        // Verify law 2 was updated
        let updatedLaw = viewModel.laws.first { $0.id == 2 }
        #expect(updatedLaw?.upvotes == 15)
        #expect(updatedLaw?.downvotes == 3)
        
        // Verify law 1 was NOT updated
        let unchangedLaw = viewModel.laws.first { $0.id == 1 }
        #expect(unchangedLaw?.upvotes == 5)
        #expect(unchangedLaw?.downvotes == 1)
    }
    
    @Test("updateLawVotes handles law not in list")
    func testUpdateLawVotesNotFound() async {
        let viewModel = LawListViewModel()
        
        let law1 = Law(id: 1, text: "Law 1", title: "One", slug: "one",
                      rawMarkdown: nil, originNote: nil, upvotes: 5, downvotes: 1,
                      createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        
        viewModel.laws = [law1]
        
        // Try to update law that doesn't exist
        viewModel.updateLawVotes(lawID: 999, upvotes: 100, downvotes: 50)
        
        // Original law should be unchanged
        #expect(viewModel.laws.count == 1)
        #expect(viewModel.laws[0].upvotes == 5)
    }
}
