package com.murphyslaws.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.murphyslaws.data.local.entity.CategoryEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories WHERE cachedAt > :minTimestamp ORDER BY name ASC")
    fun getCategories(
        minTimestamp: Long = System.currentTimeMillis() - 86400000 // 24 hour TTL
    ): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories WHERE id = :id")
    suspend fun getCategory(id: Int): CategoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<CategoryEntity>)

    @Query("DELETE FROM categories WHERE cachedAt < :timestamp")
    suspend fun clearOldCache(timestamp: Long)

    @Query("DELETE FROM categories")
    suspend fun clearAll()
}
