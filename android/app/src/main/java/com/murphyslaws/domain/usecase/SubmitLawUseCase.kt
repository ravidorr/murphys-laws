package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.model.SubmitLawRequest
import com.murphyslaws.domain.model.SubmitLawResponse
import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

class SubmitLawUseCase @Inject constructor(
    private val lawRepository: LawRepository
) {
    suspend operator fun invoke(request: SubmitLawRequest): Result<SubmitLawResponse> {
        // Validate input
        if (request.text.length < 10 || request.text.length > 1000) {
            return Result.failure(IllegalArgumentException("Law text must be between 10 and 1000 characters"))
        }

        if (!request.submitAnonymously && request.authorEmail != null) {
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(request.authorEmail).matches()) {
                return Result.failure(IllegalArgumentException("Invalid email address"))
            }
        }

        return lawRepository.submitLaw(request)
    }
}
