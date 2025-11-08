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
        print("📥 VotingService.vote - lawID: \(lawID), type: \(voteType.displayName)")
        
        // Optimistic update on main thread
        let previousVote = await MainActor.run { votes[lawID] }
        await MainActor.run {
            votes[lawID] = voteType
            saveVotes()
        }
        
        print("💾 Local vote saved")

        do {
            // Sync with backend
            print("🌐 Syncing vote with backend...")
            let response = try await apiService.voteLaw(id: lawID, voteType: voteType)
            print("✅ Backend sync successful - upvotes: \(response.upvotes), downvotes: \(response.downvotes)")
        } catch {
            print("❌ Backend sync failed: \(error.localizedDescription)")
            
            // Check if it's a network error vs a real error
            if let urlError = error as? URLError {
                // Network errors - keep the vote locally, will sync later
                print("🌐 Network error - keeping vote locally for future sync")
                // Don't rollback for network issues
                return
            }
            
            // For other errors (like 401, 403, etc), rollback
            print("⏪ Rolling back due to non-network error")
            // Rollback on error on main thread
            await MainActor.run {
                if let previous = previousVote {
                    votes[lawID] = previous
                } else {
                    votes.removeValue(forKey: lawID)
                }
                saveVotes()
            }
            print("⏪ Vote rolled back")
            throw error
        }
    }

    func removeVote(lawID: Int) async throws {
        print("🗑️ VotingService.removeVote - lawID: \(lawID)")
        
        // Optimistic update on main thread
        let previousVote = await MainActor.run { votes[lawID] }
        await MainActor.run {
            votes.removeValue(forKey: lawID)
            saveVotes()
        }
        
        print("💾 Local vote removed")

        do {
            // Sync with backend
            print("🌐 Syncing vote removal with backend...")
            _ = try await apiService.removeVote(lawID: lawID)
            print("✅ Backend sync successful")
        } catch {
            print("❌ Backend sync failed: \(error.localizedDescription)")
            
            // Check if it's a network error vs a real error
            if let urlError = error as? URLError {
                // Network errors - keep the removal locally, will sync later
                print("🌐 Network error - keeping removal locally for future sync")
                // Don't rollback for network issues
                return
            }
            
            // For other errors (like 401, 403, etc), rollback
            print("⏪ Rolling back due to non-network error")
            // Rollback on error on main thread
            await MainActor.run {
                if let previous = previousVote {
                    votes[lawID] = previous
                }
                saveVotes()
            }
            print("⏪ Vote removal rolled back")
            throw error
        }
    }

    func toggleVote(lawID: Int, voteType: VoteType) async throws {
        let currentVote = await MainActor.run { votes[lawID] }
        print("🗳️ VotingService.toggleVote - lawID: \(lawID), requested: \(voteType.displayName), current: \(currentVote?.displayName ?? "none")")
        
        if let currentVote = currentVote {
            if currentVote == voteType {
                // Remove vote if clicking same button
                print("🗳️ Removing vote (clicking same button)")
                try await removeVote(lawID: lawID)
            } else {
                // Change vote type
                print("🗳️ Changing vote from \(currentVote.displayName) to \(voteType.displayName)")
                try await vote(lawID: lawID, voteType: voteType)
            }
        } else {
            // Add new vote
            print("🗳️ Adding new vote: \(voteType.displayName)")
            try await vote(lawID: lawID, voteType: voteType)
        }
        
        print("✅ VotingService.toggleVote completed")
    }

    // MARK: - Bulk Operations
    @MainActor
    func clearAllVotes() {
        votes.removeAll()
        saveVotes()
    }
}
