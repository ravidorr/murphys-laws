package com.murphyslaws.presentation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.murphyslaws.ui.theme.MurphysLawsTheme
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test

@HiltAndroidTest
class MainAppNavigationTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createComposeRule()

    @Test
    fun mainApp_displaysBottomNavigation() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                MainApp()
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("All Laws")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Calculators")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Submit a Law")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("More")
            .assertIsDisplayed()
    }

    @Test
    fun mainApp_navigatesToCalculatorsScreen() {
        // Given
        composeTestRule.setContent {
            MurphysLawsTheme {
                MainApp()
            }
        }

        // When
        composeTestRule
            .onNodeWithText("Calculators")
            .performClick()

        // Then
        composeTestRule
            .onNodeWithText("Calculators feature coming soon")
            .assertIsDisplayed()
    }

    @Test
    fun mainApp_navigatesToSubmitScreen() {
        // Given
        composeTestRule.setContent {
            MurphysLawsTheme {
                MainApp()
            }
        }

        // When
        composeTestRule
            .onNodeWithText("Submit a Law")
            .performClick()

        // Then
        composeTestRule
            .onNodeWithText("Submit a Law feature coming soon")
            .assertIsDisplayed()
    }

    @Test
    fun mainApp_navigatesToMoreScreen() {
        // Given
        composeTestRule.setContent {
            MurphysLawsTheme {
                MainApp()
            }
        }

        // When
        composeTestRule
            .onNodeWithText("More")
            .performClick()

        // Then
        composeTestRule
            .onNodeWithText("More options coming soon")
            .assertIsDisplayed()
    }
}
