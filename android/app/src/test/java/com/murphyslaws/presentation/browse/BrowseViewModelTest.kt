package com.murphyslaws.presentation.browse

import app.cash.turbine.test
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.GetLawsUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class BrowseViewModelTest {

    private lateinit var getLawsUseCase: GetLawsUseCase
    private lateinit var viewModel: BrowseViewModel
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        getLawsUseCase = mockk()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `init loads laws successfully`() = runTest(testDispatcher) {
        // Given
        val laws = listOf(
            Law(1, "Law 1", "Title 1", 0, 0),
            Law(2, "Law 2", "Title 2", 0, 0)
        )
        coEvery { getLawsUseCase() } returns Result.success(laws)

        // When
        viewModel = BrowseViewModel(getLawsUseCase)

        // Then
        viewModel.uiState.test {
            // 1. Initial default state
            val initialState = awaitItem()
            assertFalse(initialState.isLoading)

            // 2. Run init coroutine -> Loading state
            testDispatcher.scheduler.runCurrent()
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)
            
            // 3. Use case returns -> Success state
            testDispatcher.scheduler.runCurrent()
            val successState = awaitItem()
            assertFalse(successState.isLoading)
            assertEquals(laws, successState.laws)
            assertNull(successState.error)
        }
    }

    @Test
    fun `init handles error when loading laws`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        coEvery { getLawsUseCase() } returns Result.failure(Exception(errorMessage))

        // When
        viewModel = BrowseViewModel(getLawsUseCase)

        // Then
        viewModel.uiState.test {
            // 1. Initial default state
            val initialState = awaitItem()
            assertFalse(initialState.isLoading)

            // 2. Run init coroutine -> Loading state
            testDispatcher.scheduler.runCurrent()
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)
            
            // 3. Use case returns -> Error state
            testDispatcher.scheduler.runCurrent()
            val errorState = awaitItem()
            assertFalse(errorState.isLoading)
            assertTrue(errorState.laws.isEmpty())
            assertEquals(errorMessage, errorState.error)
        }
    }

    @Test
    fun `loadLaws retries loading`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        coEvery { getLawsUseCase() } returns Result.failure(Exception(errorMessage))
        viewModel = BrowseViewModel(getLawsUseCase)
        testDispatcher.scheduler.runCurrent() // Consume init load

        // Prepare success for retry
        val laws = listOf(Law(1, "Law 1", "Title 1", 0, 0))
        coEvery { getLawsUseCase() } returns Result.success(laws)

        // When
        viewModel.loadLaws()

        // Then
        viewModel.uiState.test {
            // 1. Current state (from init failure)
            val currentState = awaitItem()
            assertEquals(errorMessage, currentState.error)

            // 2. Run loadLaws coroutine -> Loading state
            testDispatcher.scheduler.runCurrent()
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)
            assertNull(loadingState.error) // Error cleared
            
            // 3. Use case returns -> Success state
            testDispatcher.scheduler.runCurrent()
            val successState = awaitItem()
            assertFalse(successState.isLoading)
            assertEquals(laws, successState.laws)
        }
    }
}
