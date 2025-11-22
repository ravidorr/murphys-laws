package com.murphyslaws.presentation.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.cachedIn
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.repository.LawRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class BrowseViewModel @Inject constructor(
    private val apiService: com.murphyslaws.data.remote.ApiService
) : ViewModel() {

    val laws: Flow<PagingData<Law>> = Pager(
        config = PagingConfig(pageSize = 25, enablePlaceholders = false),
        pagingSourceFactory = {
            com.murphyslaws.data.repository.LawPagingSource(
                apiService = apiService,
                query = null, // TODO: Add state for query
                categoryId = null // TODO: Add state for category
            )
        }
    ).flow.cachedIn(viewModelScope)
}
