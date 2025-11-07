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
                    Image(systemImage: "star.fill")
                    Text("Law of the Day")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.yellow)

                // Title (if exists)
                if let title = law.title, !title.isEmpty {
                    Text(title)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                }

                // Law text
                Text(law.displayText)
                    .font(.title3)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.leading)
                    .padding(.vertical, Constants.UI.spacingS)

                // Attribution (if exists)
                if let attribution = law.attributions?.first {
                    Text("— \(attribution.displayName)")
                        .font(.callout)
                        .italic()
                        .foregroundColor(.secondary)
                }

                Divider()

                // Vote counts and share
                HStack {
                    // Upvotes
                    Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                        .foregroundColor(currentVote == .up ? .green : .gray)

                    // Downvotes
                    Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                        .foregroundColor(currentVote == .down ? .red : .gray)

                    Spacer()

                    // Share button
                    ShareLink(item: law.shareText) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
                .font(.callout)
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                LinearGradient(
                    colors: [Color.yellow.opacity(0.1), Color.orange.opacity(0.05)],
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
