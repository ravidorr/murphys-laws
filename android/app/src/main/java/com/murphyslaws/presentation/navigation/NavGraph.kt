package com.murphyslaws.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.murphyslaws.presentation.browse.BrowseScreen
import com.murphyslaws.presentation.home.HomeScreen

@Composable
fun NavGraph(
    navController: NavHostController,
    startDestination: String = Routes.Home.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.Home.route) {
            HomeScreen(
                onNavigateToLaw = { lawId ->
                    navController.navigate(Routes.LawDetail.createRoute(lawId))
                }
            )
        }

        composable(Routes.Browse.route) {
            BrowseScreen(
                onNavigateToLaw = { lawId ->
                    navController.navigate(Routes.LawDetail.createRoute(lawId))
                }
            )
        }

        composable(Routes.Categories.route) {
            // Placeholder for Categories screen
        }

        composable(Routes.Calculators.route) {
            // Placeholder for Calculators screen
        }

        composable(Routes.More.route) {
            // Placeholder for More screen
        }

        composable(
            route = Routes.LawDetail.route,
            arguments = listOf(
                navArgument("lawId") { type = NavType.IntType }
            )
        ) { backStackEntry ->
            val lawId = backStackEntry.arguments?.getInt("lawId") ?: return@composable
            // Placeholder for Law Detail screen
        }

        composable(Routes.SubmitLaw.route) {
            // Placeholder for Submit Law screen
        }
    }
}
