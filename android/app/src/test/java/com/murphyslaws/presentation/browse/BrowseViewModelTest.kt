package com.murphyslaws.presentation.browse

import app.cash.turbine.test
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.GetLawsUseCase
import io.mockk.*
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
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.success(laws)

        // When
        viewModel = BrowseViewModel(getLawsUseCase)
        testDispatcher.scheduler.advanceUntilIdle()

        // Then
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals(laws, state.laws)
        assertNull(state.error)
        assertEquals(2, state.offset)
        assertTrue(state.endReached) // Only 2 items loaded, less than pageSize (20)
    }

    @Test
    fun `init handles error when loading laws`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.failure(Exception(errorMessage))

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
            assertEquals("An unexpected error occurred. Please try again.", errorState.error)
        }
    }

    @Test
    fun `loadLaws retries loading`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.failure(Exception(errorMessage))
        viewModel = BrowseViewModel(getLawsUseCase)
        testDispatcher.scheduler.runCurrent() // Consume init load

        // Prepare success for retry
        val laws = listOf(Law(1, "Law 1", "Title 1", 0, 0))
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.success(laws)

        // When
        viewModel.loadLaws(reset = true)

        // Then
        viewModel.uiState.test {
            // 1. Current state (from init failure)
            val currentState = awaitItem()
            assertEquals("An unexpected error occurred. Please try again.", currentState.error)

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

    @Test
    fun `loadNextPage appends laws to the list`() = runTest(testDispatcher) {
        // Given
        val initialLaws = List(20) { Law(it, "Law $it", "Title $it", 0, 0) }
        val nextLaws = listOf(Law(20, "Law 20", "Title 20", 0, 0))
        
        // Use returnsMany to return different values on sequential calls
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returnsMany listOf(
            Result.success(initialLaws),
            Result.success(nextLaws)
        )
        
        viewModel = BrowseViewModel(getLawsUseCase)
        testDispatcher.scheduler.advanceUntilIdle() // Complete init load

        // When
        viewModel.loadNextPage()
        testDispatcher.scheduler.advanceUntilIdle() // Complete next page load

        // Then
        val state = viewModel.uiState.value
        assertFalse(state.isLoading)
        assertEquals(21, state.laws.size)
        assertEquals(21, state.offset)
        assertEquals(initialLaws + nextLaws, state.laws)
    }

    @Test
    fun `loadNextPage sets endReached when fewer items returned`() = runTest(testDispatcher) {
        // Given
        val initialLaws = List(20) { Law(it, "Law $it", null, 0, 0) }
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.success(initialLaws)
        viewModel = BrowseViewModel(getLawsUseCase)
        testDispatcher.scheduler.runCurrent()

        // Next page returns empty or few items
        coEvery { getLawsUseCase(limit = any<Int>(), offset = any<Int>()) } returns Result.success(emptyList())

        // When
        viewModel.loadNextPage()

        // Then
        viewModel.uiState.test {
            val currentState = awaitItem()
            assertFalse(currentState.endReached)

            testDispatcher.scheduler.runCurrent() // Loading
            awaitItem()

            testDispatcher.scheduler.runCurrent() // Success
            val successState = awaitItem()
            assertTrue(successState.endReached)
        }
    }
}
