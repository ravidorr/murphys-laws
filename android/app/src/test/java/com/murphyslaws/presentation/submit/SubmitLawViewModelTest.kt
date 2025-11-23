package com.murphyslaws.presentation.submit

import app.cash.turbine.test
import com.murphyslaws.domain.usecase.SubmitLawUseCase
import io.mockk.Called
import io.mockk.coEvery
import io.mockk.coVerify
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
class SubmitLawViewModelTest {

    private lateinit var submitLawUseCase: SubmitLawUseCase
    private lateinit var viewModel: SubmitLawViewModel
    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        submitLawUseCase = mockk()
        viewModel = SubmitLawViewModel(submitLawUseCase)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `initial state is empty`() = runTest(testDispatcher) {
        viewModel.uiState.test {
            val state = awaitItem()
            assertTrue(state.text.isEmpty())
            assertTrue(state.title.isEmpty())
            assertTrue(state.name.isEmpty())
            assertTrue(state.email.isEmpty())
            assertFalse(state.isLoading)
            assertFalse(state.success)
            assertNull(state.error)
        }
    }

    @Test
    fun `onTextChange updates text state`() = runTest(testDispatcher) {
        viewModel.onTextChange("New Text")
        assertEquals("New Text", viewModel.uiState.value.text)
    }

    @Test
    fun `onTitleChange updates title state`() = runTest(testDispatcher) {
        viewModel.onTitleChange("New Title")
        assertEquals("New Title", viewModel.uiState.value.title)
    }

    @Test
    fun `onNameChange updates name state`() = runTest(testDispatcher) {
        viewModel.onNameChange("New Name")
        assertEquals("New Name", viewModel.uiState.value.name)
    }

    @Test
    fun `onEmailChange updates email state`() = runTest(testDispatcher) {
        viewModel.onEmailChange("New Email")
        assertEquals("New Email", viewModel.uiState.value.email)
    }

    @Test
    fun `submitLaw does nothing if text is blank`() = runTest(testDispatcher) {
        // Given
        viewModel.onTextChange("   ")

        // When
        viewModel.submitLaw()
        testDispatcher.scheduler.runCurrent()

        // Then
        assertFalse(viewModel.uiState.value.isLoading)
        coVerify { submitLawUseCase wasNot Called }
    }

    @Test
    fun `submitLaw handles success`() = runTest(testDispatcher) {
        // Given
        viewModel.onTextChange("My Law")
        viewModel.onTitleChange("Title")
        coEvery { submitLawUseCase(any(), any(), any(), any()) } returns Result.success(Unit)

        // When
        viewModel.submitLaw()

        // Then
        viewModel.uiState.test {
            // 1. Initial state (with text set)
            val initialState = awaitItem()
            assertEquals("My Law", initialState.text)

            // 2. Loading state
            testDispatcher.scheduler.runCurrent()
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)
            assertNull(loadingState.error)
            assertFalse(loadingState.success)

            // 3. Success state
            testDispatcher.scheduler.runCurrent()
            val successState = awaitItem()
            assertFalse(successState.isLoading)
            assertTrue(successState.success)
            assertTrue(successState.text.isEmpty()) // Form cleared
            assertTrue(successState.title.isEmpty())
        }
    }

    @Test
    fun `submitLaw handles failure`() = runTest(testDispatcher) {
        // Given
        viewModel.onTextChange("My Law")
        val errorMessage = "Network error"
        coEvery { submitLawUseCase(any(), any(), any(), any()) } returns Result.failure(Exception(errorMessage))

        // When
        viewModel.submitLaw()

        // Then
        viewModel.uiState.test {
            // 1. Initial state
            val initialState = awaitItem()
            assertEquals("My Law", initialState.text)

            // 2. Loading state
            testDispatcher.scheduler.runCurrent()
            val loadingState = awaitItem()
            assertTrue(loadingState.isLoading)

            // 3. Error state
            testDispatcher.scheduler.runCurrent()
            val errorState = awaitItem()
            assertFalse(errorState.isLoading)
            assertFalse(errorState.success)
            assertEquals(errorMessage, errorState.error)
            assertEquals("My Law", errorState.text) // Text preserved
        }
    }

    @Test
    fun `resetState clears success and error`() = runTest(testDispatcher) {
        // Given - set up error state
        viewModel.onTextChange("My Law")
        coEvery { submitLawUseCase(any(), any(), any(), any()) } returns Result.failure(Exception("Error"))
        viewModel.submitLaw()
        testDispatcher.scheduler.runCurrent()
        
        assertTrue(viewModel.uiState.value.error != null)

        // When
        viewModel.resetState()

        // Then
        val state = viewModel.uiState.value
        assertNull(state.error)
        assertFalse(state.success)
        assertFalse(state.isLoading)
        assertEquals("My Law", state.text) // Text preserved
    }
}
