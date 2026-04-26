//
//  MoreView.swift
//  MurphysLaws
//
//  Settings, about, and additional features
//

import SwiftUI

struct MoreView: View {
    @EnvironmentObject private var tabCoordinator: TabNavigationCoordinator
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
                            .foregroundColor(DS.Color.btnPrimaryBg)
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
                            .foregroundColor(DS.Color.mutedFg)
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
                MarkdownContentView(page: ContentPage.about)
            }
            .sheet(isPresented: $showingPrivacy) {
                MarkdownContentView(page: ContentPage.privacy)
            }
            .sheet(isPresented: $showingTerms) {
                MarkdownContentView(page: ContentPage.terms)
            }
            .sheet(isPresented: $showingContact) {
                MarkdownContentView(page: ContentPage.contact)
            }
            .sheet(isPresented: $showingSubmit) {
                SubmitLawView()
            }
            .onChange(of: tabCoordinator.showingContact) { newValue in
                showingContact = newValue
            }
            .onChange(of: tabCoordinator.showingSubmit) { newValue in
                showingSubmit = newValue
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
                            .dsTypography(DS.Typography.display)
                            .foregroundColor(DS.Color.btnPrimaryBg)

                        Text("Murphy's Laws")
                            .dsTypography(DS.Typography.h2)
                            .fontWeight(.bold)
                            .foregroundColor(DS.Color.fg)

                        Text("If anything can go wrong, it will")
                            .dsTypography(DS.Typography.h4)
                            .foregroundColor(DS.Color.mutedFg)
                            .italic()
                    }
                    .frame(maxWidth: .infinity)
                    .padding()

                    Divider()

                    // What is Murphy's Law
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("What is Murphy's Law?")
                            .dsTypography(DS.Typography.h3)
                            .fontWeight(.bold)
                            .foregroundColor(DS.Color.fg)

                        Text("""
                        Murphy's Law is an adage that states: "Anything that can go wrong will go wrong." \
                        It was named after Edward A. Murphy Jr., an American aerospace engineer who worked on safety-critical systems.

                        The law has inspired countless variations, corollaries, and humorous observations about life, technology, \
                        and human nature. This app collects and shares these laws, allowing you to browse, vote on your favorites, \
                        and even calculate the probability of your own tasks going wrong!
                        """)
                        .dsTypography(DS.Typography.bodyMd)
                        .foregroundColor(DS.Color.fg)
                    }
                    .padding(.horizontal)

                    Divider()

                    // Features
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Features")
                            .dsTypography(DS.Typography.h3)
                            .fontWeight(.bold)
                            .foregroundColor(DS.Color.fg)

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
                            .dsTypography(DS.Typography.h3)
                            .fontWeight(.bold)
                            .foregroundColor(DS.Color.fg)

                        Text("""
                        This app is a labor of love, collecting Murphy's Laws and their variations from various sources. \
                        Many laws have been contributed by users like you!

                        If you have a Murphy's Law variation to share, please use the Submit feature to contribute.
                        """)
                        .dsTypography(DS.Typography.bodyMd)
                        .foregroundColor(DS.Color.fg)
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
                .dsTypography(DS.Typography.h3)
                .foregroundColor(DS.Color.btnPrimaryBg)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: DS.Spacing.s1) {
                Text(title)
                    .dsTypography(DS.Typography.h4)
                    .foregroundColor(DS.Color.fg)

                Text(description)
                    .dsTypography(DS.Typography.bodySm)
                    .foregroundColor(DS.Color.mutedFg)
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
