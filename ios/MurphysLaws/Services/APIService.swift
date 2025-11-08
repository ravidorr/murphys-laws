//
//  APIService.swift
//  MurphysLaws
//
//  API client for communicating with the backend
//

import Foundation

enum APIError: LocalizedError {
    case networkError(Error)
    case invalidURL
    case invalidResponse
    case decodingError(Error)
    case serverError(Int, String?)
    case rateLimitExceeded
    case noData

    var errorDescription: String? {
        switch self {
        case .networkError(let error):
            return "Network connection failed: \(error.localizedDescription)"
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .decodingError(let error):
            return "Failed to parse data: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return message ?? "Server error: \(code)"
        case .rateLimitExceeded:
            return "Too many requests. Please try again later."
        case .noData:
            return "No data received from server"
        }
    }
}

class APIService: ObservableObject {
    static let shared = APIService()

    private let baseURL = Constants.API.baseURL
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    private init() {}

    // MARK: - Response Models
    struct LawsResponse: Codable {
        let data: [Law]
        let total: Int
        let limit: Int
        let offset: Int
    }
    
    struct LawDetailResponse: Codable {
        let law: Law
    }
    
    struct LawOfDayResponse: Codable {
        let law: Law
        let featuredDate: String?
        
        enum CodingKeys: String, CodingKey {
            case law
            case featuredDate = "featured_date"
        }
    }
    
    struct CategoriesResponse: Codable {
        let data: [Category]
    }
    
    struct AttributionsResponse: Codable {
        let data: [Attribution]
    }

    // MARK: - Generic Request Method
    private func request<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        headers: [String: String]? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(DeviceInfo.deviceID, forHTTPHeaderField: "X-Device-ID")
        
        // Add API key if available
        if let apiKey = Constants.API.apiKey {
            request.setValue(apiKey, forHTTPHeaderField: "X-API-Key")
        }

        // Add custom headers
        headers?.forEach { key, value in
            request.setValue(value, forHTTPHeaderField: key)
        }

        // Add body for POST/PUT
        if let body = body {
            request.httpBody = body
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            // Handle HTTP status codes
            switch httpResponse.statusCode {
            case 200...299:
                break
            case 429:
                throw APIError.rateLimitExceeded
            case 400...499:
                let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)
                throw APIError.serverError(httpResponse.statusCode, errorMessage?["error"])
            case 500...599:
                throw APIError.serverError(httpResponse.statusCode, "Server error")
            default:
                throw APIError.serverError(httpResponse.statusCode, nil)
            }

            do {
                let decoded = try decoder.decode(T.self, from: data)
                return decoded
            } catch {
                print("Decoding error: \(error)")
                print("Response data: \(String(data: data, encoding: .utf8) ?? "Unable to decode")")
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Laws Endpoints
    func fetchLaws(
        limit: Int = Constants.API.defaultLimit,
        offset: Int = 0,
        query: String? = nil,
        categoryID: Int? = nil,
        attributionID: Int? = nil,
        sort: String = "score",
        order: String = "desc"
    ) async throws -> LawsResponse {
        var components = URLComponents(string: "\(baseURL)\(Constants.API.laws)")!
        components.queryItems = [
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "offset", value: "\(offset)"),
            URLQueryItem(name: "sort", value: sort),
            URLQueryItem(name: "order", value: order)
        ]

        if let query = query, !query.isEmpty {
            components.queryItems?.append(URLQueryItem(name: "q", value: query))
        }

        if let categoryID = categoryID {
            components.queryItems?.append(URLQueryItem(name: "category_id", value: "\(categoryID)"))
        }

        if let attributionID = attributionID {
            components.queryItems?.append(URLQueryItem(name: "attribution_id", value: "\(attributionID)"))
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try decoder.decode(LawsResponse.self, from: data)
            return response
        } catch {
            throw APIError.decodingError(error)
        }
    }

    func fetchLawDetail(id: Int) async throws -> Law {
        let response: LawDetailResponse = try await request(
            endpoint: "\(Constants.API.laws)/\(id)"
        )
        return response.law
    }

