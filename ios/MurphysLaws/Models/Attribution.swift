//
//  Attribution.swift
//  MurphysLaws
//
//  Attribution data model (who submitted a law)
//

import Foundation

struct Attribution: Codable, Identifiable, Hashable {
    let id: Int?
    let name: String
    let contactType: String?
    let contactValue: String?
    let note: String?
    let sourceFragment: String?

    // MARK: - Computed Properties
    var displayName: String {
        name
    }

    var contactLink: String? {
        guard let type = contactType, let value = contactValue else {
            return nil
        }

        switch type.lowercased() {
        case "email":
            return "mailto:\(value)"
        case "url":
            return value
        default:
            return nil
        }
    }

    var isEmail: Bool {
        contactType?.lowercased() == "email"
    }

    var isURL: Bool {
        contactType?.lowercased() == "url"
    }

    // MARK: - Coding Keys
    enum CodingKeys: String, CodingKey {
        case id, name, note
        case contactType = "contact_type"
        case contactValue = "contact_value"
        case sourceFragment = "source_fragment"
    }

    // MARK: - Hashable
    func hash(into hasher: inout Hasher) {
        hasher.combine(id ?? name.hashValue)
    }

    static func == (lhs: Attribution, rhs: Attribution) -> Bool {
        if let lhsId = lhs.id, let rhsId = rhs.id {
            return lhsId == rhsId
        }
        return lhs.name == rhs.name
    }
}

// MARK: - API Response Models
struct AttributionsResponse: Codable {
    let data: [Attribution]
    let total: Int?
}

// MARK: - Mock Data (for previews)
#if DEBUG
extension Attribution {
    static let mock = Attribution(
        id: 1,
        name: "John Doe",
        contactType: "email",
        contactValue: "john@example.com",
        note: "Original submitter",
        sourceFragment: nil
    )

    static let mockURL = Attribution(
        id: 2,
        name: "Jane Smith",
        contactType: "url",
        contactValue: "https://example.com",
        note: nil,
        sourceFragment: nil
    )

    static let mockAnonymous = Attribution(
        id: nil,
        name: "Anonymous",
        contactType: nil,
        contactValue: nil,
        note: nil,
        sourceFragment: nil
    )
}
#endif
