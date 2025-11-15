package com.murphyslaws.di

import android.content.Context
import androidx.room.Room
import com.murphyslaws.data.local.MurphysLawsDatabase
import com.murphyslaws.data.local.dao.CategoryDao
import com.murphyslaws.data.local.dao.LawDao
import com.murphyslaws.util.Constants
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(
        @ApplicationContext context: Context
    ): MurphysLawsDatabase {
        return Room.databaseBuilder(
            context,
            MurphysLawsDatabase::class.java,
            Constants.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    @Singleton
    fun provideLawDao(database: MurphysLawsDatabase): LawDao {
        return database.lawDao()
    }

    @Provides
    @Singleton
    fun provideCategoryDao(database: MurphysLawsDatabase): CategoryDao {
        return database.categoryDao()
    }
}
