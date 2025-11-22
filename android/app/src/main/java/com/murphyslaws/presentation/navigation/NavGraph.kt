package com.murphyslaws.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.murphyslaws.presentation.home.HomeScreen

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Browse : Screen("browse")
    object LawDetail : Screen("law/{lawId}") {
        fun createRoute(lawId: Int) = "law/$lawId"
    }
}

@Composable
fun NavGraph(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(
                onCategoryClick = { categoryId ->
                    navController.navigate(Screen.Browse.route)
                },
                onLawClick = { lawId ->
                    navController.navigate(Screen.LawDetail.createRoute(lawId))
                }
            )
        }
        
        composable(Screen.Browse.route) {
            com.murphyslaws.presentation.browse.BrowseScreen(
                onLawClick = { lawId ->
                    navController.navigate(Screen.LawDetail.createRoute(lawId))
                }
            )
        }
        
        composable(Screen.LawDetail.route) {
            com.murphyslaws.presentation.detail.LawDetailScreen(
                onBackClick = { navController.popBackStack() }
            )
        }
    }
}
