//
//  ContentPage.swift
//  MurphysLaws
//
//  Enum representing different content pages in the app
//

import Foundation

public enum ContentPage: String, CaseIterable {
    case about
    case privacy
    case terms
    case contact

    public var title: String {
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

    public var filename: String {
        return "\(self.rawValue).md"
    }
}
