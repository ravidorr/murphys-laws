//
//  LawListViewModel.swift
//  MurphysLaws
//
//  ViewModel for browsing laws list
//

import Foundation

@MainActor
class LawListViewModel: ObservableObject {
    @Published var laws: [Law] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var errorMessage: String?
    @Published var hasMorePages = true

    // Filters
    @Published var searchQuery: String = ""
    @Published var selectedCategoryID: Int?
    @Published var sortBy: String = "created_at"
    @Published var sortOrder: String = "desc"

    @Published var currentPage: Int = 0

    private let repository: LawRepository
    private var currentOffset = 0
    private let limit = Constants.API.defaultLimit

    // MARK: - Init
    init(repository: LawRepository = LawRepository(), categoryID: Int? = nil) {
        self.repository = repository
        self.selectedCategoryID = categoryID
    }

    // MARK: - Load Laws
    func loadLaws(refresh: Bool = false) async {
        if refresh {
            currentOffset = 0
            laws.removeAll()
            hasMorePages = true
            currentPage = 0
        }

        guard !isLoading else { return }
        isLoading = true
        errorMessage = nil

        do {
            let response = try await repository.fetchLaws(
                limit: limit,
                offset: currentOffset,
                query: searchQuery.isEmpty ? nil : searchQuery,
                categoryID: selectedCategoryID,
                sort: sortBy,
                order: sortOrder
            )

            if refresh {
                laws = response.data
            } else {
                laws.append(contentsOf: response.data)
            }

            if !response.data.isEmpty {
                currentPage += 1
            }

            currentOffset += response.data.count
            hasMorePages = response.data.count >= limit

        } catch {
            errorMessage = error.localizedDescription
            print("Error loading laws: \(error)")
        }

        isLoading = false
    }

    // MARK: - Load More (Pagination)
    func loadMore() async {
        guard !isLoadingMore && hasMorePages && !isLoading else { return }

        isLoadingMore = true

        do {
            let response = try await repository.fetchLaws(
                limit: limit,
                offset: currentOffset,
                query: searchQuery.isEmpty ? nil : searchQuery,
                categoryID: selectedCategoryID,
                sort: sortBy,
                order: sortOrder
            )

            laws.append(contentsOf: response.data)
            currentOffset += response.data.count
            hasMorePages = response.data.count >= limit

            if !response.data.isEmpty {
                currentPage += 1
            }

        } catch {
            errorMessage = error.localizedDescription
            print("Error loading more laws: \(error)")
        }

        isLoadingMore = false
    }

    // MARK: - Load More Laws (Test-friendly alias)
    func loadMoreLaws() async {
        await loadMore()
    }

    // MARK: - Check if should load more
    func shouldLoadMore(currentLaw law: Law) -> Bool {
        guard let index = laws.firstIndex(where: { $0.id == law.id }) else {
            return false
        }

        return index >= laws.count - Constants.Performance.prefetchThreshold
    }

    // MARK: - Refresh
    func refresh() async {
        await loadLaws(refresh: true)
    }

    // MARK: - Refresh Laws (Test-friendly alias)
    func refreshLaws() async {
        await refresh()
    }

    // MARK: - Search Laws
    func searchLaws() async {
        await loadLaws(refresh: true)
    }

    // MARK: - Apply Filters
    func applyFilters(query: String? = nil, categoryID: Int? = nil) async {
        if let query = query {
            searchQuery = query
        }
        selectedCategoryID = categoryID
        await loadLaws(refresh: true)
    }

    // MARK: - Apply Sort Order
    func applySort(by: String, order: String = "desc") async {
        sortBy = by
        sortOrder = order
        await loadLaws(refresh: true)
    }

    // MARK: - Clear Filters
    func clearFilters() async {
        searchQuery = ""
        selectedCategoryID = nil
        await loadLaws(refresh: true)
    }
}

