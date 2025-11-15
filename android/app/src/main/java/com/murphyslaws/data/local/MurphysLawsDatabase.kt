package com.murphyslaws.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.murphyslaws.data.local.dao.CategoryDao
import com.murphyslaws.data.local.dao.LawDao
import com.murphyslaws.data.local.entity.CategoryEntity
import com.murphyslaws.data.local.entity.LawEntity

@Database(
    entities = [
        LawEntity::class,
        CategoryEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class MurphysLawsDatabase : RoomDatabase() {
    abstract fun lawDao(): LawDao
    abstract fun categoryDao(): CategoryDao
}
