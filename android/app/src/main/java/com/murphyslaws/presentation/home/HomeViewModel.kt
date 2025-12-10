package com.murphyslaws.presentation.home

import android.util.Log
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
        Log.d("HomeViewModel", "loadData() called")
        viewModelScope.launch {
            Log.d("HomeViewModel", "Setting isLoading = true")
            _uiState.value = _uiState.value.copy(isLoading = true)

            Log.d("HomeViewModel", "Calling getLawOfTheDayUseCase()")
            val lawResult = getLawOfTheDayUseCase()
            Log.d("HomeViewModel", "getLawOfTheDayUseCase() returned: success=${lawResult.isSuccess}, failure=${lawResult.isFailure}")

            if (lawResult.isFailure) {
                Log.e("HomeViewModel", "Error loading law of the day", lawResult.exceptionOrNull())
            } else {
                Log.d("HomeViewModel", "Law of the day: ${lawResult.getOrNull()}")
            }

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                lawOfDay = lawResult.getOrNull(),
                error = if (lawResult.isFailure) com.murphyslaws.util.ErrorMessageMapper.map(lawResult.exceptionOrNull()) else null
            )
            Log.d("HomeViewModel", "UI state updated: lawOfDay=${_uiState.value.lawOfDay != null}, error=${_uiState.value.error}")
        }
    }
    
    fun onUpvoteClicked() {
        val law = _uiState.value.lawOfDay?.law ?: return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }
            
            val result = voteUseCase.toggleVote(law.id, "up")
            
            if (result.isSuccess) {
                val response = result.getOrNull()!!
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
            } else {
                _uiState.update {
                    it.copy(
                        isVoting = false,
                        voteError = com.murphyslaws.util.ErrorMessageMapper.map(result.exceptionOrNull())
                    )
                }
            }
        }
    }
    
    fun onDownvoteClicked() {
        val law = _uiState.value.lawOfDay?.law ?: return
        
        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }
            
            val result = voteUseCase.toggleVote(law.id, "down")
            
            if (result.isSuccess) {
                val response = result.getOrNull()!!
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
            } else {
                _uiState.update {
                    it.copy(
                        isVoting = false,
                        voteError = com.murphyslaws.util.ErrorMessageMapper.map(result.exceptionOrNull())
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
