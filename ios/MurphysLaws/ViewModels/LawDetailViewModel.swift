//
//  LawDetailViewModel.swift
//  MurphysLaws
//
//  ViewModel for law detail view
//

import Foundation

@MainActor
class LawDetailViewModel: ObservableObject {
    @Published var law: Law?
    @Published var isLoading = false
    @Published var error: Error?
    @Published var currentVote: VoteType?
    @Published var isVoting = false

    private let lawRepository = LawRepository()
    private let votingService = VotingService.shared

    var lawID: Int

    init(lawID: Int, initialLaw: Law? = nil) {
        self.lawID = lawID
        self.law = initialLaw  // Use the law we already have
        self.currentVote = votingService.getVote(for: lawID)
    }

    // MARK: - Load Law Detail
    func loadLaw() async {
        isLoading = true
        error = nil

        do {
            law = try await lawRepository.fetchLawDetail(id: lawID)
            currentVote = votingService.getVote(for: lawID)
        } catch {
            self.error = error
        }

        isLoading = false
    }

    // MARK: - Voting
    func toggleVote(_ voteType: VoteType) async {
        guard !isVoting, let law = law else {
            return
        }

        isVoting = true
        
        let previousVote = currentVote

        do {
            try await votingService.toggleVote(lawID: law.id, voteType: voteType)
            currentVote = votingService.getVote(for: law.id)
            
            // Update vote counts optimistically
            self.law = updateVoteCounts(law: law, previousVote: previousVote, newVote: currentVote, clickedVote: voteType)

        } catch {
            // Only show error if vote didn't happen at all
            // (votingService keeps local vote even if backend fails)
            let finalVote = votingService.getVote(for: law.id)
            if finalVote != nil && finalVote != previousVote {
                // Vote succeeded locally even though backend failed
                currentVote = finalVote
                self.law = updateVoteCounts(law: law, previousVote: previousVote, newVote: currentVote, clickedVote: voteType)
                // Don't set error - the vote worked from user's perspective
            } else {
                // Vote completely failed
                self.error = error
            }
        }

        isVoting = false
    }

    private func updateVoteCounts(law: Law, previousVote: VoteType?, newVote: VoteType?, clickedVote: VoteType) -> Law {
        var newUpvotes = law.upvotes
        var newDownvotes = law.downvotes
        
        // Remove previous vote if exists
        if let prev = previousVote {
            if prev == .up {
                newUpvotes = max(0, newUpvotes - 1)
            } else {
                newDownvotes = max(0, newDownvotes - 1)
            }
        }
        
        // Add new vote if exists
        if let new = newVote {
            if new == .up {
                newUpvotes += 1
            } else {
                newDownvotes += 1
            }
        }
        
        // Create updated law with new vote counts
        return Law(
            id: law.id,
            text: law.text,
            title: law.title,
            slug: law.slug,
            rawMarkdown: law.rawMarkdown,
            originNote: law.originNote,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
            createdAt: law.createdAt,
            updatedAt: law.updatedAt,
            attributions: law.attributions,
            categories: law.categories
        )
    }

    // MARK: - Refresh
    func refresh() async {
        await loadLaw()
    }
}
