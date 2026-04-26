//
//  CategoriesView.swift
//  MurphysLaws
//
//  Browse and filter laws by category
//

import SwiftUI

struct CategoriesView: View {
    @StateObject private var viewModel = CategoryListViewModel()
    @State private var selectedCategory: Category?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.categories.isEmpty {
                    ProgressView("Loading categories...")
                } else if let errorMessage = viewModel.errorMessage, viewModel.categories.isEmpty {
                    EmptyStateView(
                        title: "Error Loading Categories",
                        systemImage: "exclamationmark.triangle",
                        description: errorMessage
                    )
                } else if viewModel.categories.isEmpty {
                    EmptyStateView(
                        title: "No Categories",
                        systemImage: "folder",
                        description: "No categories available"
                    )
                } else {
                    List {
                        ForEach(viewModel.categories) { category in
                            Button {
                                selectedCategory = category
                            } label: {
                                CategoryRow(category: category)
                            }
                            .foregroundColor(DS.Color.fg)
                            .accessibilityIdentifier("CategoryCard-\(category.id)")
                            .accessibilityLabel("Category: \(category.title)")
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle("Categories")
            .refreshable {
                await viewModel.refreshCategories()
            }
            .task {
                if viewModel.categories.isEmpty {
                    await viewModel.loadCategories()
                }
            }
            .sheet(item: $selectedCategory) { category in
                CategoryDetailView(category: category)
            }
        }
    }
}

// MARK: - Category Row Component
struct CategoryRow: View {
    let category: Category
    var isSelected: Bool? = nil

    var body: some View {
        HStack {
            Image(systemName: category.iconName)
                .foregroundColor(category.iconColor)
                .frame(width: 24)
            Text(category.title)
            Spacer()
            if let isSelected {
                if isSelected {
                    Image(systemName: "checkmark")
                        .foregroundColor(DS.Color.btnPrimaryBg)
                }
            } else {
                Image(systemName: "chevron.right")
                    .dsTypography(DS.Typography.caption)
                    .foregroundColor(DS.Color.mutedFg)
            }
        }
    }
}

// MARK: - Category Detail View
struct CategoryDetailView: View {
    let category: Category
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel: LawListViewModel

    init(category: Category) {
        self.category = category
        _viewModel = StateObject(wrappedValue: LawListViewModel(categoryID: category.id))
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.laws.isEmpty && viewModel.isLoading {
                    ProgressView("Loading laws...")
                } else if let errorMessage = viewModel.errorMessage, viewModel.laws.isEmpty {
                    EmptyStateView(
                        title: "Error Loading Laws",
                        systemImage: "exclamationmark.triangle",
                        description: errorMessage
                    )
                } else if viewModel.laws.isEmpty {
                    EmptyStateView(
                        title: "No Laws Found",
                        systemImage: "doc.text.magnifyingglass",
                        description: "No laws in this category yet"
                    )
                } else {
                    List {
                        ForEach(viewModel.laws) { law in
                            NavigationLink {
                                LawDetailView(lawID: law.id, law: law)
                            } label: {
                                LawRowView(law: law)
                            }
                            .accessibilityIdentifier("CategoryLawRow-\(law.id)")
                            .onAppear {
                                if viewModel.shouldLoadMore(currentLaw: law) {
                                    Task {
                                        await viewModel.loadMore()
                                    }
                                }
                            }
                        }

                        if viewModel.isLoading && !viewModel.laws.isEmpty {
                            HStack {
                                Spacer()
                                ProgressView()
                                Spacer()
                            }
                        }
                    }
                    .listStyle(.plain)
                    .accessibilityIdentifier("CategoryLawList")
                    .refreshable {
                        await viewModel.loadLaws(refresh: true)
                    }
                }
            }
            .navigationTitle(category.title)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .refreshable {
                await viewModel.loadLaws(refresh: true)
            }
            .task {
                if viewModel.laws.isEmpty {
                    await viewModel.loadLaws()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .lawVotesDidChange)) { notification in
                // Update vote counts when a law is voted on
                if let lawID = notification.userInfo?["lawID"] as? Int,
                   let upvotes = notification.userInfo?["upvotes"] as? Int,
                   let downvotes = notification.userInfo?["downvotes"] as? Int {
                    viewModel.updateLawVotes(lawID: lawID, upvotes: upvotes, downvotes: downvotes)
                }
            }
        }
    }
}

// MARK: - Law Row View
struct LawRowView: View {
    let law: Law
    @EnvironmentObject var votingService: VotingService

    var currentVote: VoteType? {
        votingService.getVote(for: law.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
            if let title = law.title, !title.isEmpty {
                Text(title)
                    .dsTypography(DS.Typography.h4)
                    .foregroundColor(DS.Color.fg)
            }

            Text(law.text)
                .dsTypography(DS.Typography.bodySm)
                .foregroundColor(DS.Color.mutedFg)
                .lineLimit(3)

            HStack {
                Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundColor(currentVote == .up ? DS.Color.success : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundColor(currentVote == .down ? DS.Color.error : DS.Color.mutedFg)
                    .dsTypography(DS.Typography.caption)

                Spacer()

                Text("Score: \(law.score)")
                    .dsTypography(DS.Typography.caption)
                    .foregroundColor(DS.Color.mutedFg)
            }
        }
        .padding(.vertical, Constants.UI.spacingS)
    }
}

#Preview {
    CategoriesView()
}
