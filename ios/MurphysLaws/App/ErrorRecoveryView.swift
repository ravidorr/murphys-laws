//
//  ErrorRecoveryView.swift
//  MurphysLaws
//
//  Reusable error view with recovery actions
//

import SwiftUI

struct ErrorRecoveryView: View {
    let error: Error
    let retryAction: () async -> Void
    
    @State private var isRetrying = false
    @EnvironmentObject private var networkMonitor: NetworkMonitor
    
    var body: some View {
        VStack(spacing: Constants.UI.spacingL) {
            Image(systemName: errorIcon)
                .font(.system(size: 64))
                .foregroundColor(errorColor)
            
            VStack(spacing: Constants.UI.spacingS) {
                Text(errorTitle)
                    .dsTypography(DS.Typography.h3)
                    .foregroundColor(DS.Color.fg)
                
                Text(errorMessage)
                    .dsTypography(DS.Typography.bodySm)
                    .foregroundColor(DS.Color.mutedFg)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            if !networkMonitor.isConnected {
                HStack(spacing: Constants.UI.spacingS) {
                    Image(systemName: "wifi.slash")
                        .foregroundColor(DS.Color.error)
                    Text("No internet connection")
                        .dsTypography(DS.Typography.caption)
                        .foregroundColor(DS.Color.error)
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                        .fill(DS.Color.errorBg)
                )
            }
            
            VStack(spacing: Constants.UI.spacingS) {
                Button {
                    Task {
                        isRetrying = true
                        await retryAction()
                        isRetrying = false
                    }
                } label: {
                    HStack {
                        if isRetrying {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: DS.Color.btnPrimaryFg))
                        } else {
                            Image(systemName: "arrow.clockwise")
                        }
                        Text("Try Again")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(DS.Color.btnPrimaryBg)
                    .foregroundColor(DS.Color.btnPrimaryFg)
                    .cornerRadius(Constants.UI.cornerRadiusM)
                }
                .disabled(isRetrying || !networkMonitor.isConnected)
                
                if errorSuggestions.count > 0 {
                    VStack(alignment: .leading, spacing: Constants.UI.spacingS) {
                        Text("Try these solutions:")
                            .dsTypography(DS.Typography.caption)
                            .foregroundColor(DS.Color.mutedFg)
                        
                        ForEach(errorSuggestions, id: \.self) { suggestion in
                            HStack(alignment: .top, spacing: Constants.UI.spacingS) {
                                Text("•")
                                    .foregroundColor(DS.Color.mutedFg)
                                Text(suggestion)
                                    .dsTypography(DS.Typography.caption)
                                    .foregroundColor(DS.Color.mutedFg)
                            }
                        }
                    }
                    .padding()
                    .background(
                        RoundedRectangle(cornerRadius: Constants.UI.cornerRadiusM)
                            .fill(DS.Color.surface)
                    )
                }
            }
        }
        .padding()
    }
    
    private var errorIcon: String {
        if !networkMonitor.isConnected {
            return "wifi.slash"
        }
        
        switch error {
        case let apiError as APIError:
            switch apiError {
            case .networkError:
                return "exclamationmark.icloud"
            case .invalidURL, .invalidResponse:
                return "link.badge.plus"
            case .decodingError:
                return "doc.text.fill.badge.questionmark"
            case .serverError:
                return "server.rack"
            case .rateLimitExceeded:
                return "clock.badge.exclamationmark"
            case .noData:
                return "tray"
            }
        default:
            return "exclamationmark.triangle"
        }
    }
    
    private var errorColor: Color {
        if !networkMonitor.isConnected {
            return DS.Color.error
        }
        return DS.Color.orangeText
    }
    
    private var errorTitle: String {
        if !networkMonitor.isConnected {
            return "No Connection"
        }
        
        switch error {
        case let apiError as APIError:
            switch apiError {
            case .networkError:
                return "Network Error"
            case .invalidURL, .invalidResponse:
                return "Invalid Request"
            case .decodingError:
                return "Data Error"
            case .serverError(let code, _):
                return "Server Error (\(code))"
            case .rateLimitExceeded:
                return "Too Many Requests"
            case .noData:
                return "No Data"
            }
        default:
            return "Something Went Wrong"
        }
    }
    
    private var errorMessage: String {
        error.localizedDescription
    }
    
    private var errorSuggestions: [String] {
        if !networkMonitor.isConnected {
            return [
                "Check your internet connection",
                "Make sure Wi-Fi or cellular data is enabled",
                "Try moving to a location with better signal"
            ]
        }
        
        switch error {
        case let apiError as APIError:
            switch apiError {
            case .networkError:
                return [
                    "Check your internet connection",
                    "Restart the app"
                ]
            case .rateLimitExceeded:
                return [
                    "Wait a moment before trying again",
                    "You've made too many requests in a short time"
                ]
            case .serverError:
                return [
                    "The server may be experiencing issues",
                    "Try again in a few minutes"
                ]
            default:
                return ["Try restarting the app"]
            }
        default:
            return []
        }
    }
}

#Preview("Network Error") {
    ErrorRecoveryView(
        error: APIError.networkError(URLError(.notConnectedToInternet))
    ) {
        print("Retry")
    }
    .environmentObject(NetworkMonitor.shared)
}

#Preview("Rate Limit") {
    ErrorRecoveryView(
        error: APIError.rateLimitExceeded
    ) {
        print("Retry")
    }
    .environmentObject(NetworkMonitor.shared)
}
