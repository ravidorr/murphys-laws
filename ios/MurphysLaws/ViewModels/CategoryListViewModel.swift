//
//  CategoryListViewModel.swift
//  MurphysLaws
//
//  ViewModel for managing category list and filtering
//

import Foundation

@MainActor
class CategoryListViewModel: ObservableObject {
    @Published var categories: [Category] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let repository: CategoryRepository

    init(repository: CategoryRepository = CategoryRepository()) {
        self.repository = repository
    }

    /// Load all categories
    func loadCategories() async {
        isLoading = true
        errorMessage = nil

        do {
            categories = try await repository.fetchCategories()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    /// Refresh categories (clears cache)
    func refreshCategories() async {
        repository.clearCache()
        await loadCategories()
    }

    /// Get category by ID
    func category(withID id: Int) -> Category? {
        categories.first { $0.id == id }
    }
}
