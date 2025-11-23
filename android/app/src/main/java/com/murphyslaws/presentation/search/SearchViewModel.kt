package com.murphyslaws.presentation.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.SearchLawsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val searchLawsUseCase: SearchLawsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(SearchUiState())
    val uiState: StateFlow<SearchUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }

        // Cancel previous search job
        searchJob?.cancel()

        // Debounced search - wait 300ms after user stops typing
        searchJob = viewModelScope.launch {
            delay(300)
            performSearch(query)
        }
    }

    private suspend fun performSearch(query: String) {
        if (query.isBlank()) {
            _uiState.update { it.copy(results = emptyList(), isLoading = false, error = null) }
            return
        }

        _uiState.update { it.copy(isLoading = true, error = null) }

        searchLawsUseCase(query)
            .onSuccess { laws ->
                _uiState.update {
                    it.copy(
                        results = laws,
                        isLoading = false
                    )
                }
            }
            .onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = error.message
                    )
                }
            }
    }
}

data class SearchUiState(
    val query: String = "",
    val results: List<Law> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)
