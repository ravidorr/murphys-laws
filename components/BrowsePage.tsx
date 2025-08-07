import { useState, useMemo, useEffect } from 'react';
import { Law, mockLaws, allTopics, allTags } from '../data/mockData';
import { LawCard } from './LawCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Search, Filter, X, SortAsc } from 'lucide-react';

interface BrowsePageProps {
  isLoggedIn: boolean;
  searchQuery?: string;
  onNavigate: (page: string, lawId?: string) => void;
  onVote: (contentId: string, voteType: 'up' | 'down' | 'cancel') => void;
}

type SortOption = 'relevance' | 'top' | 'newest' | 'discussed';

export function BrowsePage({ isLoggedIn, searchQuery = '', onNavigate, onVote }: BrowsePageProps) {
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const filteredAndSortedLaws = useMemo(() => {
    let filtered = [...mockLaws];

    // Apply search filter
    if (localSearchQuery.trim()) {
      const query = localSearchQuery.toLowerCase();
      filtered = filtered.filter(law => 
        law.text.toLowerCase().includes(query) ||
        law.author?.toLowerCase().includes(query) ||
        law.topics.some(topic => topic.toLowerCase().includes(query)) ||
        law.tags.some(tag => tag.toLowerCase().includes(query)) ||
        law.stories.some(story => story.text.toLowerCase().includes(query))
      );
    }

    // Apply topic filters
    if (selectedTopics.length > 0) {
      filtered = filtered.filter(law => 
        law.topics.some(topic => selectedTopics.includes(topic))
      );
    }

    // Apply tag filters  
    if (selectedTags.length > 0) {
      filtered = filtered.filter(law => 
        law.tags.some(tag => selectedTags.includes(tag))
      );
    }

    // Apply sorting
    switch (sortBy) {
      case 'top':
        filtered.sort((a, b) => b.score - a.score);
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
        break;
      case 'discussed':
        filtered.sort((a, b) => b.stories.length - a.stories.length);
        break;
      case 'relevance':
      default:
        // For relevance, we'll use a combination of score and recency
        filtered.sort((a, b) => {
          const aRelevance = a.score + (new Date(a.publishDate).getTime() / 1000000000);
          const bRelevance = b.score + (new Date(b.publishDate).getTime() / 1000000000);
          return bRelevance - aRelevance;
        });
    }

    return filtered;
  }, [localSearchQuery, selectedTopics, selectedTags, sortBy]);

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearAllFilters = () => {
    setSelectedTopics([]);
    setSelectedTags([]);
    setLocalSearchQuery('');
  };

  const hasActiveFilters = selectedTopics.length > 0 || selectedTags.length > 0 || localSearchQuery.trim();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  {showFilters ? 'Hide' : 'Show'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className={`space-y-6 ${!showFilters ? 'hidden lg:block' : ''}`}>
              {/* Search */}
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search laws..."
                    value={localSearchQuery}
                    onChange={(e) => setLocalSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Topics Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Topics</label>
                <div className="space-y-2">
                  {allTopics.map(topic => {
                    const count = mockLaws.filter(law => law.topics.includes(topic)).length;
                    return (
                      <div key={topic} className="flex items-center space-x-2">
                        <Checkbox
                          id={`topic-${topic}`}
                          checked={selectedTopics.includes(topic)}
                          onCheckedChange={() => handleTopicToggle(topic)}
                        />
                        <label 
                          htmlFor={`topic-${topic}`}
                          className="text-sm flex-1 cursor-pointer"
                        >
                          {topic} ({count})
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tags Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Popular Tags</label>
                <div className="flex flex-wrap gap-1">
                  {allTags.slice(0, 10).map(tag => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <Badge 
                        key={tag}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => handleTagToggle(tag)}
                      >
                        #{tag}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="w-full gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Header with Sort */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                {localSearchQuery.trim() ? `Search Results for "${localSearchQuery}"` : 'Browse All Laws'}
              </h1>
              <p className="text-muted-foreground">
                Found {filteredAndSortedLaws.length} {filteredAndSortedLaws.length === 1 ? 'law' : 'laws'}
                {hasActiveFilters && ' matching your filters'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SortAsc className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Relevance / Score</SelectItem>
                  <SelectItem value="top">Top (All Time)</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="discussed">Most Discussed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(selectedTopics.length > 0 || selectedTags.length > 0) && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {selectedTopics.map(topic => (
                <Badge 
                  key={topic} 
                  variant="secondary" 
                  className="gap-1 cursor-pointer"
                  onClick={() => handleTopicToggle(topic)}
                >
                  {topic}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
              {selectedTags.map(tag => (
                <Badge 
                  key={tag} 
                  variant="outline" 
                  className="gap-1 cursor-pointer"
                  onClick={() => handleTagToggle(tag)}
                >
                  #{tag}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
            </div>
          )}

          {/* Results */}
          {filteredAndSortedLaws.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <h3 className="text-lg font-medium mb-2">No results found</h3>
                <p className="text-muted-foreground mb-6">
                  {localSearchQuery.trim() ? (
                    <>No results found for "{localSearchQuery}". Perhaps you've discovered a new law?</>
                  ) : (
                    "No laws match your current filters."
                  )}
                </p>
                <div className="flex gap-2 justify-center">
                  {localSearchQuery.trim() && (
                    <Button onClick={() => onNavigate('submit')}>
                      Submit This Law
                    </Button>
                  )}
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearAllFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedLaws.map(law => (
                <LawCard
                  key={law.id}
                  law={law}
                  isLoggedIn={isLoggedIn}
                  onLawClick={(lawId) => onNavigate('law', lawId)}
                  onVote={onVote}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}