//
//  VoteSynchronizationTests.swift
//  MurphysLawsTests
//
//  Tests for vote synchronization across views
//

import Testing
@testable import MurphysLaws

@Suite("Vote Synchronization Tests")
struct VoteSynchronizationTests {
    
    @Test("Law equality includes vote counts")
    func testLawEqualityWithVotes() {
        let law1 = Law(
            id: 1,
            text: "Test law",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 5,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law2 = Law(
            id: 1,
            text: "Test law",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 5,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law3 = Law(
            id: 1,
            text: "Test law",
            title: "Test",
            slug: "test",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 11,  // Different upvotes
            downvotes: 5,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        // Same vote counts should be equal
        #expect(law1 == law2, "Laws with same ID and votes should be equal")
        
        // Different vote counts should NOT be equal
        #expect(law1 != law3, "Laws with different vote counts should not be equal")
    }
    
    @Test("Law hash includes vote counts")
    func testLawHashWithVotes() {
        let law1 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 5,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law2 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,  // Different upvotes
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        // Different vote counts should produce different hashes
        #expect(law1.hashValue != law2.hashValue, "Laws with different votes should have different hashes")
    }
    
    @Test("Law in Set uses vote counts for uniqueness")
    func testLawSetUniqueness() {
        var laws = Set<Law>()
        
        let law1 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 5,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        laws.insert(law1)
        #expect(laws.count == 1)
        
        // Insert same law with same votes - should not increase count
        laws.insert(law1)
        #expect(laws.count == 1, "Duplicate law should not increase set count")
        
        // Insert same law with different votes - should increase count
        let law2 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,  // Different
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        laws.insert(law2)
        #expect(laws.count == 2, "Law with different votes should be treated as different")
    }
    
    @Test("Notification name is defined")
    func testVoteNotificationName() {
        let notificationName = Notification.Name.lawVotesDidChange
        #expect(notificationName.rawValue == "lawVotesDidChange")
    }
    
    @Test("VoteResponse has required fields")
    func testVoteResponseStructure() {
        // VoteResponse should have lawID, voteType, upvotes, downvotes
        // but NOT score (it's computed)
        
        let jsonData = """
        {
            "law_id": 123,
            "vote_type": "up",
            "upvotes": 10,
            "downvotes": 5
        }
        """.data(using: .utf8)!
        
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        
        do {
            let response = try decoder.decode(VoteResponse.self, from: jsonData)
            #expect(response.lawID == 123)
            #expect(response.voteType == "up")
            #expect(response.upvotes == 10)
            #expect(response.downvotes == 5)
            #expect(response.success == true)
        } catch {
            Issue.record("Failed to decode VoteResponse: \(error)")
        }
    }
}

@Suite("LawListViewModel Vote Update Tests")
struct LawListViewModelVoteUpdateTests {
    
    @Test("updateLawVotes updates specific law in list")
    @MainActor
    func testUpdateLawVotes() async {
        let viewModel = LawListViewModel()
        
        // Manually add some test laws
        viewModel.laws = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil,
                upvotes: 5, downvotes: 2, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil),
            Law(id: 2, text: "Law 2", title: nil, slug: nil, rawMarkdown: nil, originNote: nil,
                upvotes: 10, downvotes: 3, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil),
            Law(id: 3, text: "Law 3", title: nil, slug: nil, rawMarkdown: nil, originNote: nil,
                upvotes: 8, downvotes: 1, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]
        
        // Update law 2's votes
        viewModel.updateLawVotes(lawID: 2, upvotes: 15, downvotes: 4)
        
        // Verify law 2 was updated
        let updatedLaw = viewModel.laws.first { $0.id == 2 }
        #expect(updatedLaw != nil)
        #expect(updatedLaw?.upvotes == 15, "Upvotes should be updated")
        #expect(updatedLaw?.downvotes == 4, "Downvotes should be updated")
        
        // Verify other laws weren't changed
        let law1 = viewModel.laws.first { $0.id == 1 }
        #expect(law1?.upvotes == 5, "Law 1 upvotes should be unchanged")
        
        let law3 = viewModel.laws.first { $0.id == 3 }
        #expect(law3?.upvotes == 8, "Law 3 upvotes should be unchanged")
    }
    
    @Test("updateLawVotes handles non-existent law gracefully")
    @MainActor
    func testUpdateNonExistentLaw() async {
        let viewModel = LawListViewModel()
        
        viewModel.laws = [
            Law(id: 1, text: "Law 1", title: nil, slug: nil, rawMarkdown: nil, originNote: nil,
                upvotes: 5, downvotes: 2, createdAt: nil, updatedAt: nil, attributions: nil, categories: nil)
        ]
        
        // Update law that doesn't exist - should not crash
        viewModel.updateLawVotes(lawID: 999, upvotes: 10, downvotes: 5)
        
        // List should be unchanged
        #expect(viewModel.laws.count == 1)
        #expect(viewModel.laws[0].upvotes == 5)
    }
    
    @Test("updateLawVotes preserves law properties")
    @MainActor
    func testUpdatePreservesLawProperties() async {
        let viewModel = LawListViewModel()
        
        let originalLaw = Law(
            id: 1,
            text: "Original text",
            title: "Original title",
            slug: "original-slug",
            rawMarkdown: "# Original",
            originNote: "Note",
            upvotes: 5,
            downvotes: 2,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: nil
        )
        
        viewModel.laws = [originalLaw]
        
        // Update votes
        viewModel.updateLawVotes(lawID: 1, upvotes: 10, downvotes: 3)
        
        let updatedLaw = viewModel.laws[0]
        
        // Verify votes changed
        #expect(updatedLaw.upvotes == 10)
        #expect(updatedLaw.downvotes == 3)
        
        // Verify other properties preserved
        #expect(updatedLaw.text == "Original text")
        #expect(updatedLaw.title == "Original title")
        #expect(updatedLaw.slug == "original-slug")
        #expect(updatedLaw.rawMarkdown == "# Original")
        #expect(updatedLaw.originNote == "Note")
    }
}

@Suite("Vote Count Score Computation Tests")
struct VoteScoreComputationTests {
    
    @Test("Law score is computed from upvotes and downvotes")
    func testScoreComputation() {
        let law1 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,
            downvotes: 3,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        #expect(law1.score == 7, "Score should be upvotes - downvotes (10 - 3)")
    }
    
    @Test("Score computation handles negative scores")
    func testNegativeScore() {
        let law = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 3,
            downvotes: 10,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        #expect(law.score == -7, "Score should be negative when downvotes > upvotes")
    }
    
    @Test("Score computation handles zero votes")
    func testZeroScore() {
        let law = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 0,
            downvotes: 0,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        #expect(law.score == 0, "Score should be 0 when no votes")
    }
    
    @Test("Score updates when votes change")
    func testScoreUpdatesWithVotes() {
        let law1 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 5,
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        let law2 = Law(
            id: 1,
            text: "Test",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 10,  // Updated
            downvotes: 2,
            createdAt: nil,
            updatedAt: nil,
            attributions: nil,
            categories: nil
        )
        
        #expect(law1.score == 3, "Original score")
        #expect(law2.score == 8, "Updated score")
    }
}
