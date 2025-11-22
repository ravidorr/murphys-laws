package com.murphyslaws.presentation.detail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LawDetailViewModel @Inject constructor(
    private val repository: LawRepository, // We might need a specific UseCase for GetLawById if not in Repo
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val lawId: Int = checkNotNull(savedStateHandle.get<String>("lawId")).toInt()
    
    private val _uiState = MutableStateFlow(LawDetailUiState())
    val uiState: StateFlow<LawDetailUiState> = _uiState.asStateFlow()

    init {
        loadLaw()
    }

    private fun loadLaw() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val law = repository.getLaw(lawId)
                _uiState.value = _uiState.value.copy(isLoading = false, law = law)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }
}

data class LawDetailUiState(
    val isLoading: Boolean = false,
    val law: Law? = null,
    val error: String? = null
)
