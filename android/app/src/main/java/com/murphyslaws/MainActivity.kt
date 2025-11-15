package com.murphyslaws

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.murphyslaws.presentation.MainScreen
import com.murphyslaws.presentation.theme.MurphysLawsTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MurphysLawsTheme {
                MainScreen()
            }
        }
    }
}
