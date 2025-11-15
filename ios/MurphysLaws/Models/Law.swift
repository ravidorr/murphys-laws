//
//  Law.swift
//  MurphysLaws
//
//  Law data model
//

import Foundation

struct Law: Codable, Identifiable, Hashable {
    let id: Int
    let text: String
    let title: String?
    let slug: String?
    let rawMarkdown: String?
    let originNote: String?
    let upvotes: Int
    let downvotes: Int
    let createdAt: Date?
    let updatedAt: Date?
    let attributions: [Attribution]?
    let categories: [Category]?

    // MARK: - Computed Properties
    var score: Int {
        upvotes - downvotes
    }

    var displayText: String {
        if let title = title, !title.isEmpty {
            return "\(title): \(text)"
        }
        return text
    }

    var shareText: String {
        "\"\(displayText)\" - Murphy's Laws"
    }

    // MARK: - Coding Keys
    enum CodingKeys: String, CodingKey {
        case id, text, title, slug, upvotes, downvotes, attributions, categories
        case rawMarkdown = "raw_markdown"
        case originNote = "origin_note"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Hashable
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(upvotes)
        hasher.combine(downvotes)
    }

    static func == (lhs: Law, rhs: Law) -> Bool {
        lhs.id == rhs.id && 
        lhs.upvotes == rhs.upvotes && 
        lhs.downvotes == rhs.downvotes
    }
}

// MARK: - API Response Models
struct LawsResponse: Codable {
    let data: [Law]
    let total: Int
    let limit: Int
    let offset: Int
}

struct LawDetailResponse: Codable {
    let law: Law
}

struct LawOfDayResponse: Codable {
    let law: Law
    let featuredDate: String

    enum CodingKeys: String, CodingKey {
        case law
        case featuredDate = "featured_date"
    }
}

// MARK: - Mock Data (for previews)
#if DEBUG
extension Law {
    static let mock = Law(
        id: 1,
        text: "If anything can go wrong, it will.",
        title: "Murphy's Law",
        slug: "murphys-law",
        rawMarkdown: nil,
        originNote: nil,
        upvotes: 42,
        downvotes: 3,
        createdAt: Date(),
        updatedAt: Date(),
        attributions: [Attribution.mock],
        categories: [Category.mock]
    )

    static let mockList: [Law] = [
        mock,
        Law(
            id: 2,
            text: "Anything that can go wrong will go wrong, and at the worst possible time.",
            title: "Finagle's Law",
            slug: "finagles-law",
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 38,
            downvotes: 2,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: nil
        ),
        Law(
            id: 3,
            text: "When you are in a hurry, the traffic lights will always be red.",
            title: nil,
            slug: nil,
            rawMarkdown: nil,
            originNote: nil,
            upvotes: 25,
            downvotes: 1,
            createdAt: Date(),
            updatedAt: Date(),
            attributions: nil,
            categories: nil
        )
    ]
}
#endif
