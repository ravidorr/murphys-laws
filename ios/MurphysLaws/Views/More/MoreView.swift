//
//  MoreView.swift
//  MurphysLaws
//
//  Settings, about, and additional features
//

import SwiftUI

struct MoreView: View {
    @State private var showingAbout = false
    @State private var showingPrivacy = false
    @State private var showingTerms = false
    @State private var showingContact = false
    @State private var showingSubmit = false

    var body: some View {
        NavigationStack {
            List {
                // Submit section
                Section {
                    Button {
                        showingSubmit = true
                    } label: {
                        Label("Submit a Law", systemImage: "plus.circle.fill")
                            .foregroundColor(.accentColor)
                    }
                } footer: {
                    Text("Contribute your own Murphy's Law variation")
                }

                // Information section
                Section {
                    Button {
                        showingAbout = true
                    } label: {
                        Label("About Murphy's Laws", systemImage: "info.circle")
                    }

                    Link(destination: URL(string: "https://murphys-laws.com")!) {
                        Label("Visit Website", systemImage: "safari")
                    }

                    Button {
                        showingPrivacy = true
                    } label: {
                        Label("Privacy Policy", systemImage: "hand.raised")
                    }

                    Button {
                        showingTerms = true
                    } label: {
                        Label("Terms of Service", systemImage: "doc.text")
                    }
                } header: {
                    Text("Information")
                }

                // Share section
                Section {
                    ShareLink(
                        item: URL(string: "https://murphys-laws.com")!,
                        message: Text("Check out Murphy's Laws - an archive of laws, corollaries, and calculators!")
                    ) {
                        Label("Share App", systemImage: "square.and.arrow.up")
                    }

                    Link(destination: URL(string: "https://apps.apple.com/app/id123456789")!) {
                        Label("Rate on App Store", systemImage: "star.fill")
                    }
                } header: {
                    Text("Share")
                }

                // Developer section
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }

                    Button {
                        showingContact = true
                    } label: {
                        Label("Contact Support", systemImage: "envelope")
                    }

                    Link(destination: URL(string: "mailto:contact@murphys-laws.com")!) {
                        Label("Email Us", systemImage: "paperplane")
                    }
                } header: {
                    Text("App")
                }
            }
            .navigationTitle("More")
            .sheet(isPresented: $showingAbout) {
                MarkdownContentView(page: .about)
            }
            .sheet(isPresented: $showingPrivacy) {
                MarkdownContentView(page: .privacy)
            }
            .sheet(isPresented: $showingTerms) {
                MarkdownContentView(page: .terms)
            }
            .sheet(isPresented: $showingContact) {
                MarkdownContentView(page: .contact)
            }
            .sheet(isPresented: $showingSubmit) {
                SubmitLawView()
            }
        }
    }
}

// MARK: - About View
struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Constants.UI.spacingL) {
                    // Header
                    VStack(spacing: Constants.UI.spacingM) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 72))
                            .foregroundColor(.accentColor)

                        Text("Murphy's Laws")
                            .font(.title)
                            .fontWeight(.bold)

                        Text("If anything can go wrong, it will")
                            .font(.headline)
                            .foregroundColor(.secondary)
                            .italic()
                    }
                    .frame(maxWidth: .infinity)
                    .padding()

                    Divider()

                    // What is Murphy's Law
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("What is Murphy's Law?")
                            .font(.title2)
                            .fontWeight(.bold)

                        Text("""
                        Murphy's Law is an adage that states: "Anything that can go wrong will go wrong." \
                        It was named after Edward A. Murphy Jr., an American aerospace engineer who worked on safety-critical systems.

                        The law has inspired countless variations, corollaries, and humorous observations about life, technology, \
                        and human nature. This app collects and shares these laws, allowing you to browse, vote on your favorites, \
                        and even calculate the probability of your own tasks going wrong!
                        """)
                        .font(.body)
                    }
                    .padding(.horizontal)

                    Divider()

                    // Features
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Features")
                            .font(.title2)
                            .fontWeight(.bold)

                        FeatureRow(
                            icon: "house.fill",
                            title: "Daily Law",
                            description: "Discover a new Murphy's Law every day"
                        )

                        FeatureRow(
                            icon: "list.bullet",
                            title: "Browse Laws",
                            description: "Explore the complete archive of laws and corollaries"
                        )

                        FeatureRow(
                            icon: "folder.fill",
                            title: "Categories",
                            description: "Filter laws by technology, office, daily life, and more"
                        )

                        FeatureRow(
                            icon: "function",
                            title: "Calculator",
                            description: "Calculate the probability of your task going wrong using Sod's Law formula"
                        )

                        FeatureRow(
                            icon: "arrow.up.arrow.down",
                            title: "Voting",
                            description: "Vote on your favorite laws to help others discover them"
                        )
                    }
                    .padding(.horizontal)

                    Divider()

                    // Credits
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Credits")
                            .font(.title2)
                            .fontWeight(.bold)

                        Text("""
                        This app is a labor of love, collecting Murphy's Laws and their variations from various sources. \
                        Many laws have been contributed by users like you!

                        If you have a Murphy's Law variation to share, please use the Submit feature to contribute.
                        """)
                        .font(.body)
                    }
                    .padding(.horizontal)
                    .padding(.bottom)
                }
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Feature Row Component
struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: Constants.UI.spacingM) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.accentColor)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)

                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    MoreView()
}

#Preview("About") {
    AboutView()
}
