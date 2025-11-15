package com.murphyslaws.data.repository

import androidx.paging.PagingSource
import androidx.paging.PagingState
import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.toDomain
import com.murphyslaws.domain.model.Law
import com.murphyslaws.util.Constants
import retrofit2.HttpException
import java.io.IOException

class LawPagingSource(
    private val apiService: ApiService,
    private val query: String?,
    private val categoryId: Int?,
    private val attribution: String?,
    private val sort: String,
    private val order: String
) : PagingSource<Int, Law>() {

    override suspend fun load(params: LoadParams<Int>): LoadResult<Int, Law> {
        val offset = params.key ?: 0

        return try {
            val response = apiService.getLaws(
                limit = params.loadSize,
                offset = offset,
                sort = sort,
                order = order,
                query = query,
                categoryId = categoryId,
                attribution = attribution
            )

            val laws = response.data.map { it.toDomain() }
            val nextOffset = if (laws.isEmpty() || offset + laws.size >= response.total) {
                null
            } else {
                offset + laws.size
            }

            LoadResult.Page(
                data = laws,
                prevKey = if (offset == 0) null else (offset - params.loadSize).coerceAtLeast(0),
                nextKey = nextOffset
            )
        } catch (e: IOException) {
            LoadResult.Error(e)
        } catch (e: HttpException) {
            LoadResult.Error(e)
        } catch (e: Exception) {
            LoadResult.Error(e)
        }
    }

    override fun getRefreshKey(state: PagingState<Int, Law>): Int? {
        return state.anchorPosition?.let { anchorPosition ->
            val anchorPage = state.closestPageToPosition(anchorPosition)
            anchorPage?.prevKey?.plus(Constants.DEFAULT_PAGE_SIZE)
                ?: anchorPage?.nextKey?.minus(Constants.DEFAULT_PAGE_SIZE)
        }
    }
}
