//
//  BrowseView.swift
//  MurphysLaws
//
//  Browse all laws with search and filters
//

import SwiftUI

struct BrowseView: View {
    @StateObject private var viewModel = LawListViewModel()
    @State private var selectedLaw: Law?
    @State private var searchText = ""
    @State private var showingFilters = false
    @State private var selectedCategoryID: Int?
    @State private var sortOrder: FilterView.SortOrder = .newest

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Active filters display
                if selectedCategoryID != nil || sortOrder != .newest {
                    activeFiltersBar
                }
                
                lawListContent
            }
            .navigationTitle("Browse Laws")
            .searchable(text: $searchText, prompt: "Search")
            .onChange(of: searchText) { newValue in
                Task {
                    await viewModel.applyFilters(
                        query: newValue.isEmpty ? nil : newValue,
                        categoryID: selectedCategoryID
                    )
                }
            }
            .onChange(of: selectedCategoryID) { newValue in
                Task {
                    await viewModel.applyFilters(
                        query: searchText.isEmpty ? nil : searchText,
                        categoryID: newValue
                    )
                }
            }
            .onChange(of: sortOrder) { newValue in
                Task {
                    switch newValue {
                    case .newest:
                        await viewModel.applySort(by: "created_at", order: "desc")
                    case .oldest:
                        await viewModel.applySort(by: "created_at", order: "asc")
                    case .topVoted:
                        await viewModel.applySort(by: "score", order: "desc")
                    case .controversial:
                        await viewModel.applySort(by: "controversy", order: "desc")
                    }
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
            .onReceive(NotificationCenter.default.publisher(for: .lawVotesDidChange)) { notification in
                // Update vote counts when a law is voted on
                if let lawID = notification.userInfo?["lawID"] as? Int,
                   let upvotes = notification.userInfo?["upvotes"] as? Int,
                   let downvotes = notification.userInfo?["downvotes"] as? Int {
                    viewModel.updateLawVotes(lawID: lawID, upvotes: upvotes, downvotes: downvotes)
                }
            }
            .sheet(item: $selectedLaw) { law in
                NavigationStack {
                    LawDetailView(lawID: law.id, law: law)
                        .id(law.id)  // Force view recreation for each law
                }
            }
            .sheet(isPresented: $showingFilters) {
                FilterView(
                    selectedCategoryID: $selectedCategoryID,
                    sortOrder: $sortOrder
                )
            }
            .overlay {
                contentOverlay
            }
        }
    }

    private var lawListContent: some View {
        List {
            ForEach(viewModel.laws) { law in
                Button {
                    selectedLaw = law
                } label: {
                    LawListRow(law: law)
                }
                .accessibilityIdentifier("LawButton-\(law.id)")
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
            ZStack(alignment: .topTrailing) {
                Image(systemName: "line.3.horizontal.decrease.circle")
                
                // Badge indicator when filters are active
                if selectedCategoryID != nil || sortOrder != .newest {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                        .offset(x: 6, y: -6)
                }
            }
        }
    }
    
    @StateObject private var categoryViewModel = CategoryListViewModel()
    
    private var activeFiltersBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Constants.UI.spacingS) {
                // Category filter chip
                if let categoryID = selectedCategoryID {
                    FilterChip(
                        title: categoryTitle(for: categoryID),
                        systemImage: "tag",
                        color: categoryColor(for: categoryID)
                    ) {
                        selectedCategoryID = nil
                    }
                }
                
                // Sort order chip (only if not default)
                if sortOrder != .newest {
                    FilterChip(
                        title: sortOrder.rawValue,
                        systemImage: "arrow.up.arrow.down",
                        color: .blue
                    ) {
                        sortOrder = .newest
                    }
                }
                
                // Clear all button (if multiple filters)
                if selectedCategoryID != nil && sortOrder != .newest {
                    Button {
                        selectedCategoryID = nil
                        sortOrder = .newest
                    } label: {
                        Text("Clear All")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.red)
                    }
                    .padding(.leading, Constants.UI.spacingS)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, Constants.UI.spacingS)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .task {
            if categoryViewModel.categories.isEmpty {
                await categoryViewModel.loadCategories()
            }
        }
    }
    
    private func categoryTitle(for id: Int) -> String {
        categoryViewModel.categories.first { $0.id == id }?.title ?? "Category"
    }
    
    private func categoryColor(for id: Int) -> Color {
        categoryViewModel.categories.first { $0.id == id }?.iconColor ?? .gray
    }

    @ViewBuilder
    private var contentOverlay: some View {
        if viewModel.isLoading && viewModel.laws.isEmpty {
            ProgressView("Loading laws...")
        } else if let errorMessage = viewModel.errorMessage, viewModel.laws.isEmpty {
            EmptyStateView(
                title: "Error Loading Laws",
                systemImage: "exclamationmark.triangle",
                description: errorMessage
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
        .accessibilityIdentifier("LawListRow-\(law.id)")
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(law.title ?? "Law"): \(law.text)")
    }
}

// MARK: - Filter Chip Component
struct FilterChip: View {
    let title: String
    let systemImage: String
    let color: Color
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.caption2)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
            
            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(color.opacity(0.15))
        )
        .overlay(
            Capsule()
                .strokeBorder(color.opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview {
    BrowseView()
        .environmentObject(VotingService.shared)
}
