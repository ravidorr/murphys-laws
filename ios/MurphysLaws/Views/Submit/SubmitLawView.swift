//
//  SubmitLawView.swift
//  MurphysLaws
//
//  Form for submitting new laws
//

import SwiftUI

struct SubmitLawView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = SubmitLawViewModel()

    @State private var lawText = ""
    @State private var lawTitle = ""
    @State private var attributionName = ""
    @State private var contactType: ContactType = .none
    @State private var contactValue = ""
    @State private var attributionNote = ""
    @State private var selectedCategories: Set<Int> = []

    @State private var showingSuccess = false
    @State private var showingError = false

    enum ContactType: String, CaseIterable {
        case none = "None"
        case email = "Email"
        case twitter = "Twitter"
        case website = "Website"
        case other = "Other"
    }

    var body: some View {
        NavigationStack {
            Form {
                // Law content section
                Section {
                    TextField("Law text (required)", text: $lawText, axis: .vertical)
                        .lineLimit(3...10)

                    TextField("Title (optional)", text: $lawTitle)
                } header: {
                    Text("Law Content")
                } footer: {
                    Text("Enter the law text. Title is optional but recommended.")
                }

                // Categories section
                Section {
                    if viewModel.categories.isEmpty && viewModel.isLoadingCategories {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        ForEach(viewModel.categories) { category in
                            Button {
                                toggleCategory(category.id)
                            } label: {
                                HStack {
                                    Image(systemName: category.iconName)
                                        .foregroundColor(category.iconColor)
                                    Text(category.title)
                                        .foregroundColor(.primary)
                                    Spacer()
                                    if selectedCategories.contains(category.id) {
                                        Image(systemName: "checkmark")
                                            .foregroundColor(.accentColor)
                                    }
                                }
                            }
                        }
                    }
                } header: {
                    Text("Categories (Optional)")
                } footer: {
                    Text("Select categories that best describe this law")
                }

                // Attribution section
                Section {
                    TextField("Your name", text: $attributionName)

                    Picker("Contact Type", selection: $contactType) {
                        ForEach(ContactType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }

                    if contactType != .none {
                        TextField(contactPlaceholder, text: $contactValue)
                            .textContentType(contactType == .email ? .emailAddress : nil)
                            .keyboardType(contactType == .email ? .emailAddress : .default)
                            .autocapitalization(contactType == .email ? .none : .sentences)
                    }

                    TextField("Note (optional)", text: $attributionNote, axis: .vertical)
                        .lineLimit(2...5)
                } header: {
                    Text("Attribution (Optional)")
                } footer: {
                    Text("Add your name and contact information if you'd like to be credited")
                }
            }
            .navigationTitle("Submit a Law")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Submit") {
                        Task {
                            await submitLaw()
                        }
                    }
                    .disabled(!isFormValid || viewModel.isSubmitting)
                }
            }
            .overlay {
                if viewModel.isSubmitting {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()

                    VStack(spacing: Constants.UI.spacingM) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Submitting...")
                            .font(.headline)
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                            .fill(Color(.systemBackground))
                    )
                    .shadow(radius: 10)
                }
            }
            .alert("Success!", isPresented: $showingSuccess) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("Your law has been submitted and is pending review. Thank you for your contribution!")
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                if let error = viewModel.error {
                    Text(error.localizedDescription)
                }
            }
            .task {
                if viewModel.categories.isEmpty {
                    await viewModel.loadCategories()
                }
            }
        }
    }

    private var contactPlaceholder: String {
        switch contactType {
        case .none: return ""
        case .email: return "your.email@example.com"
        case .twitter: return "@username"
        case .website: return "https://yourwebsite.com"
        case .other: return "Contact information"
        }
    }

    private var isFormValid: Bool {
        !lawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func toggleCategory(_ id: Int) {
        if selectedCategories.contains(id) {
            selectedCategories.remove(id)
        } else {
            selectedCategories.insert(id)
        }
    }

    private func submitLaw() async {
        let submission = LawSubmission(
            text: lawText.trimmingCharacters(in: .whitespacesAndNewlines),
            title: lawTitle.isEmpty ? nil : lawTitle.trimmingCharacters(in: .whitespacesAndNewlines),
            attributionName: attributionName.isEmpty ? nil : attributionName.trimmingCharacters(in: .whitespacesAndNewlines),
            contactType: contactType == .none ? nil : contactType.rawValue.lowercased(),
            contactValue: contactValue.isEmpty ? nil : contactValue.trimmingCharacters(in: .whitespacesAndNewlines),
            attributionNote: attributionNote.isEmpty ? nil : attributionNote.trimmingCharacters(in: .whitespacesAndNewlines),
            categoryIDs: selectedCategories.isEmpty ? nil : Array(selectedCategories)
        )

        await viewModel.submitLaw(submission)

        if viewModel.error == nil {
            showingSuccess = true
        } else {
            showingError = true
        }
    }
}

// MARK: - Submit Law ViewModel
@MainActor
class SubmitLawViewModel: ObservableObject {
    @Published var categories: [Category] = []
    @Published var isLoadingCategories = false
    @Published var isSubmitting = false
    @Published var error: Error?

    private let apiService = APIService.shared
    private let categoryRepository = CategoryRepository.shared

    func loadCategories() async {
        isLoadingCategories = true
        error = nil

        do {
            categories = try await categoryRepository.fetchCategories()
        } catch {
            self.error = error
            print("Error loading categories: \(error)")
        }

        isLoadingCategories = false
    }

    func submitLaw(_ submission: LawSubmission) async {
        isSubmitting = true
        error = nil

        do {
            _ = try await apiService.submitLaw(submission)
        } catch {
            self.error = error
            print("Error submitting law: \(error)")
        }

        isSubmitting = false
    }
}

// MARK: - Law Submission Model
struct LawSubmission: Codable {
    let text: String
    let title: String?
    let attributionName: String?
    let contactType: String?
    let contactValue: String?
    let attributionNote: String?
    let categoryIDs: [Int]?
}

#Preview {
    SubmitLawView()
}
