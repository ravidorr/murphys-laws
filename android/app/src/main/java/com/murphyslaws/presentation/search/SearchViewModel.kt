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

    private val pageSize = 20

    fun onQueryChange(query: String) {
        _uiState.update { it.copy(query = query) }

        // Cancel previous search job
        searchJob?.cancel()

        // Debounced search - wait 300ms after user stops typing
        searchJob = viewModelScope.launch {
            delay(300)
            performSearch(query, reset = true)
        }
    }

    private suspend fun performSearch(query: String, reset: Boolean = false) {
        if (query.isBlank()) {
            _uiState.update { it.copy(results = emptyList(), isLoading = false, error = null) }
            return
        }

        if (!reset && uiState.value.endReached) return
        if (uiState.value.isLoading) return

        _uiState.update { 
            it.copy(
                isLoading = true, 
                error = null,
                results = if (reset) emptyList() else it.results,
                offset = if (reset) 0 else it.offset,
                endReached = if (reset) false else it.endReached
            ) 
        }

        val currentOffset = if (reset) 0 else uiState.value.offset

        searchLawsUseCase(query, limit = pageSize, offset = currentOffset)
            .onSuccess { newLaws ->
                _uiState.update { currentState ->
                    val updatedResults = if (reset) newLaws else currentState.results + newLaws
                    currentState.copy(
                        results = updatedResults,
                        isLoading = false,
                        offset = currentOffset + newLaws.size,
                        endReached = newLaws.size < pageSize
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
    
    fun loadNextPage() {
        val query = uiState.value.query
        if (query.isNotBlank()) {
            viewModelScope.launch {
                performSearch(query, reset = false)
            }
        }
    }
}

data class SearchUiState(
    val query: String = "",
    val results: List<Law> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val offset: Int = 0,
    val endReached: Boolean = false
)
