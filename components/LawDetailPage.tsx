import { useState, useMemo } from 'react';
import { Law, Story, mockLaws, mockStories } from '../data/mockData';
import { VotingControls } from './VotingControls';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Share2, Calendar, User, MessageSquare, ArrowLeft } from 'lucide-react';

interface LawDetailPageProps {
  lawId: string;
  isLoggedIn: boolean;
  currentUser?: string;
  onNavigate: (page: string, lawId?: string) => void;
  onVote: (contentId: string, voteType: 'up' | 'down' | 'cancel') => void;
}

export function LawDetailPage({ lawId, isLoggedIn, currentUser, onNavigate, onVote }: LawDetailPageProps) {
  const [newStory, setNewStory] = useState('');
  const [isSubmittingStory, setIsSubmittingStory] = useState(false);

  const law = useMemo(() => 
    mockLaws.find(l => l.id === lawId), 
    [lawId]
  );

  if (!law) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-medium mb-4">Law Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The law you're looking for doesn't exist or may have been removed.
            </p>
            <Button onClick={() => onNavigate('browse')}>
              Browse All Laws
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleStorySubmit = async () => {
    if (!newStory.trim() || !isLoggedIn) return;

    setIsSubmittingStory(true);
    
    // Simulate API call
    setTimeout(() => {
      setNewStory('');
      setIsSubmittingStory(false);
      // In a real app, this would add the story to the law
    }, 1000);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Murphy's Law: ${law.text}`,
          text: `"${law.text}" ${law.author ? `— ${law.author}` : ''}`,
          url: url
        });
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(url);
      }
    } else {
      navigator.clipboard.writeText(url);
      // In a real app, show a toast notification
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Navigation */}
      <Button 
        variant="ghost" 
        className="mb-6 gap-2"
        onClick={() => onNavigate('browse')}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Browse
      </Button>

      {/* Main Law Card */}
      <Card className="mb-8">
        <CardContent className="p-8">
          <div className="flex gap-6">
            <VotingControls
              contentId={law.id}
              contentType="law"
              initialScore={law.score}
              initialUpvotes={law.upvotes}
              initialDownvotes={law.downvotes}
              isLoggedIn={isLoggedIn}
              onVote={onVote}
            />
            
            <div className="flex-1 space-y-4">
              <blockquote className="text-2xl md:text-3xl italic border-l-4 border-primary pl-6">
                "{law.text}"
              </blockquote>
              
              {law.author && (
                <p className="text-xl text-muted-foreground">— {law.author}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>Submitted by {law.submittedBy}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Published on {formatDate(law.publishDate)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>{law.stories.length} {law.stories.length === 1 ? 'story' : 'stories'}</span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {law.topics.map(topic => (
                  <Badge key={topic} variant="secondary">
                    {topic}
                  </Badge>
                ))}
                {law.tags.map(tag => (
                  <Badge key={tag} variant="outline">
                    #{tag}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stories Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Stories from the Trenches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Story Submission Form */}
          <div className="space-y-4">
            <h4 className="font-medium">Share Your Story</h4>
            {isLoggedIn ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Tell us about a time this law proved itself true in your experience..."
                  value={newStory}
                  onChange={(e) => setNewStory(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Signed in as {currentUser}
                  </p>
                  <Button 
                    onClick={handleStorySubmit}
                    disabled={!newStory.trim() || isSubmittingStory}
                  >
                    {isSubmittingStory ? 'Posting...' : 'Post Story'}
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="bg-muted/30">
                <CardContent className="p-4 text-center">
                  <p className="text-muted-foreground mb-3">
                    Sign in to share your own story about this law
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" onClick={() => onNavigate('login')}>
                      Log In
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onNavigate('signup')}>
                      Sign Up
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {law.stories.length > 0 && <Separator />}

          {/* Existing Stories */}
          <div className="space-y-6">
            {law.stories.map(story => (
              <div key={story.id} className="flex gap-4">
                <VotingControls
                  contentId={story.id}
                  contentType="story"
                  initialScore={story.score}
                  initialUpvotes={story.upvotes}
                  initialDownvotes={story.downvotes}
                  isLoggedIn={isLoggedIn}
                  onVote={onVote}
                />
                
                <div className="flex-1 space-y-2">
                  <p className="text-base leading-relaxed">{story.text}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{story.submittedBy}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(story.submissionDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {law.stories.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No stories yet. Be the first to share your experience!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}