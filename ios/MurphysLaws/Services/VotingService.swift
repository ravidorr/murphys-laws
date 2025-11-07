//
//  VotingService.swift
//  MurphysLaws
//
//  Manages vote state (local + backend sync)
//

import Foundation

class VotingService: ObservableObject {
    static let shared = VotingService()

    @Published private(set) var votes: [Int: VoteType] = [:]

    private let apiService = APIService.shared

    private init() {
        loadVotes()
    }

    // MARK: - Load/Save to UserDefaults
    private func loadVotes() {
        if let data = UserDefaults.standard.data(forKey: Constants.Storage.votes),
           let decoded = try? JSONDecoder().decode([Int: VoteType].self, from: data) {
            votes = decoded
        }
    }

    private func saveVotes() {
        if let encoded = try? JSONEncoder().encode(votes) {
            UserDefaults.standard.set(encoded, forKey: Constants.Storage.votes)
        }
    }

    // MARK: - Get Vote
    func getVote(for lawID: Int) -> VoteType? {
        votes[lawID]
    }

    // MARK: - Vote Actions
    func vote(lawID: Int, voteType: VoteType) async throws {
        // Optimistic update on main thread
        let previousVote = await MainActor.run { votes[lawID] }
        await MainActor.run {
            votes[lawID] = voteType
            saveVotes()
        }

        do {
            // Sync with backend
            _ = try await apiService.voteLaw(id: lawID, voteType: voteType)
        } catch {
            // Rollback on error on main thread
            await MainActor.run {
                if let previous = previousVote {
                    votes[lawID] = previous
                } else {
                    votes.removeValue(forKey: lawID)
                }
                saveVotes()
            }
            throw error
        }
    }

    func removeVote(lawID: Int) async throws {
        // Optimistic update on main thread
        let previousVote = await MainActor.run { votes[lawID] }
        await MainActor.run {
            votes.removeValue(forKey: lawID)
            saveVotes()
        }

        do {
            // Sync with backend
            _ = try await apiService.removeVote(lawID: lawID)
        } catch {
            // Rollback on error on main thread
            await MainActor.run {
                if let previous = previousVote {
                    votes[lawID] = previous
                }
                saveVotes()
            }
            throw error
        }
    }

    func toggleVote(lawID: Int, voteType: VoteType) async throws {
        let currentVote = await MainActor.run { votes[lawID] }
        if let currentVote = currentVote {
            if currentVote == voteType {
                // Remove vote if clicking same button
                try await removeVote(lawID: lawID)
            } else {
                // Change vote type
                try await vote(lawID: lawID, voteType: voteType)
            }
        } else {
            // Add new vote
            try await vote(lawID: lawID, voteType: voteType)
        }
    }

    // MARK: - Bulk Operations
    @MainActor
    func clearAllVotes() {
        votes.removeAll()
        saveVotes()
    }
}
