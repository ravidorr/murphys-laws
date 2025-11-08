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

    init(lawID: Int) {
        self.lawID = lawID
        self.currentVote = votingService.getVote(for: lawID)
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
        guard !isVoting, let law = law else { return }

        isVoting = true

        do {
            try await votingService.toggleVote(lawID: law.id, voteType: voteType)
            currentVote = votingService.getVote(for: law.id)

            // Update vote counts optimistically
            if let updatedLaw = updateVoteCounts(law: law, voteType: voteType) {
                self.law = updatedLaw
            }

        } catch {
            self.error = error
            print("Error voting: \(error)")
        }

        isVoting = false
    }

    private func updateVoteCounts(law: Law, voteType: VoteType) -> Law? {
        // This is optimistic - actual counts come from backend
        // For now, just trigger a re-fetch
        Task {
            await loadLaw()
        }
        return nil
    }

    // MARK: - Refresh
    func refresh() async {
        await loadLaw()
    }
}
