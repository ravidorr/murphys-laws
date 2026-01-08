package com.murphyslaws.presentation

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.murphyslaws.MainActivity
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test

@HiltAndroidTest
class MainAppNavigationTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun setup() {
        hiltRule.inject()
    }

    @Test
    fun mainApp_displaysBottomNavigation() {
        // Then (MainActivity already sets content with MainApp)
        composeTestRule
            .onNodeWithText("All Laws")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Calculators")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("Submit Law")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("More")
            .assertIsDisplayed()
    }

    @Test
    fun mainApp_navigatesToCalculatorsScreen() {
        // When - MainActivity already has content set
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
        // When - MainActivity already has content set
        composeTestRule
            .onNodeWithText("Submit Law")
            .performClick()

        // Then
        composeTestRule
            .onNodeWithText("Submit Law feature coming soon")
            .assertIsDisplayed()
    }

    @Test
    fun mainApp_navigatesToMoreScreen() {
        // When - MainActivity already has content set
        composeTestRule
            .onNodeWithText("More")
            .performClick()

        // Then
        composeTestRule
            .onNodeWithText("More options coming soon")
            .assertIsDisplayed()
    }
}
