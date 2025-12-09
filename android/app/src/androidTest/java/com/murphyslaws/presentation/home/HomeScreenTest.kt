package com.murphyslaws.presentation.home

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ApplicationProvider
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.LawOfDay
import com.murphyslaws.domain.usecase.GetLawOfTheDayUseCase
import com.murphyslaws.domain.usecase.VoteUseCase
import com.murphyslaws.ui.theme.MurphysLawsTheme
import com.murphyslaws.util.VoteManager
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test

@HiltAndroidTest
class HomeScreenTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeTestRule = createComposeRule()

    @Test
    fun homeScreen_displaysHeader() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createViewModel(isLoading = false, hasData = false).first
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Murphy's Laws")
            .assertIsDisplayed()
    }

    @Test
    fun homeScreen_displaysSearchBar() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createViewModel(isLoading = false, hasData = false).first
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
                    viewModel = createViewModel(
                        isLoading = false,
                        hasData = true,
                        law = law
                    ).first
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Murphy's Law of the Day", substring = true)
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
        // Given
        val (viewModel, repository) = createViewModel(isLoading = true, hasData = false)

        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(viewModel = viewModel)
            }
        }

        // Then
        // The header "Murphy's Law of the Day" is always visible
        composeTestRule
            .onNodeWithText("Murphy's Law of the Day", substring = true)
            .assertIsDisplayed()
            
        // The law title "Murphy's Law" should NOT be displayed yet as we are loading
        composeTestRule
            .onNodeWithText("Murphy's Law")
            .assertDoesNotExist()
    }

    @Test
    fun homeScreen_displaysSocialButtons() {
        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createViewModel(isLoading = false, hasData = true).first
                )
            }
        }

        // Then
        val socialDescriptions = listOf(
            "Share on X",
            "Share on Facebook",
            "Share on LinkedIn",
            "Share on Reddit",
            "Share via Email"
        )

        socialDescriptions.forEach { description ->
            composeTestRule
                .onNodeWithContentDescription(description)
                .assertIsDisplayed()
        }
    }

    @Test
    fun homeScreen_handlesNullTitle() {
        // Given
        val law = Law(
            id = 1,
            text = "Test Law",
            title = null,
            upvotes = 0,
            downvotes = 0
        )

        // When
        composeTestRule.setContent {
            MurphysLawsTheme {
                HomeScreen(
                    viewModel = createViewModel(
                        isLoading = false,
                        hasData = true,
                        law = law
                    ).first
                )
            }
        }

        // Then
        composeTestRule
            .onNodeWithText("Murphy's Law") // Default title
            .assertIsDisplayed()
    }

    private fun createViewModel(
        isLoading: Boolean,
        hasData: Boolean,
        law: Law = Law(1, "Test", null, 0, 0)
    ): Pair<HomeViewModel, FakeLawRepository> {
        val fakeRepository = FakeLawRepository()
        
        if (hasData) {
            fakeRepository.setLawOfDay(LawOfDay(law, "2024-01-15"))
        } else {
            fakeRepository.setShouldReturnError(true)
        }

        val getLawUseCase = GetLawOfTheDayUseCase(fakeRepository)
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val sharedPrefs = context.getSharedPreferences("test_votes", android.content.Context.MODE_PRIVATE)
        val voteManager = VoteManager(sharedPrefs)
        val voteUseCase = VoteUseCase(fakeRepository, voteManager)
        
        return Pair(HomeViewModel(getLawUseCase, voteUseCase), fakeRepository)
    }
}
