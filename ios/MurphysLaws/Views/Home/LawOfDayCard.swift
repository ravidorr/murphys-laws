//
//  LawOfDayCard.swift
//  MurphysLaws
//
//  Special card for Law of the Day
//

import SwiftUI

struct LawOfDayCard: View {
    let law: Law
    let onTap: () -> Void

    @EnvironmentObject var votingService: VotingService

    var currentVote: VoteType? {
        votingService.getVote(for: law.id)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                // Badge
                HStack {
                    Image(systemName: "star.fill")
                    Text("Law of the Day")
                        .dsTypography(DS.Typography.bodySm)
                        .fontWeight(.semibold)
                }
                .foregroundColor(DS.Color.favoriteColor)

                // Title (if exists)
                if let title = law.title, !title.isEmpty {
                    Text(title)
                        .dsTypography(DS.Typography.h3)
                        .fontWeight(.bold)
                        .foregroundColor(DS.Color.fg)
                }

                // Law text
                Text(law.displayText)
                    .dsTypography(DS.Typography.h4)
                    .foregroundColor(DS.Color.fg)
                    .multilineTextAlignment(.leading)
                    .padding(.vertical, Constants.UI.spacingS)

                // Attribution (if exists)
                if let attribution = law.attributions?.first {
                    Text("— \(attribution.displayName)")
                        .dsTypography(DS.Typography.bodySm)
                        .italic()
                        .foregroundColor(DS.Color.mutedFg)
                }

                Divider()

                // Vote counts and share
                HStack {
                    // Upvotes
                    Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                        .foregroundColor(currentVote == .up ? DS.Color.success : DS.Color.mutedFg)

                    // Downvotes
                    Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                        .foregroundColor(currentVote == .down ? DS.Color.error : DS.Color.mutedFg)

                    Spacer()

                    // Share button
                    ShareLink(item: law.shareText) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
                .dsTypography(DS.Typography.bodySm)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: [DS.Color.favoriteBg.opacity(0.7), DS.Color.orangeBg.opacity(0.5)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .cornerRadius(Constants.UI.cornerRadiusL)
            .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    LawOfDayCard(law: .mock) {
        print("Law tapped")
    }
    .padding()
    .environmentObject(VotingService.shared)
}
