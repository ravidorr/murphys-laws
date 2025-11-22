package com.murphyslaws.data.repository

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.domain.model.Law

class LawPagingSource(
    private val apiService: ApiService,
    private val query: String? = null,
    private val categoryId: Int? = null
) : PagingSource<Int, Law>() {

    override fun getRefreshKey(state: PagingState<Int, Law>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            state.closestPageToPosition(anchorPosition)?.prevKey?.plus(1)
                ?: state.closestPageToPosition(anchorPosition)?.nextKey?.minus(1)
        }
    }

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Law> {
        val page = params.key ?: 0
        val limit = params.loadSize

        return try {
            val offset = page * limit
            val dtos = apiService.getLaws(
                limit = limit,
                offset = offset,
                query = query,
                categoryId = categoryId
            )

            val laws = dtos.map { dto ->
                Law(
                    id = dto.id,
                    text = dto.text,
                    title = dto.title,
                    upvotes = dto.upvotes,
                    downvotes = dto.downvotes,
                    createdAt = dto.createdAt
                )
            }

            LoadResult.Page(
                data = laws,
                prevKey = if (page == 0) null else page - 1,
                nextKey = if (laws.isEmpty()) null else page + 1
            )
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }
}
