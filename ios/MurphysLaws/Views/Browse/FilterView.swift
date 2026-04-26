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
            List {
                Section("Category") {
                    Button {
                        selectedCategoryID = nil
                    } label: {
                        HStack {
                            Image(systemName: "square.grid.2x2")
                                .foregroundColor(DS.Color.btnPrimaryBg)
                                .frame(width: 24)
                            Text("All Categories")
                            Spacer()
                            if selectedCategoryID == nil {
                                Image(systemName: "checkmark")
                                    .foregroundColor(DS.Color.btnPrimaryBg)
                            }
                        }
                    }
                    .foregroundColor(DS.Color.fg)

                    if viewModel.isLoading && viewModel.categories.isEmpty {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        ForEach(viewModel.categories) { category in
                            Button {
                                selectedCategoryID = category.id
                            } label: {
                                CategoryRow(
                                    category: category,
                                    isSelected: selectedCategoryID == category.id
                                )
                            }
                            .foregroundColor(DS.Color.fg)
                            .accessibilityIdentifier("FilterCategory-\(category.id)")
                        }
                    }
                }

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
                                        .foregroundColor(DS.Color.btnPrimaryBg)
                                }
                            }
                        }
                        .foregroundColor(DS.Color.fg)
                    }
                }
            }
            .listStyle(.plain)
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
