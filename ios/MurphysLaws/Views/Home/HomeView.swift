//
//  HomeView.swift
//  MurphysLaws
//
//  Home screen with Law of the Day
//

import SwiftUI

struct HomeView: View {
    @StateObject private var viewModel = HomeViewModel()
    @State private var selectedLaw: Law?

    var body: some View {
        NavigationStack {
            // Always show content immediately - no conditional rendering at the top level
            ScrollView {
                VStack(spacing: Constants.UI.spacingL) {
                    // Law of the Day - Show skeleton or actual content
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Law of the Day")
                            .font(.title2)
                            .fontWeight(.bold)
                        
                        if let lawOfDay = viewModel.lawOfTheDay {
                            LawOfDayCard(law: lawOfDay) {
                                selectedLaw = lawOfDay
                            }
                        } else {
                            // Always show skeleton when no data
                            SkeletonLawOfDayCard()
                        }
                    }
                    .padding(.horizontal)

                    // Top Voted Section - Show skeleton or actual content
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Top Voted Laws")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: Constants.UI.spacingM) {
                                if !viewModel.topVotedLaws.isEmpty {
                                    ForEach(viewModel.topVotedLaws) { law in
                                        LawCard(law: law)
                                            .frame(width: 300)
                                            .onTapGesture {
                                                selectedLaw = law
                                            }
                                    }
                                } else {
                                    // Always show skeleton cards when no data
                                    ForEach(0..<3, id: \.self) { _ in
                                        SkeletonLawCard()
                                            .frame(width: 300)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Recently Added Section - Show skeleton or actual content
                    VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                        Text("Recently Added")
                            .font(.title3)
                            .fontWeight(.semibold)
                            .padding(.horizontal)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: Constants.UI.spacingM) {
                                if !viewModel.recentlyAdded.isEmpty {
                                    ForEach(viewModel.recentlyAdded) { law in
                                        LawCard(law: law)
                                            .frame(width: 300)
                                            .onTapGesture {
                                                selectedLaw = law
                                            }
                                    }
                                } else {
                                    // Always show skeleton cards when no data
                                    ForEach(0..<3, id: \.self) { _ in
                                        SkeletonLawCard()
                                            .frame(width: 300)
                                    }
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            .background(Color(uiColor: .systemBackground))
            .navigationTitle("Murphy's Laws")
            .refreshable {
                await viewModel.refresh()
            }
            .task {
                await viewModel.loadHomeData()
            }
            .sheet(item: $selectedLaw) { law in
                NavigationStack {
                    LawDetailView(lawID: law.id, law: law)
                        .id(law.id)  // Force view recreation for each law
                }
            }
            .overlay {
                if let errorMessage = viewModel.errorMessage, viewModel.lawOfTheDay == nil && !viewModel.isLoadingLawOfDay {
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

#Preview("Home View") {
    HomeView()
        .environmentObject(VotingService.shared)
}

#Preview("Loading State with Skeletons") {
    NavigationStack {
        ScrollView {
            VStack(spacing: Constants.UI.spacingL) {
                // Law of the Day Skeleton
                VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                    Text("Law of the Day")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    SkeletonLawOfDayCard()
                }
                .padding(.horizontal)
                
                // Top Voted Section Skeleton
                VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                    Text("Top Voted Laws")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Constants.UI.spacingM) {
                            ForEach(0..<3, id: \.self) { _ in
                                SkeletonLawCard()
                                    .frame(width: 300)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                // Recently Added Section Skeleton
                VStack(alignment: .leading, spacing: Constants.UI.spacingM) {
                    Text("Recently Added")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .padding(.horizontal)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Constants.UI.spacingM) {
                            ForEach(0..<3, id: \.self) { _ in
                                SkeletonLawCard()
                                    .frame(width: 300)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
            }
            .padding(.vertical)
        }
        .navigationTitle("Murphy's Laws")
    }
}
