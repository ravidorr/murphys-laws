//
//  EmptyStateView.swift
//  MurphysLaws
//
//  Custom empty state view for iOS 16 compatibility
//  Replaces ContentUnavailableView which is only available in iOS 17+
//

import SwiftUI

struct EmptyStateView: View {
    let title: String
    let systemImage: String
    let description: String

    init(title: String, systemImage: String, description: String) {
        self.title = title
        self.systemImage = systemImage
        self.description = description
    }

    var body: some View {
        VStack(spacing: Constants.UI.spacingL) {
            Image(systemName: systemImage)
                .dsTypography(DS.Typography.display)
                .foregroundColor(DS.Color.mutedFg)

            Text(title)
                .dsTypography(DS.Typography.h3)
                .fontWeight(.semibold)
                .foregroundColor(DS.Color.fg)
                .multilineTextAlignment(.center)

            Text(description)
                .dsTypography(DS.Typography.bodyMd)
                .foregroundColor(DS.Color.mutedFg)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

#Preview {
    EmptyStateView(
        title: "No Laws Found",
        systemImage: "doc.text.magnifyingglass",
        description: "Try adjusting your search or filters"
    )
}
