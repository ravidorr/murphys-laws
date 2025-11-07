//
//  FilterView.swift
//  MurphysLaws
//
//  Filter sheet for browse view
//

import SwiftUI

struct FilterView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = CategoryListViewModel()

    @Binding var selectedCategoryID: Int?
    @Binding var sortOrder: SortOrder

    enum SortOrder: String, CaseIterable, Identifiable {
        case newest = "Newest First"
        case oldest = "Oldest First"
        case topVoted = "Top Voted"
        case controversial = "Controversial"

        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Category filter section
                Section("Category") {
                    Button {
                        selectedCategoryID = nil
                    } label: {
                        HStack {
                            Text("All Categories")
                            Spacer()
                            if selectedCategoryID == nil {
                                Image(systemImage: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }
                    .foregroundColor(.primary)

                    if viewModel.isLoading && viewModel.categories.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        ForEach(viewModel.categories) { category in
                            Button {
                                selectedCategoryID = category.id
                            } label: {
                                HStack {
                                    Image(systemName: category.iconName)
                                        .foregroundColor(category.iconColor)
                                    Text(category.title)
                                    Spacer()
                                    if selectedCategoryID == category.id {
                                        Image(systemName: "checkmark")
                                            .foregroundColor(.accentColor)
                                    }
                                }
                            }
                            .foregroundColor(.primary)
                        }
                    }
                }

                // Sort order section
                Section("Sort Order") {
                    ForEach(SortOrder.allCases) { order in
                        Button {
                            sortOrder = order
                        } label: {
                            HStack {
                                Text(order.rawValue)
                                Spacer()
                                if sortOrder == order {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accentColor)
                                }
                            }
                        }
                        .foregroundColor(.primary)
                    }
                }
            }
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Reset") {
                        selectedCategoryID = nil
                        sortOrder = .newest
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                }
            }
            .task {
                if viewModel.categories.isEmpty {
                    await viewModel.loadCategories()
                }
            }
        }
    }
}

#Preview {
    FilterView(
        selectedCategoryID: .constant(nil),
        sortOrder: .constant(.newest)
    )
}
