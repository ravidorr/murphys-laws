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
        print("🏷️ CategoryListViewModel: Starting to load categories...")
        isLoading = true
        errorMessage = nil

        do {
            categories = try await repository.fetchCategories()
            print("✅ CategoryListViewModel: Loaded \(categories.count) categories")
            if categories.isEmpty {
                print("⚠️ CategoryListViewModel: Categories array is empty!")
            } else {
                print("📋 Categories: \(categories.map { $0.title })")
            }
            isLoading = false
        } catch {
            print("❌ CategoryListViewModel: Error loading categories: \(error)")
            print("❌ Error details: \(error.localizedDescription)")
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
