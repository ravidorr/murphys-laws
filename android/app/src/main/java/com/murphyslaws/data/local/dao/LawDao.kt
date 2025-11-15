package com.murphyslaws.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.murphyslaws.data.local.entity.LawEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface LawDao {
    @Query("SELECT * FROM laws WHERE cachedAt > :minTimestamp ORDER BY id DESC LIMIT :limit")
    fun getCachedLaws(
        minTimestamp: Long = System.currentTimeMillis() - 3600000, // 1 hour TTL
        limit: Int = 100
    ): Flow<List<LawEntity>>

    @Query("SELECT * FROM laws WHERE id = :id")
    suspend fun getLaw(id: Int): LawEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLaws(laws: List<LawEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLaw(law: LawEntity)

    @Query("DELETE FROM laws WHERE cachedAt < :timestamp")
    suspend fun clearOldCache(timestamp: Long)

    @Query("DELETE FROM laws")
    suspend fun clearAll()
}
