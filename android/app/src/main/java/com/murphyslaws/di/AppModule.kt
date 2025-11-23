package com.murphyslaws.di

import android.content.Context
import android.content.SharedPreferences
import com.murphyslaws.util.VoteManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideSharedPreferences(
        @ApplicationContext context: Context
    ): SharedPreferences {
        return context.getSharedPreferences("murphy_votes", Context.MODE_PRIVATE)
    }

    @Provides
    @Singleton
    fun provideVoteManager(
        sharedPreferences: SharedPreferences
    ): VoteManager {
        return VoteManager(sharedPreferences)
    }
}
