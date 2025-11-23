package com.murphyslaws.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.usecase.GetLawOfTheDayUseCase
import com.murphyslaws.domain.usecase.VoteUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getLawOfTheDayUseCase: GetLawOfTheDayUseCase,
    private val voteUseCase: VoteUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadData()
    }

    private fun loadData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            
            val lawResult = getLawOfTheDayUseCase()

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                lawOfDay = lawResult.getOrNull(),
                error = lawResult.exceptionOrNull()?.message
            )
        }
    }
    
    fun onUpvoteClicked() {
        val law = _uiState.value.lawOfDay?.law ?: return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }
            
            voteUseCase.toggleVote(law.id, "up")
                .onSuccess { response ->
                    _uiState.update { state ->
                        state.copy(
                            lawOfDay = state.lawOfDay?.copy(
                                law = law.copy(
                                    upvotes = response.upvotes,
                                    downvotes = response.downvotes
                                )
                            ),
                            isVoting = false
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isVoting = false,
                            voteError = error.message
                        )
                    }
                }
        }
    }
    
    fun onDownvoteClicked() {
        val law = _uiState.value.lawOfDay?.law ?: return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }
            
            voteUseCase.toggleVote(law.id, "down")
                .onSuccess { response ->
                    _uiState.update { state ->
                        state.copy(
                            lawOfDay = state.lawOfDay?.copy(
                                law = law.copy(
                                    upvotes = response.upvotes,
                                    downvotes = response.downvotes
                                )
                            ),
                            isVoting = false
                        )
                    }
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isVoting = false,
                            voteError = error.message
                        )
                    }
                }
        }
    }
}

data class HomeUiState(
    val isLoading: Boolean = false,
    val lawOfDay: LawOfDay? = null,
    val error: String? = null,
    val isVoting: Boolean = false,
    val voteError: String? = null
)
