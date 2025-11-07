//
//  MarkdownContentView.swift
//  MurphysLaws
//
//  Renders shared markdown content with native SwiftUI
//

import SwiftUI

struct MarkdownContentView: View {
    let page: ContentPage
    @Environment(\.dismiss) private var dismiss

    @State private var markdownContent: AttributedString = AttributedString("")
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading...")
                } else if let error = error {
                    errorView(error)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                            // Show last updated date if available
                            if let lastUpdated = SharedContentLoader.shared.getLastUpdated(for: page) {
                                Text("Last updated: \(lastUpdated)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal)
                            }

                            // Render markdown content
                            Text(markdownContent)
                                .padding(.horizontal)
                                .textSelection(.enabled)
                        }
                        .padding(.vertical)
                    }
                }
            }
            .navigationTitle(page.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadContent()
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Constants.UI.spacingM) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Content Unavailable")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
    }

    private func loadContent() {
        isLoading = true
        error = nil

        // Load markdown content from shared directory
        guard let content = SharedContentLoader.shared.loadContent(for: page) else {
            error = "Could not load \(page.title) content. Please try again later."
            isLoading = false
            return
        }

        // Convert markdown string to AttributedString
        do {
            markdownContent = try AttributedString(
                markdown: content,
                options: AttributedString.MarkdownParsingOptions(
                    interpretedSyntax: .inlineOnlyPreservingWhitespace
                )
            )
            isLoading = false
        } catch {
            self.error = "Could not parse \(page.title) content: \(error.localizedDescription)"
            isLoading = false
        }
    }
}

#Preview("About") {
    MarkdownContentView(page: .about)
}

#Preview("Privacy") {
    MarkdownContentView(page: .privacy)
}

#Preview("Terms") {
    MarkdownContentView(page: .terms)
}

#Preview("Contact") {
    MarkdownContentView(page: .contact)
}
