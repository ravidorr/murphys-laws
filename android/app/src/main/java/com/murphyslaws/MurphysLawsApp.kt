package com.murphyslaws

import android.app.Application
import android.util.Log
import dagger.hilt.android.HiltAndroidApp
import sdk.pendo.io.Pendo

@HiltAndroidApp
class MurphysLawsApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // Initialize Pendo SDK
        val pendoApiKey = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhY2VudGVyIjoidXMiLCJrZXkiOiJhMDNjMmQ4YjI1YmEzYWExM2ZkNWVkNGJmMTliOTc5YWMyYTc5OTYxMzJjYjJlYzZiMTIwMWFlNWQ3ZmM3ZWE4ZGZkYzFlMmFjYjE3NzBkZWQ2OGRmMjg0NWRmYjAyN2RhNjcyYzMwMTNmNDVjNDIzZDA2MTVkNWU5ZDNhNjA5MDFkYTQwNDE5MDdkODBjNTRjODM1ZjAxNjEyMjEzOWE2MTMzNGM0Yzg5NmFjMzRkMmZmNzFkNTY2OTBkMGY3OTU4ZjVmMjFhODE1YTdjNzcxOTEwNjBkMWM0MjIyYzBkOWIyODJjOTg3ZTEwZjAyNGY2ODkyZDNkN2U4MzcwNDEyMjM0MjliYjhiZTUzMTQ4M2ZhOWQ5NTUxMTczNDRjNTIuZDcyNTgzYWExMDAyNzc5NGNhMjVkNTMwYmZiOGQyNTkuYzZiYWU0YWM1NzU3ZDZmNDA5OTE4ZjRiZDI1Y2UxOWY4MzlhN2JmZTQzNTE2MTMyZDA2NThmNmRkOTZhN2RkYiJ9.O5Q4J591f7nlkNTnzwKdcXwJDWSI5j_y3NmThP9Q7OMcgWvUM4Q7jK_PkNC90juVlXs7uUHn2tUHU7Oms8ZnpOZNJaDIgJKl2As8cMayrYcOeszs6TCuhICahO4RuYcQisRLUc8RrlzMR_NqmWptVGD7Iyc0C3vqd75QqOAzhOc"

        // Configure PendoOptions for development environment
        val pendoOptions = Pendo.PendoOptions.Builder()
            .setEnvironmentName("mobile-guides")
            .build()

        try {
            Pendo.setup(
                this,
                pendoApiKey,
                pendoOptions,
                null
            )
        } catch (e: Exception) {
            Log.e("MurphysLawsApp", "Error setting up Pendo SDK", e)
        }
    }
}
