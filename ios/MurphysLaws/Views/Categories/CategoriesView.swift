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
                    ScrollView {
                        LazyVGrid(
                            columns: [
                                GridItem(.flexible(), spacing: Constants.UI.spacingM),
                                GridItem(.flexible(), spacing: Constants.UI.spacingM)
                            ],
                            spacing: Constants.UI.spacingM
                        ) {
                            ForEach(viewModel.categories) { category in
                                CategoryCard(category: category) {
                                    selectedCategory = category
                                }
                            }
                        }
                        .padding()
                    }
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

// MARK: - Category Card Component
struct CategoryCard: View {
    let category: Category
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: Constants.UI.spacingM) {
                // Title
                Text(category.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(
                RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                    .fill(category.iconColor.opacity(0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                    .stroke(category.iconColor.opacity(0.3), lineWidth: 1)
            )
        }
        .accessibilityIdentifier("CategoryCard-\(category.id)")
        .accessibilityLabel("Category: \(category.title)")
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
                    .font(.headline)
            }

            Text(law.text)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(3)

            HStack {
                Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundColor(currentVote == .up ? .green : .gray)
                    .font(.caption)

                Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundColor(currentVote == .down ? .red : .gray)
                    .font(.caption)

                Spacer()

                Text("Score: \(law.score)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, Constants.UI.spacingS)
    }
}

#Preview {
    CategoriesView()
}
