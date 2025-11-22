package com.murphyslaws.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.murphyslaws.data.local.dao.LawDao
import com.murphyslaws.data.local.entities.LawEntity

@Database(
    entities = [LawEntity::class],
    version = 1,
    exportSchema = false
)
abstract class LawDatabase : RoomDatabase() {
    abstract fun lawDao(): LawDao
}
