package com.murphyslaws.presentation.navigation

sealed class Routes(val route: String) {
    data object Home : Routes("home")
    data object Browse : Routes("browse")
    data object Categories : Routes("categories")
    data object Calculators : Routes("calculators")
    data object More : Routes("more")
    data object LawDetail : Routes("law/{lawId}") {
        fun createRoute(lawId: Int) = "law/$lawId"
    }
    data object SubmitLaw : Routes("submit")
}
