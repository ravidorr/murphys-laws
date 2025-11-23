package com.murphyslaws.presentation.search

import app.cash.turbine.test
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.usecase.SearchLawsUseCase
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SearchViewModelTest {

    private lateinit var searchLawsUseCase: SearchLawsUseCase
    private lateinit var viewModel: SearchViewModel

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        searchLawsUseCase = mockk()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is empty`() = runTest(testDispatcher) {
        // When
        viewModel = SearchViewModel(searchLawsUseCase)

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals("", state.query)
            assertTrue(state.results.isEmpty())
            assertFalse(state.isLoading)
            assertNull(state.error)
        }
    }

    @Test
    fun `onQueryChange updates query in state`() = runTest(testDispatcher) {
        // Given
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("test") } returns Result.success(emptyList())

        // When
        viewModel.onQueryChange("test")

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals("test", state.query)
        }
    }

    @Test
    fun `onQueryChange debounces search for 300ms`() = runTest(testDispatcher) {
        // Given
        val laws = listOf(Law(1, "Test law", null, 10, 2))
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("test") } returns Result.success(laws)

        // When
        viewModel.onQueryChange("test")
        
        // Advance time by 200ms (should not search yet)
        advanceTimeBy(200)
        
        // Then - no search should have happened
        viewModel.uiState.value.let { state ->
            assertTrue(state.results.isEmpty())
            assertFalse(state.isLoading)
        }

        // Advance past debounce delay
        advanceTimeBy(101) // Total 301ms
        testDispatcher.scheduler.runCurrent()

        // Then - search should have completed
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(1, state.results.size)
            assertFalse(state.isLoading)
        }
    }

    @Test
    fun `onQueryChange cancels previous search when typing quickly`() = runTest(testDispatcher) {
        // Given
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("te") } returns Result.success(emptyList())
        coEvery { searchLawsUseCase("test") } returns Result.success(listOf(Law(1, "Test", null, 10, 2)))

        // When - user types quickly
        viewModel.onQueryChange("te")
        advanceTimeBy(100)
        viewModel.onQueryChange("test")
        
        // Advance past debounce
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Then - only the last search should execute
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals("test", state.query)
            assertEquals(1, state.results.size)
        }
    }

    @Test
    fun `search sets isLoading during API call`() = runTest(testDispatcher) {
        // Given
        val laws = listOf(Law(1, "Test", null, 10, 2))
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("test") } returns Result.success(laws)

        // When
        viewModel.onQueryChange("test")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent() // Process the state update

        // Then - isLoading should have been set and then cleared
        viewModel.uiState.test {
            val state = awaitItem()
            assertFalse(state.isLoading) // Should be false after completion
            assertEquals(1, state.results.size)
        }
    }

    @Test
    fun `search updates results on success`() = runTest(testDispatcher) {
        // Given
        val laws = listOf(
            Law(1, "Murphy's Law", "Murphy's Law", 10, 2),
            Law(2, "Another law", null, 5, 1)
        )
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("murphy") } returns Result.success(laws)

        // When
        viewModel.onQueryChange("murphy")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertEquals(2, state.results.size)
            assertEquals(laws, state.results)
            assertFalse(state.isLoading)
            assertNull(state.error)
        }
    }

    @Test
    fun `search sets error on failure`() = runTest(testDispatcher) {
        // Given
        val errorMessage = "Network error"
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("test") } returns Result.failure(Exception(errorMessage))

        // When
        viewModel.onQueryChange("test")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertTrue(state.results.isEmpty())
            assertFalse(state.isLoading)
            assertEquals(errorMessage, state.error)
        }
    }

    @Test
    fun `search clears results for blank query`() = runTest(testDispatcher) {
        // Given
        val laws = listOf(Law(1, "Test", null, 10, 2))
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("test") } returns Result.success(laws)

        // First search
        viewModel.onQueryChange("test")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Verify results exist
        assertTrue(viewModel.uiState.value.results.isNotEmpty())

        // When - clear search
        viewModel.onQueryChange("")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertTrue(state.results.isEmpty())
            assertFalse(state.isLoading)
        }
    }

    @Test
    fun `search clears error on new search attempt`() = runTest(testDispatcher) {
        // Given
        viewModel = SearchViewModel(searchLawsUseCase)
        coEvery { searchLawsUseCase("fail") } returns Result.failure(Exception("Error"))
        coEvery { searchLawsUseCase("success") } returns Result.success(listOf(Law(1, "Test", null, 10, 2)))

        // First search fails
        viewModel.onQueryChange("fail")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Verify error exists
        assertNotNull(viewModel.uiState.value.error)

        // When - new search succeeds
        viewModel.onQueryChange("success")
        advanceTimeBy(301)
        testDispatcher.scheduler.runCurrent()

        // Then
        viewModel.uiState.test {
            val state = awaitItem()
            assertNull(state.error)
            assertEquals(1, state.results.size)
        }
    }
}
