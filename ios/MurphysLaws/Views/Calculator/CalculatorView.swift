//
//  CalculatorView.swift
//  MurphysLaws
//
//  Sod's Law Calculator with interactive sliders
//

import SwiftUI

struct CalculatorView: View {
    @StateObject private var viewModel = CalculatorViewModel()
    @State private var showingShareSheet = false
    @State private var showingEmailForm = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Constants.UI.spacingL) {
                    // Header section
                    VStack(spacing: Constants.UI.spacingM) {
                        Text("Sod's Law Calculator")
                            .dsTypography(DS.Typography.h2)
                            .fontWeight(.bold)
                            .foregroundColor(DS.Color.fg)

                        Text("Calculate the probability of your task going wrong")
                            .dsTypography(DS.Typography.bodySm)
                            .foregroundColor(DS.Color.mutedFg)
                            .multilineTextAlignment(.center)
                    }
                    .padding()

                    // Result card
                    VStack(spacing: Constants.UI.spacingM) {
                        Text("\(viewModel.riskLevel.emoji)")
                            .dsTypography(DS.Typography.display)

                        Text("\(String(format: "%.1f", viewModel.probability))%")
                            .dsTypography(DS.Typography.display)
                            .foregroundColor(riskColor)

                        Text(viewModel.riskLevel.description)
                            .dsTypography(DS.Typography.h4)
                            .foregroundColor(DS.Color.mutedFg)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusL)
                            .fill(riskColor.opacity(0.1))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusL)
                            .stroke(riskColor.opacity(0.3), lineWidth: 2)
                    )
                    .padding(.horizontal)

                    // Input sliders
                    VStack(spacing: Constants.UI.spacingL) {
                        ParameterSlider(
                            title: "Urgency",
                            icon: "clock.fill",
                            value: $viewModel.urgency,
                            description: "How urgent is this task?"
                        )

                        ParameterSlider(
                            title: "Complexity",
                            icon: "puzzlepiece.fill",
                            value: $viewModel.complexity,
                            description: "How complex is this task?"
                        )

                        ParameterSlider(
                            title: "Importance",
                            icon: "star.fill",
                            value: $viewModel.importance,
                            description: "How important is this task?"
                        )

                        ParameterSlider(
                            title: "Skill Level",
                            icon: "graduationcap.fill",
                            value: $viewModel.skillLevel,
                            description: "Your skill level for this task"
                        )

                        ParameterSlider(
                            title: "Frequency",
                            icon: "repeat.circle.fill",
                            value: $viewModel.frequency,
                            description: "How often do you do this?"
                        )
                    }
                    .padding(.horizontal)

                    // Formula section
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        HStack {
                            Text("Formula")
                                .dsTypography(DS.Typography.h4)
                                .foregroundColor(DS.Color.fg)
                            Spacer()
                            Text("Swipe to view →")
                                .dsTypography(DS.Typography.caption)
                                .foregroundColor(DS.Color.mutedFg)
                        }

                        VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                MathFormulaView(viewModel.formulaString, fontSize: 16)
                                    .padding()
                            }
                            .background(DS.Color.surface)
                            .cornerRadius(Constants.UI.cornerRadiusM)

                            Text("With your values:")
                                .dsTypography(DS.Typography.caption)
                                .foregroundColor(DS.Color.mutedFg)

                            ScrollView(.horizontal, showsIndicators: false) {
                                MathFormulaView(viewModel.formulaWithValues, fontSize: 14)
                                    .padding()
                            }
                            .background(DS.Color.surface)
                            .cornerRadius(Constants.UI.cornerRadiusM)
                        }
                    }
                    .padding()

                    // Action buttons
                    VStack(spacing: Constants.UI.spacingM) {
                        Button {
                            showingShareSheet = true
                        } label: {
                            Label("Share Results", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(DS.Color.btnPrimaryBg)
                                .foregroundColor(DS.Color.btnPrimaryFg)
                                .cornerRadius(Constants.UI.cornerRadiusM)
                        }

                        Button {
                            showingEmailForm = true
                        } label: {
                            Label("Email Results", systemImage: "envelope.fill")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(DS.Color.surface)
                                .foregroundColor(DS.Color.fg)
                                .cornerRadius(Constants.UI.cornerRadiusM)
                        }

                        Button {
                            viewModel.reset()
                        } label: {
                            Label("Reset", systemImage: "arrow.counterclockwise")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(DS.Color.surface)
                                .foregroundColor(DS.Color.fg)
                                .cornerRadius(Constants.UI.cornerRadiusM)
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
            .navigationTitle("Calculator")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingShareSheet) {
                ShareSheet(activityItems: [viewModel.shareText])
            }
            .sheet(isPresented: $showingEmailForm) {
                EmailFormView(viewModel: viewModel)
            }
            .onChange(of: viewModel.urgency) { _ in viewModel.calculate() }
            .onChange(of: viewModel.complexity) { _ in viewModel.calculate() }
            .onChange(of: viewModel.importance) { _ in viewModel.calculate() }
            .onChange(of: viewModel.skillLevel) { _ in viewModel.calculate() }
            .onChange(of: viewModel.frequency) { _ in viewModel.calculate() }
        }
    }

    private var riskColor: Color {
        switch viewModel.riskLevel {
        case .low: return DS.Color.riskLow
        case .medium: return DS.Color.riskMedium
        case .high: return DS.Color.riskHigh
        }
    }
}

