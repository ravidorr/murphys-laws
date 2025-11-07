//
//  BrowseView.swift
//  MurphysLaws
//
//  Browse all laws with search and filters
//

import SwiftUI

struct BrowseView: View {
    @StateObject private var viewModel = LawListViewModel()
    @State private var showingLawDetail = false
    @State private var selectedLaw: Law?
    @State private var searchText = ""
    @State private var showingFilters = false

    var body: some View {
        NavigationStack {
            lawListContent
                .navigationTitle("Browse Laws")
                .searchable(text: $searchText, prompt: "Search laws...")
                .onChange(of: searchText) { _, newValue in
                    Task {
                        await viewModel.applyFilters(query: newValue.isEmpty ? nil : newValue)
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        filterButton
                    }
                }
                .refreshable {
                    await viewModel.refresh()
                }
                .task {
                    if viewModel.laws.isEmpty {
                        await viewModel.loadLaws()
                    }
                }
                .sheet(isPresented: $showingLawDetail) {
                    lawDetailSheet
                }
                .sheet(isPresented: $showingFilters) {
                    FilterView(viewModel: viewModel)
                }
                .overlay {
                    contentOverlay
                }
        }
    }

    private var lawListContent: some View {
        List {
            ForEach(viewModel.laws) { law in
                LawListRow(law: law)
                    .onTapGesture {
                        selectedLaw = law
                        showingLawDetail = true
                    }
                    .onAppear {
                        // Load more when approaching end
                        if viewModel.shouldLoadMore(currentLaw: law) {
                            Task {
                                await viewModel.loadMore()
                            }
                        }
                    }
            }

            // Loading more indicator
            if viewModel.isLoadingMore {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding()
            }
        }
        .listStyle(.plain)
    }

    private var filterButton: some View {
        Button {
            showingFilters.toggle()
        } label: {
            Image(systemName: "line.3.horizontal.decrease.circle")
        }
    }

    @ViewBuilder
    private var lawDetailSheet: some View {
        if let law = selectedLaw {
            NavigationStack {
                LawDetailView(lawID: law.id)
            }
        }
    }

    @ViewBuilder
    private var contentOverlay: some View {
        if viewModel.isLoading && viewModel.laws.isEmpty {
            ProgressView("Loading laws...")
        } else if let error = viewModel.error, viewModel.laws.isEmpty {
            EmptyStateView(
                title: "Error Loading Laws",
                systemImage: "exclamationmark.triangle",
                description: error.localizedDescription
            )
        } else if !viewModel.isLoading && viewModel.laws.isEmpty {
            EmptyStateView(
                title: "No Laws Found",
                systemImage: "magnifyingglass",
                description: "Try adjusting your search or filters"
            )
        }
    }
}

// MARK: - Law List Row
struct LawListRow: View {
    let law: Law
    @EnvironmentObject var votingService: VotingService

    var currentVote: VoteType? {
        votingService.getVote(for: law.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
            // Title (if exists)
            if let title = law.title, !title.isEmpty {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
            }

            // Law text
            Text(law.text)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(3)

            // Metadata
            HStack {
                // Vote counts
                Label("\(law.upvotes)", systemImage: currentVote == .up ? "hand.thumbsup.fill" : "hand.thumbsup")
                    .foregroundColor(currentVote == .up ? .green : .gray)
                    .font(.caption)

                Label("\(law.downvotes)", systemImage: currentVote == .down ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                    .foregroundColor(currentVote == .down ? .red : .gray)
                    .font(.caption)

                Spacer()

                // Category tag
                if let firstCategory = law.categories?.first {
                    Text(firstCategory.title)
                        .font(.caption2)
                        .padding(.horizontal, Constants.UI.spacingS)
                        .padding(.vertical, 4)
                        .background(firstCategory.iconColor.opacity(0.2))
                        .foregroundColor(firstCategory.iconColor)
                        .cornerRadius(Constants.UI.cornerRadiusS)
                }
            }
        }
        .padding(.vertical, Constants.UI.spacingS)
    }
}

#Preview {
    BrowseView()
        .environmentObject(VotingService.shared)
}
