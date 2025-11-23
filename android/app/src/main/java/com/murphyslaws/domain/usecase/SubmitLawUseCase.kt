package com.murphyslaws.domain.usecase

import com.murphyslaws.domain.repository.LawRepository
import javax.inject.Inject

/**
 * Use case for submitting a new law
 */
class SubmitLawUseCase @Inject constructor(
    private val repository: LawRepository
) {
    
    /**
     * Submit a new law
     * @param text Law text (required)
     * @param title Law title (optional)
     * @param name Author name (optional)
     * @param email Author email (optional)
     * @return Result indicating success or failure
     */
    suspend operator fun invoke(
        text: String,
        title: String? = null,
        name: String? = null,
        email: String? = null
    ): Result<Unit> {
        if (text.isBlank()) {
            return Result.failure(IllegalArgumentException("Law text cannot be empty"))
        }
        
        return repository.submitLaw(
            text = text.trim(),
            title = title?.trim()?.takeIf { it.isNotBlank() },
            name = name?.trim()?.takeIf { it.isNotBlank() },
            email = email?.trim()?.takeIf { it.isNotBlank() }
        )
    }
}
