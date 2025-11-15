package com.murphyslaws.presentation.browse

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.collectAsLazyPagingItems
import com.murphyslaws.domain.model.Law
import com.murphyslaws.domain.model.VoteType

@Composable
fun BrowseScreen(
    onNavigateToLaw: (Int) -> Unit,
    viewModel: BrowseViewModel = hiltViewModel()
) {
    val laws = viewModel.laws.collectAsLazyPagingItems()

    Column(modifier = Modifier.fillMaxSize()) {
        // Law List
        LawList(
            laws = laws,
            onLawClick = onNavigateToLaw,
            onVote = { lawId, voteType ->
                viewModel.voteLaw(lawId, voteType)
            }
        )
    }
}

@Composable
fun LawList(
    laws: LazyPagingItems<Law>,
    onLawClick: (Int) -> Unit,
    onVote: (Int, VoteType) -> Unit
) {
    LazyColumn(modifier = Modifier.fillMaxSize()) {
        items(laws.itemCount) { index ->
            laws[index]?.let { law ->
                LawCard(
                    law = law,
                    onClick = { onLawClick(law.id) },
                    onVote = onVote
                )
            }
        }

        // Loading state
        when (laws.loadState.append) {
            is LoadState.Loading -> {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
            }
            else -> {}
        }
    }
}

@Composable
fun LawCard(
    law: Law,
    onClick: () -> Unit,
    onVote: (Int, VoteType) -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Title (if exists)
            law.title?.let { title ->
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Law text
            Text(
                text = law.text,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = if (law.title != null) 4.dp else 0.dp)
            )

            // Vote buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { onVote(law.id, VoteType.UP) }) {
                    Icon(
                        imageVector = Icons.Default.ThumbUp,
                        contentDescription = "Upvote"
                    )
                }
                Text(
                    text = law.upvotes.toString(),
                    style = MaterialTheme.typography.bodySmall
                )

                Spacer(modifier = Modifier.width(16.dp))

                IconButton(onClick = { onVote(law.id, VoteType.DOWN) }) {
                    Icon(
                        imageVector = Icons.Default.ThumbDown,
                        contentDescription = "Downvote"
                    )
                }
                Text(
                    text = law.downvotes.toString(),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
