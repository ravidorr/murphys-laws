package com.murphyslaws.presentation.submit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.murphyslaws.ui.components.DSButton
import com.murphyslaws.ui.components.DSOutlinedTextField
import com.murphyslaws.ui.theme.DS

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubmitLawScreen(
    viewModel: SubmitLawViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()

    if (uiState.success) {
        AlertDialog(
            onDismissRequest = { viewModel.resetState() },
            title = { Text("Success") },
            text = { Text("Your law has been submitted successfully!") },
            confirmButton = {
                TextButton(onClick = { viewModel.resetState() }) {
                    Text("OK")
                }
            }
        )
    }

    if (uiState.error != null) {
        AlertDialog(
            onDismissRequest = { viewModel.resetState() },
            title = { Text("Error") },
            text = { Text(uiState.error!!) },
            confirmButton = {
                TextButton(onClick = { viewModel.resetState() }) {
                    Text("OK")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Submit Law") }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(scrollState)
                .padding(DS.Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(DS.Spacing.s4)
        ) {
            Text(
                text = "Have a Murphy's Law to share? Submit it here!",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Law Text (Required)
            DSOutlinedTextField(
                value = uiState.text,
                onValueChange = { viewModel.onTextChange(it) },
                label = "Law Text (Required)",
                modifier = Modifier
                    .fillMaxWidth()
                    .height(DS.Spacing.s10 + DS.Spacing.s16 + DS.Spacing.s6),
                maxLines = 5,
                isError = uiState.text.isBlank() && uiState.isLoading // Show error only if tried to submit empty? No, just validation
            )

            // Title (Optional)
            DSOutlinedTextField(
                value = uiState.title,
                onValueChange = { viewModel.onTitleChange(it) },
                label = "Title (Optional)",
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Name (Optional)
            DSOutlinedTextField(
                value = uiState.name,
                onValueChange = { viewModel.onNameChange(it) },
                label = "Your Name (Optional)",
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Email (Optional)
            DSOutlinedTextField(
                value = uiState.email,
                onValueChange = { viewModel.onEmailChange(it) },
                label = "Your Email (Optional)",
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
            )

            Spacer(modifier = Modifier.height(DS.Spacing.s2))

            DSButton(
                onClick = { viewModel.submitLaw() },
                modifier = Modifier.fillMaxWidth(),
                enabled = uiState.text.isNotBlank() && !uiState.isLoading
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(DS.Spacing.s6),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Submit Law")
                }
            }
        }
    }
}
