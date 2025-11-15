package com.murphyslaws.data.repository

import android.content.Context
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import com.murphyslaws.data.local.VoteManager
import com.murphyslaws.data.local.dao.LawDao
import com.murphyslaws.data.remote.ApiService
import com.murphyslaws.data.remote.dto.SubmitLawRequestDto
import com.murphyslaws.data.remote.dto.VoteRequest
import com.murphyslaws.data.remote.dto.toDomain
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.model.SubmitLawRequest
import com.murphyslaws.domain.model.SubmitLawResponse
import com.murphyslaws.domain.model.VoteResponse
import com.murphyslaws.domain.model.VoteType
import com.murphyslaws.domain.repository.LawRepository
import com.murphyslaws.util.Constants
import com.murphyslaws.util.DeviceInfo
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LawRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val lawDao: LawDao,
    private val voteManager: VoteManager,
    @ApplicationContext private val context: Context
) : LawRepository {

    override fun getLaws(
        query: String?,
        categoryId: Int?,
        attribution: String?,
        sort: String,
        order: String
    ): Flow<PagingData<Law>> {
        return Pager(
            config = PagingConfig(
                pageSize = Constants.DEFAULT_PAGE_SIZE,
                prefetchDistance = Constants.PREFETCH_DISTANCE,
                enablePlaceholders = false
            ),
            pagingSourceFactory = {
                LawPagingSource(
                    apiService = apiService,
                    query = query,
                    categoryId = categoryId,
                    attribution = attribution,
                    sort = sort,
                    order = order
                )
            }
        ).flow
    }

    override suspend fun getLaw(id: Int): Result<Law> {
        return try {
            val law = apiService.getLaw(id).toDomain()
            Result.success(law)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getLawOfDay(): Result<LawOfDay> {
        return try {
            val response = apiService.getLawOfDay()
            val lawOfDay = LawOfDay(
                law = response.law.toDomain(),
                featuredDate = response.featuredDate
            )
            Result.success(lawOfDay)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun voteLaw(lawId: Int, voteType: VoteType): Result<VoteResponse> {
        return try {
            val deviceId = DeviceInfo.getDeviceId(context)
            val response = apiService.voteLaw(
                id = lawId,
                voteRequest = VoteRequest(voteType.value),
                deviceId = deviceId
            )
            val voteResponse = VoteResponse(
                upvotes = response.upvotes,
                downvotes = response.downvotes
            )
            Result.success(voteResponse)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun unvoteLaw(lawId: Int): Result<VoteResponse> {
        return try {
            val deviceId = DeviceInfo.getDeviceId(context)
            val response = apiService.unvoteLaw(
                id = lawId,
                deviceId = deviceId
            )
            val voteResponse = VoteResponse(
                upvotes = response.upvotes,
                downvotes = response.downvotes
            )
            Result.success(voteResponse)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun submitLaw(request: SubmitLawRequest): Result<SubmitLawResponse> {
        return try {
            val requestDto = SubmitLawRequestDto(
                text = request.text,
                title = request.title,
                categoryId = request.categoryId,
                authorName = request.authorName,
                authorEmail = request.authorEmail,
                submitAnonymously = request.submitAnonymously
            )
            val response = apiService.submitLaw(requestDto)
            val submitResponse = SubmitLawResponse(
                success = response.success,
                message = response.message,
                lawId = response.lawId
            )
            Result.success(submitResponse)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getUserVote(lawId: Int): Flow<VoteType?> {
        return voteManager.getVote(lawId)
    }

    override suspend fun saveUserVote(lawId: Int, voteType: VoteType) {
        voteManager.setVote(lawId, voteType)
    }

    override suspend fun removeUserVote(lawId: Int) {
        voteManager.removeVote(lawId)
    }
}
