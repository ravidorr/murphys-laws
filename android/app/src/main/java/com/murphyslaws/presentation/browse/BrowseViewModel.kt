package com.murphyslaws.presentation.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.VoteResponse
import com.murphyslaws.domain.model.VoteType
import com.murphyslaws.domain.usecase.GetLawsUseCase
import com.murphyslaws.domain.usecase.VoteLawUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BrowseViewModel @Inject constructor(
    private val getLawsUseCase: GetLawsUseCase,
    private val voteLawUseCase: VoteLawUseCase
) : ViewModel() {

    private val _searchQuery = MutableStateFlow<String?>(null)
    val searchQuery: StateFlow<String?> = _searchQuery.asStateFlow()

    private val _selectedCategoryId = MutableStateFlow<Int?>(null)
    val selectedCategoryId: StateFlow<Int?> = _selectedCategoryId.asStateFlow()

    val laws: Flow<PagingData<Law>> = _searchQuery.flatMapLatest { query ->
        _selectedCategoryId.flatMapLatest { categoryId ->
            getLawsUseCase(
                query = query,
                categoryId = categoryId
            )
        }
    }.cachedIn(viewModelScope)

    fun onSearchQueryChanged(query: String?) {
        _searchQuery.value = query?.takeIf { it.isNotBlank() }
    }

    fun onCategorySelected(categoryId: Int?) {
        _selectedCategoryId.value = categoryId
    }

    fun voteLaw(lawId: Int, voteType: VoteType) {
        viewModelScope.launch {
            voteLawUseCase(lawId, voteType)
        }
    }
}
