//
//  HomeViewModel.swift
//  MurphysLaws
//
//  ViewModel for home screen with Law of the Day
//

import Foundation

@MainActor
class HomeViewModel: ObservableObject {
    @Published var lawOfTheDay: Law?
    @Published var topVotedLaws: [Law] = []
    @Published var trendingLaws: [Law] = []
    @Published var recentlyAdded: [Law] = []
    @Published var isLoadingLawOfDay = false
    @Published var errorMessage: String?

    private let repository: LawRepository

    init(repository: LawRepository = LawRepository()) {
        self.repository = repository
    }

    // MARK: - Load Law of the Day
    func loadLawOfTheDay() async {
        isLoadingLawOfDay = true
        errorMessage = nil

        do {
            let lawOfDayResponse = try await repository.fetchLawOfDay()
            lawOfTheDay = lawOfDayResponse.law
        } catch {
            errorMessage = error.localizedDescription
            print("Error loading law of the day: \(error)")
        }

        isLoadingLawOfDay = false
    }

    // MARK: - Load Top Voted Laws
    func loadTopVotedLaws() async {
        do {
            let response = try await repository.fetchLaws(
                limit: 5,
                offset: 0,
                sort: "score",
                order: "desc"
            )
            topVotedLaws = response.data
        } catch {
            errorMessage = error.localizedDescription
            print("Error loading top voted laws: \(error)")
        }
    }

    // MARK: - Load Trending Laws
    func loadTrendingLaws() async {
        do {
            let response = try await repository.fetchLaws(
                limit: 5,
                offset: 0,
                sort: "trending",
                order: "desc"
            )
            trendingLaws = response.data
        } catch {
            errorMessage = error.localizedDescription
            print("Error loading trending laws: \(error)")
        }
    }

    // MARK: - Load Recently Added Laws
    func loadRecentlyAdded() async {
        do {
            let response = try await repository.fetchLaws(
                limit: 5,
                offset: 0,
                sort: "created_at",
                order: "desc"
            )
            recentlyAdded = response.data
        } catch {
            errorMessage = error.localizedDescription
            print("Error loading recently added laws: \(error)")
        }
    }

    // MARK: - Load Home Data
    func loadHomeData() async {
        await loadLawOfTheDay()
        await loadTopVotedLaws()
        await loadRecentlyAdded()
    }

    // MARK: - Refresh All
    func refreshAll() async {
        await loadLawOfTheDay()
        await loadTopVotedLaws()
        await loadTrendingLaws()
    }

    // MARK: - Refresh
    func refresh() async {
        await loadHomeData()
    }
}
