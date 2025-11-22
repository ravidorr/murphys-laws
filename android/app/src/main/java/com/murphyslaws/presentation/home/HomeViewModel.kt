package com.murphyslaws.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.usecase.GetLawOfTheDayUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val getLawOfTheDayUseCase: GetLawOfTheDayUseCase
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
}

data class HomeUiState(
    val isLoading: Boolean = false,
    val lawOfDay: LawOfDay? = null,
    val error: String? = null
)
