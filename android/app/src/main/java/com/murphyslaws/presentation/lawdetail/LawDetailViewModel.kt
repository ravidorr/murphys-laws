package com.murphyslaws.presentation.lawdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.VoteUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LawDetailViewModel @Inject constructor(
    private val voteUseCase: VoteUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(LawDetailUiState())
    val uiState: StateFlow<LawDetailUiState> = _uiState.asStateFlow()

    fun setLaw(law: Law) {
        _uiState.update { it.copy(law = law) }
    }

    fun onUpvoteClicked() {
        val law = _uiState.value.law ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }

            val result = voteUseCase.toggleVote(law.id, "up")

            if (result.isSuccess) {
                val response = result.getOrNull()!!
                _uiState.update { state ->
                    state.copy(
                        law = law.copy(
                            upvotes = response.upvotes,
                            downvotes = response.downvotes
                        ),
                        isVoting = false
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isVoting = false,
                        voteError = result.exceptionOrNull()?.message
                    )
                }
            }
        }
    }

    fun onDownvoteClicked() {
        val law = _uiState.value.law ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isVoting = true, voteError = null) }

            val result = voteUseCase.toggleVote(law.id, "down")

            if (result.isSuccess) {
                val response = result.getOrNull()!!
                _uiState.update { state ->
                    state.copy(
                        law = law.copy(
                            upvotes = response.upvotes,
                            downvotes = response.downvotes
                        ),
                        isVoting = false
                    )
                }
            } else {
                _uiState.update {
                    it.copy(
                        isVoting = false,
                        voteError = result.exceptionOrNull()?.message
                    )
                }
            }
        }
    }
}

data class LawDetailUiState(
    val law: Law? = null,
    val isVoting: Boolean = false,
    val voteError: String? = null
)