// MARK: - Parameter Slider Component
struct ParameterSlider: View {
    let title: String
    let icon: String
    @Binding var value: Double
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(DS.Color.btnPrimaryBg)
                Text(title)
                    .dsTypography(DS.Typography.h4)
                    .foregroundColor(DS.Color.fg)
                Spacer()
                Text("\(Int(value))")
                    .dsTypography(DS.Typography.h4)
                    .fontWeight(.semibold)
                    .foregroundColor(DS.Color.btnPrimaryBg)
                    .frame(minWidth: 30)
            }

            Slider(value: $value, in: 1...10, step: 1)
                .tint(DS.Color.btnPrimaryBg)
                .accessibilityIdentifier("\(title) Slider")

            Text(description)
                .dsTypography(DS.Typography.caption)
                .foregroundColor(DS.Color.mutedFg)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                .fill(DS.Color.surface)
        )
    }
}

// MARK: - Email Form View
struct EmailFormView: View {
    @ObservedObject var viewModel: CalculatorViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var showingError = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Email address", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                } header: {
                    Text("Send results to")
                } footer: {
                    Text("Your calculation results will be sent to this email address")
                }

                Section {
                    VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
                        Text("Probability: \(String(format: "%.1f", viewModel.probability))%")
                        Text("Risk Level: \(viewModel.riskLevel.rawValue)")
                        Text("Urgency: \(Int(viewModel.urgency))")
                        Text("Complexity: \(Int(viewModel.complexity))")
                        Text("Importance: \(Int(viewModel.importance))")
                        Text("Skill Level: \(Int(viewModel.skillLevel))")
                        Text("Frequency: \(Int(viewModel.frequency))")
                    }
                    .dsTypography(DS.Typography.caption)
                    .foregroundColor(DS.Color.mutedFg)
                } header: {
                    Text("Preview")
                }
            }
            .navigationTitle("Email Results")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Send") {
                        Task {
                            await sendEmail()
                        }
                    }
                    .disabled(email.isEmpty || viewModel.isSharing)
                }
            }
            .alert("Error", isPresented: $showingError) {
                Button("OK", role: .cancel) { }
            } message: {
                if let error = viewModel.shareError {
                    Text(error.localizedDescription)
                }
            }
        }
    }

    private func sendEmail() async {
        await viewModel.shareViaEmail(to: email)

        if viewModel.shareError == nil {
            dismiss()
        } else {
            showingError = true
        }
    }
}

// MARK: - Share Sheet Wrapper
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    CalculatorView()
}
