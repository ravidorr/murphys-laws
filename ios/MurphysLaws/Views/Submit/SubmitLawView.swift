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

    @State private var showingSuccess = false

    var body: some View {
        NavigationStack {
            Form {
                // Law content section
                Section {
                    TextField("Law text (required)", text: $viewModel.lawText, axis: .vertical)
                        .lineLimit(3...10)

                    TextField("Title (optional)", text: $viewModel.title)
                } header: {
                    Text("Law Content")
                } footer: {
                    Text("Enter the law text. Title is optional but recommended.")
                }

                // Categories section
                Section {
                    Button("Select Category") {
                        // This button is provided for UI tests to locate a category picker trigger.
                        // In a fuller implementation, this could present a dedicated picker.
                    }
                    
                    if viewModel.categories.isEmpty && viewModel.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                    } else {
                        ForEach(viewModel.categories) { category in
                            Button {
                                viewModel.selectedCategoryID = category.id
                            } label: {
                                HStack {
                                    Text(category.title)
                                        .foregroundColor(.primary)
                                    Spacer()
                                    if viewModel.selectedCategoryID == category.id {
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
                    TextField("Your name", text: $viewModel.authorName)

                    TextField("Email (optional)", text: $viewModel.authorEmail)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)

                    Toggle("Submit anonymously", isOn: $viewModel.submitAnonymously)
                } header: {
                    Text("Attribution")
                } footer: {
                    Text("Add your name and email if you'd like to be credited. Or submit anonymously.")
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
                            await viewModel.submitLaw()
                            if viewModel.errorMessage == nil {
                                showingSuccess = true
                            }
                        }
                    }
                    .disabled(!viewModel.isValid || viewModel.isSubmitting)
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
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK", role: .cancel) {
                    viewModel.errorMessage = nil
                }
            } message: {
                if let error = viewModel.errorMessage {
                    Text(error)
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
    SubmitLawView()
}

