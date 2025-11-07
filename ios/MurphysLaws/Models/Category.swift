//
//  Category.swift
//  MurphysLaws
//
//  Category data model
//

import Foundation
import SwiftUI

struct Category: Codable, Identifiable, Hashable {
    let id: Int
    let title: String
    let slug: String
    let description: String?
    let sourceFilePath: String?
    let createdAt: Date?
    let updatedAt: Date?

    // MARK: - Computed Properties
    var iconName: String {
        // Map category slugs to SF Symbols
        switch slug {
        case _ where slug.contains("tech"):
            return "desktopcomputer"
        case _ where slug.contains("office"), _ where slug.contains("work"):
            return "building.2"
        case _ where slug.contains("love"), _ where slug.contains("relationship"):
            return "heart"
        case _ where slug.contains("travel"):
            return "airplane"
        case _ where slug.contains("food"):
            return "fork.knife"
        case _ where slug.contains("money"):
            return "dollarsign.circle"
        case _ where slug.contains("time"):
            return "clock"
        case _ where slug.contains("computer"), _ where slug.contains("internet"):
            return "wifi"
        case _ where slug.contains("car"), _ where slug.contains("traffic"):
            return "car"
        case _ where slug.contains("home"):
            return "house"
        default:
            return "lightbulb"
        }
    }

    var iconColor: Color {
        // Assign colors based on category
        let hash = abs(slug.hashValue) % 8
        switch hash {
        case 0: return .blue
        case 1: return .green
        case 2: return .orange
        case 3: return .purple
        case 4: return .red
        case 5: return .pink
        case 6: return .indigo
        default: return .teal
        }
    }

    // MARK: - Coding Keys
    enum CodingKeys: String, CodingKey {
        case id, title, slug, description
        case sourceFilePath = "source_file_path"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    // MARK: - Hashable
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Category, rhs: Category) -> Bool {
        lhs.id == rhs.id
    }
}

// MARK: - API Response Models
struct CategoriesResponse: Codable {
    let data: [Category]
    let total: Int?
}

// MARK: - Mock Data (for previews)
#if DEBUG
extension Category {
    static let mock = Category(
        id: 1,
        title: "Technology",
        slug: "technology",
        description: "Laws about computers, software, and tech mishaps",
        sourceFilePath: nil,
        createdAt: Date(),
        updatedAt: Date()
    )

    static let mockList: [Category] = [
        mock,
        Category(
            id: 2,
            title: "Office & Work",
            slug: "office-work",
            description: "Workplace observations and corporate life",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        Category(
            id: 3,
            title: "Love & Relationships",
            slug: "love-relationships",
            description: "Romance, dating, and relationship dynamics",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        ),
        Category(
            id: 4,
            title: "Travel",
            slug: "travel",
            description: "Adventures and misadventures on the road",
            sourceFilePath: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    ]
}
#endif
