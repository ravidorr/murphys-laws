//
//  ContentPage.swift
//  MurphysLaws
//
//  Enum representing different content pages in the app
//

import Foundation

enum ContentPage: String, CaseIterable {
    case about
    case privacy
    case terms
    case contact

    var title: String {
        switch self {
        case .about:
            return "About"
        case .privacy:
            return "Privacy Policy"
        case .terms:
            return "Terms of Service"
        case .contact:
            return "Contact"
        }
    }

    var filename: String {
        return "\(self.rawValue).md"
    }
}
