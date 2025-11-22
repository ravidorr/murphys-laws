package com.murphyslaws.di

import android.content.Context
import androidx.room.Room
import com.murphyslaws.data.local.LawDatabase
import com.murphyslaws.data.local.dao.LawDao
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
    fun provideLawDatabase(
        @ApplicationContext context: Context
    ): LawDatabase {
        return Room.databaseBuilder(
            context,
            LawDatabase::class.java,
            "murphys_laws_db"
        ).build()
    }

    @Provides
    @Singleton
    fun provideLawDao(database: LawDatabase): LawDao {
        return database.lawDao()
    }
}
