package com.murphyslaws

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class MurphysLawsApplication : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
