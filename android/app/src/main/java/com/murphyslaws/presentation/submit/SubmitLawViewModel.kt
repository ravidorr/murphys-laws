package com.murphyslaws.presentation.submit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.usecase.SubmitLawUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SubmitLawViewModel @Inject constructor(
    private val submitLawUseCase: SubmitLawUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(SubmitLawUiState())
    val uiState: StateFlow<SubmitLawUiState> = _uiState.asStateFlow()

    fun onTextChange(text: String) {
        _uiState.update { it.copy(text = text) }
    }

    fun onTitleChange(title: String) {
        _uiState.update { it.copy(title = title) }
    }

    fun onNameChange(name: String) {
        _uiState.update { it.copy(name = name) }
    }

    fun onEmailChange(email: String) {
        _uiState.update { it.copy(email = email) }
    }

    fun submitLaw() {
        val currentState = _uiState.value
        if (currentState.text.isBlank()) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null, success = false) }

            submitLawUseCase(
                text = currentState.text,
                title = currentState.title,
                name = currentState.name,
                email = currentState.email
            ).onSuccess {
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        success = true,
                        text = "",
                        title = "",
                        name = "",
                        email = ""
                    )
                }
            }.onFailure { error ->
                _uiState.update { 
                    it.copy(
                        isLoading = false,
                        error = error.message ?: "Failed to submit law"
                    )
                }
            }
        }
    }

    fun resetState() {
        _uiState.update { 
            it.copy(
                success = false,
                error = null,
                isLoading = false
            )
        }
    }
}

data class SubmitLawUiState(
    val text: String = "",
    val title: String = "",
    val name: String = "",
    val email: String = "",
    val isLoading: Boolean = false,
    val success: Boolean = false,
    val error: String? = null
)
