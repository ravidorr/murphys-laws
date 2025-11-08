//
//  HomeView.swift
//  MurphysLaws
//
//  Home screen with Law of the Day
//

import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    @State private var showingLawDetail = false
    @State private var selectedLaw: Law?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Constants.UI.spacingL) {
                    // Law of the Day
                    if let lawOfDay = viewModel.lawOfTheDay {
                        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                            Text("Law of the Day")
                                .font(.title2)
                                .fontWeight(.bold)

                            LawOfDayCard(law: lawOfDay) {
                                selectedLaw = lawOfDay
                                showingLawDetail = true
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Top Voted Section
                    if !viewModel.topVotedLaws.isEmpty {
                        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                            Text("Top Voted Laws")
                                .font(.title3)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Constants.UI.spacingM) {
                                    ForEach(viewModel.topVotedLaws) { law in
                                        LawCard(law: law)
                                            .frame(width: 300)
                                            .onTapGesture {
                                                selectedLaw = law
                                                showingLawDetail = true
                                            }
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }

                    // Recently Added Section
                    if !viewModel.recentlyAdded.isEmpty {
                        VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                            Text("Recently Added")
                                .font(.title3)
                                .fontWeight(.semibold)
                                .padding(.horizontal)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Constants.UI.spacingM) {
                                    ForEach(viewModel.recentlyAdded) { law in
                                        LawCard(law: law)
                                            .frame(width: 300)
                                            .onTapGesture {
                                                selectedLaw = law
                                                showingLawDetail = true
                                            }
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Murphy's Laws")
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                if viewModel.lawOfTheDay == nil {
                    await viewModel.loadHomeData()
                }
            }
            .sheet(isPresented: $showingLawDetail) {
                if let law = selectedLaw {
                    NavigationStack {
                        LawDetailView(lawID: law.id)
                    }
                }
            }
            .overlay {
                if viewModel.isLoadingLawOfDay && viewModel.lawOfTheDay == nil {
                    ProgressView("Loading...")
                }
            }
            .overlay {
                if let errorMessage = viewModel.errorMessage, viewModel.lawOfTheDay == nil {
                    EmptyStateView(
                        title: "Error Loading Data",
                        systemImage: "exclamationmark.triangle",
                        description: errorMessage
                    )
                }
            }
        }
    }
}

#Preview {
    HomeView()
        .environmentObject(VotingService.shared)
}
