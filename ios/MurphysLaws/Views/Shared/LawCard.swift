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
        VStack(alignment: .leading, spacing: DS.Spacing.s4) {
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

            Spacer(minLength: 0)

            // Vote counts and share
            HStack {
                Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundColor(currentVote == .up ? DS.Color.success : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundColor(currentVote == .down ? DS.Color.error : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                Spacer()

                ShareLink(item: law.shareText) {
                    Label("Share", systemImage: "square.and.arrow.up")
                        .dsTypography(DS.Typography.caption)
                }
            }
        }
        .padding()
        .frame(maxHeight: .infinity, alignment: .top)
        .dsCard()
    }
}

#Preview {
    LawCard(law: .mock)
        .padding()
        .environmentObject(VotingService.shared)
}
