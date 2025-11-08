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
    @Published var isLoadingLawOfDay = true  // Start as true to show skeleton immediately
    @Published var errorMessage: String?
    
    private var hasLoadedInitialData = false

    private let repository: LawRepository
    private let minimumLoadingDuration: TimeInterval = 1.0
    private let loadingTimeout: TimeInterval = 20.0

    init(repository: LawRepository = LawRepository()) {
        self.repository = repository
    }

    // MARK: - Load Law of the Day
    func loadLawOfTheDay() async {
        isLoadingLawOfDay = true
        errorMessage = nil
        
        let startTime = Date()

        do {
            // Create a timeout task
            try await withThrowingTaskGroup(of: Law.self) { group in
                // Add the actual fetch task
                group.addTask {
                    let lawOfDayResponse = try await self.repository.fetchLawOfDay()
                    return lawOfDayResponse.law
                }
                
                // Add a timeout task
                group.addTask {
                    try await Task.sleep(nanoseconds: UInt64(self.loadingTimeout * 1_000_000_000))
                    throw URLError(.timedOut)
                }
                
                // Wait for the first task to complete
                if let result = try await group.next() {
                    self.lawOfTheDay = result
                    group.cancelAll()
                } else {
                    throw URLError(.unknown)
                }
            }
        } catch is CancellationError {
            // Task was cancelled, ignore
        } catch {
            if (error as? URLError)?.code == .timedOut {
                errorMessage = "Loading took too long. Please check your connection and try again."
            } else {
                errorMessage = error.localizedDescription
            }
            print("Error loading law of the day: \(error)")
        }
        
        // Ensure minimum loading duration
        let elapsedTime = Date().timeIntervalSince(startTime)
        if elapsedTime < minimumLoadingDuration {
            let remainingTime = minimumLoadingDuration - elapsedTime
            try? await Task.sleep(nanoseconds: UInt64(remainingTime * 1_000_000_000))
        }

        isLoadingLawOfDay = false
        hasLoadedInitialData = true
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
        // Only load if we haven't loaded initial data yet
        guard !hasLoadedInitialData else { return }
        
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
        isLoadingLawOfDay = true
        await loadLawOfTheDay()
        await loadTopVotedLaws()
        await loadRecentlyAdded()
    }
}
