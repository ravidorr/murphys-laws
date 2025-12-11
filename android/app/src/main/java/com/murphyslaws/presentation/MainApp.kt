package com.murphyslaws.presentation

import android.util.Log
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Calculate
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import sdk.pendo.io.Pendo
import com.murphyslaws.presentation.browse.BrowseScreen
import com.murphyslaws.presentation.calculators.CalculatorsScreen
import com.murphyslaws.presentation.home.HomeScreen
import com.murphyslaws.presentation.lawdetail.LawDetailScreen
import com.murphyslaws.presentation.more.MarkdownContentScreen
import com.murphyslaws.presentation.more.MoreScreen
import com.murphyslaws.presentation.search.SearchScreen
import com.murphyslaws.presentation.submit.SubmitLawScreen
import com.murphyslaws.domain.model.ContentPage

sealed class BottomNavScreen(val route: String, val title: String, val icon: ImageVector) {
    object Home : BottomNavScreen("home", "Home", Icons.Filled.Home)
    object Browse : BottomNavScreen("browse", "All Laws", Icons.AutoMirrored.Filled.List)
    object Calculators : BottomNavScreen("calculators", "Calculators", Icons.Filled.Calculate)
    object Submit : BottomNavScreen("submit", "Submit a Law", Icons.Filled.Add)
    object More : BottomNavScreen("more", "More", Icons.Filled.MoreVert)
}

// Additional routes (not in bottom nav)
object AdditionalRoutes {
    const val SEARCH = "search"
    const val LAW_DETAIL = "law_detail"
    const val CONTENT_PAGE = "content_page"
}

@Composable
fun MainApp() {
    val navController = rememberNavController()
    val lifecycleOwner = LocalLifecycleOwner.current

    // Register NavController with Pendo for Compose navigation tracking
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                Pendo.setComposeNavigationController(navController)

                // Start Pendo session after navigation controller is set
                val visitorId = "ravidor@gmail.com"
                val accountId = "ACME"
                val visitorData = mapOf<String, Any>()
                val accountData = mapOf<String, Any>()
                try {
                    Pendo.startSession(
                        visitorId,
                        accountId,
                        visitorData,
                        accountData
                    )
                } catch (e: Exception) {
                    Log.e("MainApp", "Error starting Pendo session", e)
                }
            } else if (event == Lifecycle.Event.ON_PAUSE) {
                Pendo.setComposeNavigationController(null)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)

        onDispose {
            Pendo.setComposeNavigationController(null)
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    val items = listOf(
        BottomNavScreen.Home,
        BottomNavScreen.Browse,
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
                HomeScreen(
                    onNavigateToSearch = {
                        navController.navigate(AdditionalRoutes.SEARCH)
                    }
                )
            }
            composable(BottomNavScreen.Browse.route) {
                BrowseScreen(
                    onLawClick = { law ->
                        navController.currentBackStackEntry?.savedStateHandle?.set("law", law)
                        navController.navigate(AdditionalRoutes.LAW_DETAIL)
                    }
                )
            }
            composable(BottomNavScreen.Calculators.route) {
                CalculatorsScreen()
            }
            composable(BottomNavScreen.Submit.route) {
                SubmitLawScreen()
            }
            composable(BottomNavScreen.More.route) {
                MoreScreen(
                    onNavigateToContent = { page ->
                        navController.currentBackStackEntry?.savedStateHandle?.set("contentPage", page)
                        navController.navigate(AdditionalRoutes.CONTENT_PAGE)
                    }
                )
            }
            composable(AdditionalRoutes.SEARCH) {
                SearchScreen(
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onLawClick = { law ->
                        // Pass law via SavedStateHandle
                        navController.currentBackStackEntry?.savedStateHandle?.set("law", law)
                        navController.navigate(AdditionalRoutes.LAW_DETAIL)
                    }
                )
            }
            composable(AdditionalRoutes.LAW_DETAIL) {
                // Retrieve law from previous back stack entry
                val law = navController.previousBackStackEntry
                    ?.savedStateHandle
                    ?.get<com.murphyslaws.domain.model.Law>("law")

                if (law != null) {
                    LawDetailScreen(
                        law = law,
                        onNavigateBack = {
                            navController.popBackStack()
                        }
                    )
                }
            }
            composable(AdditionalRoutes.CONTENT_PAGE) {
                // Retrieve content page from previous back stack entry
                val page = navController.previousBackStackEntry
                    ?.savedStateHandle
                    ?.get<ContentPage>("contentPage")

                if (page != null) {
                    MarkdownContentScreen(
                        page = page,
                        onNavigateBack = {
                            navController.popBackStack()
                        },
                        onNavigateToContent = { targetPage ->
                            navController.currentBackStackEntry?.savedStateHandle?.set("contentPage", targetPage)
                            navController.navigate(AdditionalRoutes.CONTENT_PAGE)
                        }
                    )
                }
            }
        }
    }
}
