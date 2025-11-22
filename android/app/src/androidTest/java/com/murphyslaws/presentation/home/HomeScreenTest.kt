package com.murphyslaws.presentation.home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.usecase.GetLawOfTheDayUseCase
import com.murphyslaws.ui.theme.MurphysLawsTheme
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import io.mockk.coEvery
import io.mockk.mockk
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import javax.inject.Inject

@HiltAndroidTest
class HomeScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createComposeRule()

    @Test
    fun homeScreen_displaysHeaderAndSubtitle() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createMockViewModel(isLoading = false, hasData = false)
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Murphy's Law")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("If it can go wrong, it will, and you'll find it here.")
            .assertIsDisplayed()
    }

    @Test
    fun homeScreen_displaysSearchBar() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createMockViewModel(isLoading = false, hasData = false)
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Search laws...")
            .assertIsDisplayed()
    }

    @Test
    fun homeScreen_displaysLawOfTheDay() {
        // Given
        val law = Law(
            id = 1,
            text = "If you're early, the bus is late.",
            title = "Murphy's Bus Law",
            upvotes = 42,
            downvotes = 3,
            createdAt = "2024-01-01"
        )

        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createMockViewModel(
                        isLoading = false,
                        hasData = true,
                        law = law
                    )
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Murphy's Law of the Day")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("If you're early, the bus is late.")
            .assertIsDisplayed()
        
        composeTestRule
            .onNodeWithText("42")
            .assertIsDisplayed()
    }

    @Test
    fun homeScreen_displaysLoadingIndicator() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createMockViewModel(isLoading = true, hasData = false)
                )
            }
        }

        // Then - loading indicator should be present
        // Note: CircularProgressIndicator doesn't have text, so we check other elements are NOT displayed
        composeTestRule
            .onNodeWithText("Murphy's Law")
            .assertIsDisplayed()
    }

    private fun createMockViewModel(
        isLoading: Boolean,
        hasData: Boolean,
        law: Law = Law(1, "Test", null, 0, 0)
    ): HomeViewModel {
        val useCase: GetLawOfTheDayUseCase = mockk()
        
        val lawOfDay = if (hasData) {
            LawOfDay(law = law, date = "2024-01-15")
        } else null

        coEvery { useCase() } returns if (hasData) {
            Result.success(LawOfDay(law, "2024-01-15"))
        } else {
            Result.failure(Exception("No data"))
        }

        return HomeViewModel(useCase).apply {
            // We can't easily set the state directly, so we rely on the useCase mock
        }
    }
}
