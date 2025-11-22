package com.murphyslaws.data.local.dao

import androidx.paging.PagingSource
import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.murphyslaws.data.local.entities.LawEntity

@Dao
interface LawDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(laws: List<LawEntity>)

    @Query("SELECT * FROM laws ORDER BY cachedAt ASC") // Simple ordering for now
    fun getLaws(): PagingSource<Int, LawEntity>

    @Query("DELETE FROM laws")
    suspend fun clearAll()
}
