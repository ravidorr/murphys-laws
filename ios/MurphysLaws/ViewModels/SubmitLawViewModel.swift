//
//  SubmitLawViewModel.swift
//  MurphysLaws
//
//  ViewModel for submitting new laws
//

import Foundation

@MainActor
class SubmitLawViewModel: ObservableObject {
    @Published var lawText: String = ""
    @Published var title: String = ""
    @Published var authorName: String = ""
    @Published var authorEmail: String = ""
    @Published var selectedCategoryID: Int?
    @Published var submitAnonymously: Bool = false

    @Published var categories: [Category] = []
    @Published var isLoading = false
    @Published var isSubmitting = false
    @Published var errorMessage: String?
    @Published var showSuccessAlert = false
    @Published var validationErrors: [String: String] = [:]

    private let apiService = APIService.shared
    private let categoryRepository = CategoryRepository()

    // MARK: - Initialization
    init() {
        Task {
            await loadCategories()
        }
    }

    // MARK: - Load Categories
    func loadCategories() async {
        isLoading = true

        do {
            categories = try await categoryRepository.fetchCategories()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    // MARK: - Validation
    var isValid: Bool {
        // Simple non-mutating validation for UI state
        let hasLawText = !lawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let lawTextLengthOK = lawText.count >= Constants.Validation.lawTextMinLength && lawText.count <= Constants.Validation.lawTextMaxLength
        let hasCategorySelected = selectedCategoryID != nil
        let titleLengthOK = title.isEmpty || title.count <= Constants.Validation.titleMaxLength
        let emailValid = authorEmail.isEmpty || isValidEmail(authorEmail)
        let hasAuthorInfo = submitAnonymously || !authorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        return hasLawText && lawTextLengthOK && hasCategorySelected && titleLengthOK && emailValid && hasAuthorInfo
    }

    // Validate and populate error messages
    func validate() {
        validationErrors.removeAll()

        // Validate law text
        if lawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            validationErrors["lawText"] = "Law text is required"
        } else if lawText.count < Constants.Validation.lawTextMinLength {
            validationErrors["lawText"] = "Law text must be at least \(Constants.Validation.lawTextMinLength) characters"
        } else if lawText.count > Constants.Validation.lawTextMaxLength {
            validationErrors["lawText"] = "Law text must not exceed \(Constants.Validation.lawTextMaxLength) characters"
        }

        // Validate title if provided
        if !title.isEmpty && title.count > Constants.Validation.titleMaxLength {
            validationErrors["title"] = "Title must not exceed \(Constants.Validation.titleMaxLength) characters"
        }

        // Validate category selection
        if selectedCategoryID == nil {
            validationErrors["category"] = "Please select a category"
        }

        // Validate email if provided
        if !authorEmail.isEmpty && !isValidEmail(authorEmail) {
            validationErrors["email"] = "Please enter a valid email address"
        }

        // If not submitting anonymously, require author name
        if !submitAnonymously && authorName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            validationErrors["authorName"] = "Author name is required (or check 'Submit anonymously')"
        }
    }

    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = #"^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"#
        return email.range(of: emailRegex, options: .regularExpression) != nil
    }

    // MARK: - Submit Law
    func submitLaw() async {
        validate()
        guard validationErrors.isEmpty else {
            errorMessage = validationErrors.values.first
            return
        }

        isSubmitting = true
        errorMessage = nil

        do {
            let trimmedText = lawText.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedTitle = title.isEmpty ? nil : title.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedName = authorName.isEmpty ? nil : authorName.trimmingCharacters(in: .whitespacesAndNewlines)
            let trimmedEmail = authorEmail.isEmpty ? nil : authorEmail.trimmingCharacters(in: .whitespacesAndNewlines)

            let response = try await apiService.submitLaw(
                text: trimmedText,
                title: trimmedTitle,
                categoryID: selectedCategoryID!,
                authorName: trimmedName,
                authorEmail: trimmedEmail,
                isAnonymous: submitAnonymously
            )

            isSubmitting = false

            if response.success {
                showSuccessAlert = true
                // Reset form after successful submission
                resetForm()
            } else {
                errorMessage = response.message
            }

        } catch {
            errorMessage = error.localizedDescription
            isSubmitting = false
        }
    }

    // MARK: - Reset Form
    func resetForm() {
        lawText = ""
        title = ""
        authorName = ""
        authorEmail = ""
        selectedCategoryID = nil
        submitAnonymously = false
        validationErrors.removeAll()
    }

    // MARK: - Helper Properties
    var characterCount: Int {
        lawText.count
    }

    var characterCountText: String {
        "\(characterCount) / \(Constants.Validation.lawTextMaxLength)"
    }

    var characterCountColor: String {
        if characterCount < Constants.Validation.lawTextMinLength {
            return "red"
        } else if characterCount > Constants.Validation.lawTextMaxLength {
            return "red"
        } else {
            return "secondary"
        }
    }
}