    func fetchLawOfDay() async throws -> LawOfDayResponse {
        return try await request(endpoint: Constants.API.lawOfDay)
    }

    // MARK: - Voting Endpoints
    func voteLaw(id: Int, voteType: VoteType) async throws -> VoteResponse {
        let voteRequest = VoteRequest(voteType: voteType)
        let body = try encoder.encode(voteRequest)

        return try await request(
            endpoint: "\(Constants.API.laws)/\(id)/vote",
            method: "POST",
            body: body
        )
    }

    func removeVote(lawID: Int) async throws -> VoteResponse {
        return try await request(
            endpoint: "\(Constants.API.laws)/\(lawID)/vote",
            method: "DELETE"
        )
    }

    // MARK: - Categories Endpoints
    func fetchCategories() async throws -> [Category] {
        print("🌐 APIService.fetchCategories: Making API request to \(Constants.API.categories)")
        let response: CategoriesResponse = try await request(
            endpoint: Constants.API.categories
        )
        print("✅ APIService.fetchCategories: Received response with \(response.data.count) categories")
        return response.data
    }

    // MARK: - Attributions Endpoints
    func fetchAttributions() async throws -> [Attribution] {
        let response: AttributionsResponse = try await request(
            endpoint: Constants.API.attributions
        )
        return response.data
    }

    // MARK: - Submit Law Endpoint
    struct SubmitLawRequest: Codable {
        let text: String
        let title: String?
        let categoryID: Int
        let authorName: String?
        let authorEmail: String?
        let isAnonymous: Bool

        enum CodingKeys: String, CodingKey {
            case text, title
            case categoryID = "category_id"
            case authorName = "author_name"
            case authorEmail = "author_email"
            case isAnonymous = "is_anonymous"
        }
    }

    struct SubmitLawResponse: Codable {
        let success: Bool
        let message: String
        let lawID: Int?

        enum CodingKeys: String, CodingKey {
            case success, message
            case lawID = "law_id"
        }
    }

    func submitLaw(
        text: String,
        title: String?,
        categoryID: Int,
        authorName: String?,
        authorEmail: String?,
        isAnonymous: Bool
    ) async throws -> SubmitLawResponse {
        let submitRequest = SubmitLawRequest(
            text: text,
            title: title,
            categoryID: categoryID,
            authorName: isAnonymous ? nil : authorName,
            authorEmail: isAnonymous ? nil : authorEmail,
            isAnonymous: isAnonymous
        )

        let body = try encoder.encode(submitRequest)

        return try await request(
            endpoint: Constants.API.laws,
            method: "POST",
            body: body
        )
    }

    // MARK: - Share Calculation Endpoint
    struct ShareCalculationRequest: Codable {
        let email: String
        let urgency: Int
        let complexity: Int
        let importance: Int
        let skillLevel: Int
        let frequency: Int
        let probability: Double

        enum CodingKeys: String, CodingKey {
            case email, urgency, complexity, importance, probability
            case skillLevel = "skill_level"
            case frequency
        }
    }

    struct ShareCalculationResponse: Codable {
        let success: Bool
        let message: String
    }

    func shareCalculation(
        email: String,
        urgency: Int,
        complexity: Int,
        importance: Int,
        skillLevel: Int,
        frequency: Int,
        probability: Double
    ) async throws -> ShareCalculationResponse {
        let shareRequest = ShareCalculationRequest(
            email: email,
            urgency: urgency,
            complexity: complexity,
            importance: importance,
            skillLevel: skillLevel,
            frequency: frequency,
            probability: probability
        )

        let body = try encoder.encode(shareRequest)

        return try await request(
            endpoint: Constants.API.shareCalculation,
            method: "POST",
            body: body
        )
    }
}

// MARK: - Device Info Helper
private enum DeviceInfo {
    static var deviceID: String {
        if let id = UserDefaults.standard.string(forKey: Constants.Storage.deviceID) {
            return id
        }

        let newID = UUID().uuidString
        UserDefaults.standard.set(newID, forKey: Constants.Storage.deviceID)
        return newID
    }
}
