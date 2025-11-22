package com.murphyslaws.presentation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.murphyslaws.presentation.calculators.CalculatorsScreen
import com.murphyslaws.presentation.home.HomeScreen
import com.murphyslaws.presentation.more.MoreScreen
import com.murphyslaws.presentation.submit.SubmitLawScreen

sealed class BottomNavScreen(val route: String, val title: String, val icon: ImageVector) {
    object Home : BottomNavScreen("home", "All Laws", Icons.Filled.Home)
    object Calculators : BottomNavScreen("calculators", "Calculators", Icons.Filled.Calculate)
    object Submit : BottomNavScreen("submit", "Submit a Law", Icons.Filled.Add)
    object More : BottomNavScreen("more", "More", Icons.Filled.MoreVert)
}

@Composable
fun MainApp() {
    val navController = rememberNavController()
    val items = listOf(
        BottomNavScreen.Home,
        BottomNavScreen.Calculators,
        BottomNavScreen.Submit,
        BottomNavScreen.More
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                
                items.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = BottomNavScreen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(BottomNavScreen.Home.route) {
                HomeScreen()
            }
            composable(BottomNavScreen.Calculators.route) {
                CalculatorsScreen()
            }
            composable(BottomNavScreen.Submit.route) {
                SubmitLawScreen()
            }
            composable(BottomNavScreen.More.route) {
                MoreScreen()
            }
        }
    }
}
