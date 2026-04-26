//
//  LawDetailView.swift
//  MurphysLaws
//
//  Law detail view with voting and sharing
//

import SwiftUI

struct LawDetailView: View {
    let lawID: Int
    let initialLaw: Law?  // Optional: pass the law data we already have

    @StateObject private var viewModel: LawDetailViewModel
    @Environment(\.dismiss) private var dismiss

    init(lawID: Int, law: Law? = nil) {
        self.lawID = lawID
        self.initialLaw = law
        _viewModel = StateObject(wrappedValue: LawDetailViewModel(lawID: lawID, initialLaw: law))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.law == nil {
                // Show loading state
                VStack(spacing: Constants.UI.spacingM) {
                    ProgressView()
                        .scaleEffect(1.5)
                    Text("Loading law...")
                        .dsTypography(DS.Typography.bodySm)
                        .foregroundColor(DS.Color.mutedFg)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = viewModel.error, viewModel.law == nil {
                // Show error state
                EmptyStateView(
                    title: "Error Loading Law",
                    systemImage: "exclamationmark.triangle",
                    description: error.localizedDescription
                )
            } else if let law = viewModel.law {
                // Show law content
                ScrollView {
                    VStack(alignment: .leading, spacing: Constants.UI.spacingL) {
                        // Law content
                        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                            // Title (if exists)
                            if let title = law.title, !title.isEmpty {
                                Text(title)
                                    .dsTypography(DS.Typography.h2)
                                    .fontWeight(.bold)
                                    .foregroundColor(DS.Color.fg)
                            }

                            // Law text
                            Text(law.text)
                                .dsTypography(DS.Typography.h4)
                                .foregroundColor(DS.Color.fg)
                                .padding(.vertical, Constants.UI.spacingS)

                            // Categories
                            if let categories = law.categories, !categories.isEmpty {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: Constants.UI.spacingS) {
                                        ForEach(categories) { category in
                                            CategoryChip(category: category)
                                        }
                                    }
                                }
                            }
                        }
                        .padding()

                        Divider()

                        // Voting section
                        VStack(spacing: Constants.UI.spacingM) {
                            HStack(spacing: Constants.UI.spacingL) {
                                // Upvote button
                                VoteButton(
                                    voteType: .up,
                                    count: law.upvotes,
                                    isSelected: viewModel.currentVote == .up,
                                    isLoading: viewModel.isVoting
                                ) {
                                    Task {
                                        await viewModel.toggleVote(.up)
                                    }
                                }

                                // Downvote button
                                VoteButton(
                                    voteType: .down,
                                    count: law.downvotes,
                                    isSelected: viewModel.currentVote == .down,
                                    isLoading: viewModel.isVoting
                                ) {
                                    Task {
                                        await viewModel.toggleVote(.down)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }

                        Divider()

                        // Attribution section
                        if let attributions = law.attributions, !attributions.isEmpty {
                            VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                                Text("Attribution")
                                    .dsTypography(DS.Typography.h4)
                                    .foregroundColor(DS.Color.fg)

                                ForEach(attributions, id: \.name) { attribution in
                                    VStack(alignment: .leading, spacing: DS.Spacing.s1) {
                                        Text("Submitted by \(attribution.displayName)")
                                            .dsTypography(DS.Typography.bodySm)
                                            .foregroundColor(DS.Color.fg)

                                        if let link = attribution.contactLink {
                                            Link(attribution.contactValue ?? "", destination: URL(string: link)!)
                                                .dsTypography(DS.Typography.caption)
                                                .foregroundColor(DS.Color.link)
                                        }

                                        if let note = attribution.note {
                                            Text(note)
                                                .dsTypography(DS.Typography.caption)
                                                .foregroundColor(DS.Color.mutedFg)
                                        }
                                    }
                                }
                            }
                            .padding()
                        }
                    }
                }
                .refreshable {
                    await viewModel.refresh()
                }
            } else {
                // Fallback empty state (should not normally reach here)
                EmptyStateView(
                    title: "No Law Found",
                    systemImage: "doc.text.magnifyingglass",
                    description: "Unable to load law details"
                )
            }
        }
        .navigationTitle("Law Detail")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button("Close") {
                    dismiss()
                }
            }
            
            ToolbarItem(placement: .navigationBarTrailing) {
                if let law = viewModel.law {
                    ShareLink(item: law.shareText) {
                        Image(systemName: "square.and.arrow.up")
                    }
                }
            }
        }
        .task {
            // Only fetch if we don't already have the law data
            if viewModel.law == nil {
                await viewModel.loadLaw()
            } else {
                // Optionally refresh in the background to get latest vote counts
                // Uncomment if you want to always fetch fresh data:
                // await viewModel.refresh()
            }
        }
    }
}

// MARK: - Vote Button Component
struct VoteButton: View {
    let voteType: VoteType
    let count: Int
    let isSelected: Bool
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Constants.UI.spacingS) {
                Image(systemName: voteType.iconName)
                    .dsTypography(DS.Typography.h3)
                    .foregroundColor(isSelected ? iconColor : DS.Color.mutedFg)

                Text("\(count)")
                    .dsTypography(DS.Typography.h4)
                    .foregroundColor(isSelected ? iconColor : DS.Color.fg)

                Text(voteType.displayName)
                    .dsTypography(DS.Typography.caption)
                    .foregroundColor(DS.Color.mutedFg)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? iconColor.opacity(0.1) : DS.Color.surface)
            .cornerRadius(Constants.UI.cornerRadiusM)
        }
        .accessibilityIdentifier(voteType.displayName)
        .accessibilityLabel(voteType.displayName)
        .accessibilityValue("\(count) votes")
        .disabled(isLoading)
    }

    private var iconColor: Color {
        switch voteType {
        case .up: return DS.Color.success
        case .down: return DS.Color.error
        }
    }
}

// MARK: - Category Chip Component
struct CategoryChip: View {
    let category: Category

    var body: some View {
        HStack(spacing: DS.Spacing.s1) {
            Image(systemName: category.iconName)
                .dsTypography(DS.Typography.caption)
            Text(category.title)
                .dsTypography(DS.Typography.caption)
        }
        .padding(.horizontal, Constants.UI.spacingM)
        .padding(.vertical, Constants.UI.spacingS)
        .background(category.iconColor.opacity(0.2))
        .foregroundColor(category.iconColor)
        .cornerRadius(Constants.UI.cornerRadiusM)
    }
}

#Preview {
    NavigationStack {
        LawDetailView(lawID: 1)
            .environmentObject(VotingService.shared)
    }
}
