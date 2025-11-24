package com.murphyslaws.presentation.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.GetLawsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BrowseViewModel @Inject constructor(
    private val getLawsUseCase: GetLawsUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(BrowseUiState())
    val uiState: StateFlow<BrowseUiState> = _uiState.asStateFlow()

    private val pageSize = 20

    init {
        loadLaws(reset = true)
    }

    fun loadLaws(reset: Boolean = false) {
        if (uiState.value.isLoading) return
        if (!reset && uiState.value.endReached) return

        viewModelScope.launch {
            _uiState.update { 
                it.copy(
                    isLoading = true, 
                    error = null,
                    laws = if (reset) emptyList() else it.laws,
                    offset = if (reset) 0 else it.offset,
                    endReached = if (reset) false else it.endReached
                ) 
            }
            
            val currentOffset = if (reset) 0 else uiState.value.offset
            
            getLawsUseCase(limit = pageSize, offset = currentOffset)
                .onSuccess { newLaws ->
                    _uiState.update { currentState ->
                        val updatedLaws = if (reset) newLaws else currentState.laws + newLaws
                        currentState.copy(
                            isLoading = false,
                            laws = updatedLaws,
                            offset = currentOffset + newLaws.size,
                            endReached = newLaws.size < pageSize
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update { 
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Unknown error occurred"
                        )
                    }
                }
        }
    }
    
    fun loadNextPage() {
        loadLaws(reset = false)
    }
}

data class BrowseUiState(
    val isLoading: Boolean = false,
    val laws: List<Law> = emptyList(),
    val error: String? = null,
    val offset: Int = 0,
    val endReached: Boolean = false
)
