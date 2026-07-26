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
                VStack(spacing: DS.Spacing.s6) {
                    // Header section
                    VStack(spacing: DS.Spacing.s4) {
                        DSHeading("Sod's Law Calculator")

                        Text("Calculate the probability of your task going wrong")
                            .dsTypography(DS.Typography.bodySm)
                            .foregroundColor(DS.Color.mutedFg)
                            .multilineTextAlignment(.center)
                    }
                    .padding()

                    // Result card
                    VStack(spacing: DS.Spacing.s4) {
                        Image(systemName: riskPresentation.symbolName)
                            .dsTypography(DS.Typography.display)
                            .foregroundStyle(riskPresentation.color)
                            .accessibilityHidden(true)

                        Text("\(String(format: "%.1f", viewModel.probability))%")
                            .dsTypography(DS.Typography.display)
                            .foregroundColor(riskPresentation.color)

                        Text(riskPresentation.description)
                            .dsTypography(DS.Typography.h4)
                            .foregroundColor(DS.Color.mutedFg)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: DS.Radius.xl)
                            .fill(riskPresentation.color.opacity(DS.Opacity.faint))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: DS.Radius.xl)
                            .stroke(
                                riskPresentation.color.opacity(DS.Opacity.muted),
                                lineWidth: DS.Border.strong
                            )
                    )
                    .padding(.horizontal)

                    // Input sliders
                    VStack(spacing: DS.Spacing.s6) {
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
                    VStack(alignment: .leading, spacing: DS.Spacing.s4) {
                        HStack {
                            Text("Formula")
                                .dsTypography(DS.Typography.h4)
                                .foregroundColor(DS.Color.fg)
                            Spacer()
                            Text("Swipe to view →")
                                .dsTypography(DS.Typography.caption)
                                .foregroundColor(DS.Color.mutedFg)
                        }

                        VStack(alignment: .leading, spacing: DS.Spacing.s2) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                MathFormulaView(viewModel.formulaString)
                                    .padding()
                            }
                            .background(DS.Color.surface)
                            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl))

                            Text("With your values:")
                                .dsTypography(DS.Typography.caption)
                                .foregroundColor(DS.Color.mutedFg)

                            ScrollView(.horizontal, showsIndicators: false) {
                                MathFormulaView(viewModel.formulaWithValues, size: .bodySm)
                                    .padding()
                            }
                            .background(DS.Color.surface)
                            .clipShape(RoundedRectangle(cornerRadius: DS.Radius.xl))
                        }
                    }
                    .padding()

                    // Action buttons
                    VStack(spacing: DS.Spacing.s4) {
                        Button {
                            showingShareSheet = true
                        } label: {
                            Label("Share Results", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(DSButtonStyle())

                        Button {
                            showingEmailForm = true
                        } label: {
                            Label("Email Results", systemImage: "envelope.fill")
                        }
                        .buttonStyle(DSButtonStyle(.secondary))

                        Button {
                            viewModel.reset()
                        } label: {
                            Label("Reset", systemImage: "arrow.counterclockwise")
                        }
                        .buttonStyle(DSButtonStyle(.secondary))
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
            .onChange(of: viewModel.urgency) { _, _ in viewModel.calculate() }
            .onChange(of: viewModel.complexity) { _, _ in viewModel.calculate() }
            .onChange(of: viewModel.importance) { _, _ in viewModel.calculate() }
            .onChange(of: viewModel.skillLevel) { _, _ in viewModel.calculate() }
            .onChange(of: viewModel.frequency) { _, _ in viewModel.calculate() }
        }
    }

    private var riskPresentation: CalculatorRiskPresentation {
        CalculatorRiskPresentation(viewModel.riskLevel)
    }
}

struct CalculatorRiskPresentation {
    let color: Color
    let symbolName: String
    let description: String

    init(_ riskLevel: CalculatorViewModel.RiskLevel) {
        switch riskLevel {
        case .low:
            color = DS.Color.riskLow
            symbolName = "checkmark.circle.fill"
            description = "Low risk of failure"
        case .medium:
            color = DS.Color.riskMedium
            symbolName = "exclamationmark.triangle.fill"
            description = "Moderate risk of failure"
        case .high:
            color = DS.Color.riskHigh
            symbolName = "xmark.octagon.fill"
            description = "High risk of failure"
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
        VStack(alignment: .leading, spacing: DS.Spacing.s2) {
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
                    .frame(minWidth: DS.Layout.valueLabelWidth)
            }

            Slider(value: $value, in: 1...10, step: 1)
                .dsSlider()
                .accessibilityIdentifier("\(title) Slider")

            Text(description)
                .dsTypography(DS.Typography.caption)
                .foregroundColor(DS.Color.mutedFg)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: DS.Radius.xl)
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
                        .dsField()
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                } header: {
                    Text("Send results to")
                } footer: {
                    Text("Your calculation results will be sent to this email address")
                }

                Section {
                    VStack(alignment: .leading, spacing: DS.Spacing.s2) {
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
