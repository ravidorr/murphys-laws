//
//  LawRepository.swift
//  MurphysLaws
//
//  Repository for law data access
//

import Foundation

class LawRepository: ObservableObject {
    private let apiService = APIService.shared

    // MARK: - Fetch Laws
    func fetchLaws(
        limit: Int = Constants.API.defaultLimit,
        offset: Int = 0,
        query: String? = nil,
        categoryID: Int? = nil,
        attributionID: Int? = nil,
        sort: String = "score",
        order: String = "desc"
    ) async throws -> LawsResponse {
        return try await apiService.fetchLaws(
            limit: limit,
            offset: offset,
            query: query,
            categoryID: categoryID,
            attributionID: attributionID,
            sort: sort,
            order: order
        )
    }

    // MARK: - Fetch Law Detail
    func fetchLawDetail(id: Int) async throws -> Law {
        return try await apiService.fetchLawDetail(id: id)
    }

    // MARK: - Fetch Law of Day
    func fetchLawOfDay() async throws -> LawOfDayResponse {
        return try await apiService.fetchLawOfDay()
    }

    // MARK: - Submit Law
    func submitLaw(
        text: String,
        title: String?,
        categoryID: Int,
        authorName: String?,
        authorEmail: String?,
        isAnonymous: Bool
    ) async throws -> APIService.SubmitLawResponse {
        return try await apiService.submitLaw(
            text: text,
            title: title,
            categoryID: categoryID,
            authorName: authorName,
            authorEmail: authorEmail,
            isAnonymous: isAnonymous
        )
    }
}
