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
        
        if let initialLaw = initialLaw {
            print("✅ LawDetailViewModel initialized with initial law: \(initialLaw.title ?? initialLaw.text)")
        } else {
            print("⚠️ LawDetailViewModel initialized without initial law, will fetch ID: \(lawID)")
        }
    }

    // MARK: - Load Law Detail
    func loadLaw() async {
        print("📥 LawDetailViewModel.loadLaw() starting for lawID: \(lawID)")
        isLoading = true
        error = nil

        do {
            print("🌐 Fetching law detail from repository...")
            law = try await lawRepository.fetchLawDetail(id: lawID)
            print("✅ Law loaded successfully: \(law?.title ?? law?.text ?? "unknown")")
            currentVote = votingService.getVote(for: lawID)
        } catch {
            self.error = error
            print("❌ Error loading law detail: \(error)")
            print("❌ Error localizedDescription: \(error.localizedDescription)")
        }

        isLoading = false
        print("📥 LawDetailViewModel.loadLaw() completed. isLoading=\(isLoading), law is nil: \(law == nil), error: \(error?.localizedDescription ?? "none")")
    }

    // MARK: - Voting
    func toggleVote(_ voteType: VoteType) async {
        guard !isVoting, let law = law else {
            print("⚠️ Cannot vote: isVoting=\(isVoting), law is nil=\(law == nil)")
            return
        }

        print("🗳️ Voting \(voteType.displayName) on law \(law.id)")
        isVoting = true
        
        let previousVote = currentVote

        do {
            try await votingService.toggleVote(lawID: law.id, voteType: voteType)
            currentVote = votingService.getVote(for: law.id)
            
            print("✅ Vote successful! New vote state: \(currentVote?.displayName ?? "none")")
            
            // Update vote counts optimistically
            self.law = updateVoteCounts(law: law, previousVote: previousVote, newVote: currentVote, clickedVote: voteType)

        } catch {
            // Only show error if vote didn't happen at all
            // (votingService keeps local vote even if backend fails)
            let finalVote = votingService.getVote(for: law.id)
            if finalVote != nil && finalVote != previousVote {
                // Vote succeeded locally even though backend failed
                print("⚠️ Vote saved locally but backend sync failed: \(error)")
                currentVote = finalVote
                self.law = updateVoteCounts(law: law, previousVote: previousVote, newVote: currentVote, clickedVote: voteType)
                // Don't set error - the vote worked from user's perspective
            } else {
                // Vote completely failed
                self.error = error
                print("❌ Error voting: \(error)")
                print("❌ Error details: \(error.localizedDescription)")
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
        
        print("📊 Vote counts updated: \(law.upvotes)→\(newUpvotes) up, \(law.downvotes)→\(newDownvotes) down")
        
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
