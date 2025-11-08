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
                        .font(.subheadline)
                        .foregroundColor(.secondary)
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
                                    .font(.title)
                                    .fontWeight(.bold)
                            }

                            // Law text
                            Text(law.text)
                                .font(.title3)
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
                                    .font(.headline)

                                ForEach(attributions, id: \.name) { attribution in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("Submitted by \(attribution.displayName)")
                                            .font(.subheadline)

                                        if let link = attribution.contactLink {
                                            Link(attribution.contactValue ?? "", destination: URL(string: link)!)
                                                .font(.caption)
                                                .foregroundColor(.blue)
                                        }

                                        if let note = attribution.note {
                                            Text(note)
                                                .font(.caption)
                                                .foregroundColor(.secondary)
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
            print("🔍 LawDetailView task started for lawID: \(lawID)")
            print("🔍 viewModel.law is nil: \(viewModel.law == nil)")
            
            // Only fetch if we don't already have the law data
            if viewModel.law == nil {
                await viewModel.loadLaw()
                print("🔍 After loadLaw - viewModel.law is nil: \(viewModel.law == nil)")
                if let error = viewModel.error {
                    print("❌ Error: \(error)")
                }
            } else {
                print("✅ Already have law data, skipping fetch")
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
                    .font(.title2)
                    .foregroundColor(isSelected ? iconColor : .gray)

                Text("\(count)")
                    .font(.headline)
                    .foregroundColor(isSelected ? iconColor : .primary)

                Text(voteType.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(isSelected ? iconColor.opacity(0.1) : Color(.systemGray6))
            .cornerRadius(Constants.UI.cornerRadiusM)
        }
        .accessibilityIdentifier(voteType.displayName)
        .accessibilityLabel(voteType.displayName)
        .accessibilityValue("\(count) votes")
        .disabled(isLoading)
    }

    private var iconColor: Color {
        switch voteType {
        case .up: return .green
        case .down: return .red
        }
    }
}

// MARK: - Category Chip Component
struct CategoryChip: View {
    let category: Category

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: category.iconName)
                .font(.caption2)
            Text(category.title)
                .font(.caption)
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
