//
//  Vote.swift
//  MurphysLaws
//
//  Vote data model
//

import Foundation

enum VoteType: String, Codable, CaseIterable {
    case up
    case down

    var displayName: String {
        switch self {
        case .up: return "Upvote"
        case .down: return "Downvote"
        }
    }

    var iconName: String {
        switch self {
        case .up: return "hand.thumbsup.fill"
        case .down: return "hand.thumbsdown.fill"
        }
    }
}

struct Vote: Codable {
    let lawID: Int
    let voteType: VoteType
    let timestamp: Date

    enum CodingKeys: String, CodingKey {
        case lawID = "law_id"
        case voteType = "vote_type"
        case timestamp
    }
}

// MARK: - API Request/Response Models
struct VoteRequest: Codable {
    let voteType: String

    enum CodingKeys: String, CodingKey {
        case voteType = "vote_type"
    }

    init(voteType: VoteType) {
        self.voteType = voteType.rawValue
    }
}

struct VoteResponse: Codable {
    let lawID: Int
    let voteType: String?  // Optional - not present in remove vote responses
    let upvotes: Int
    let downvotes: Int
    
    enum CodingKeys: String, CodingKey {
        case lawID = "law_id"
        case voteType = "vote_type"
        case upvotes
        case downvotes
    }
    
    // Convenience property to check if vote was successful
    var success: Bool {
        return upvotes >= 0 && downvotes >= 0
    }
}
