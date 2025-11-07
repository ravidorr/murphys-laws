//
//  HomeViewModel.swift
//  MurphysLaws
//
//  ViewModel for home screen with Law of the Day
//

import Foundation

@MainActor
class HomeViewModel: ObservableObject {
    @Published var lawOfDay: Law?
    @Published var topVoted: [Law] = []
    @Published var recentlyAdded: [Law] = []
    @Published var isLoading = false
    @Published var error: Error?

    private let lawRepository = LawRepository()

    // MARK: - Load Home Data
    func loadHomeData() async {
        isLoading = true
        error = nil

        do {
            // Load Law of the Day
            let lawOfDayResponse = try await lawRepository.fetchLawOfDay()
            lawOfDay = lawOfDayResponse.law

            // Load Top Voted Laws (optional widget)
            async let topVotedTask = lawRepository.fetchLaws(
                limit: 5,
                offset: 0,
                sort: "upvotes",
                order: "desc"
            )

            // Load Recently Added Laws (optional widget)
            async let recentTask = lawRepository.fetchLaws(
                limit: 5,
                offset: 0,
                sort: "created_at",
                order: "desc"
            )

            let (topVotedResponse, recentResponse) = try await (topVotedTask, recentTask)
            topVoted = topVotedResponse.data
            recentlyAdded = recentResponse.data

        } catch {
            self.error = error
            print("Error loading home data: \(error)")
        }

        isLoading = false
    }

    // MARK: - Refresh
    func refresh() async {
        await loadHomeData()
    }
}
