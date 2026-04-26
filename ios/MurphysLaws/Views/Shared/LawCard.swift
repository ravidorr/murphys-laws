//
//  LawCard.swift
//  MurphysLaws
//
//  Reusable law card component
//

import SwiftUI

struct LawCard: View {
    let law: Law
    @EnvironmentObject var votingService: VotingService

    var currentVote: VoteType? {
        votingService.getVote(for: law.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
            // Title (if exists)
            if let title = law.title, !title.isEmpty {
                Text(title)
                    .dsTypography(DS.Typography.h4)
                    .fontWeight(.semibold)
                    .foregroundColor(DS.Color.fg)
                    .lineLimit(2)
            }

            // Law text
            Text(law.text)
                .dsTypography(DS.Typography.bodyMd)
                .foregroundColor(DS.Color.mutedFg)
                .lineLimit(4)

            // Vote counts and categories
            HStack {
                // Upvotes
                Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundColor(currentVote == .up ? DS.Color.success : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                // Downvotes
                Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundColor(currentVote == .down ? DS.Color.error : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                Spacer()

                // Category tags (first one only for card)
                if let firstCategory = law.categories?.first {
                    Text(firstCategory.title)
                        .dsTypography(DS.Typography.caption)
                        .padding(.horizontal, Constants.UI.spacingS)
                        .padding(.vertical, 4)
                        .background(firstCategory.iconColor.opacity(0.2))
                        .foregroundColor(firstCategory.iconColor)
                        .cornerRadius(Constants.UI.cornerRadiusS)
                }
            }
        }
        .padding()
        .background(DS.Color.surface)
        .cornerRadius(Constants.UI.cornerRadiusM)
        .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: 2)
    }
}

#Preview {
    LawCard(law: .mock)
        .padding()
        .environmentObject(VotingService.shared)
}
