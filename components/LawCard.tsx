import { Law } from '../data/mockData';
import { VotingControls } from './VotingControls';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { MessageSquare, Calendar, User } from 'lucide-react';

interface LawCardProps {
  law: Law;
  isLoggedIn: boolean;
  onLawClick: (lawId: string) => void;
  onVote?: (contentId: string, voteType: 'up' | 'down' | 'cancel') => void;
}

export function LawCard({ law, isLoggedIn, onLawClick, onVote }: LawCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6">
        <div className="flex gap-4">
          <VotingControls
            contentId={law.id}
            contentType="law"
            initialScore={law.score}
            initialUpvotes={law.upvotes}
            initialDownvotes={law.downvotes}
            isLoggedIn={isLoggedIn}
            onVote={onVote}
          />
          
          <div className="flex-1 space-y-3">
            <div onClick={() => onLawClick(law.id)}>
              <blockquote className="text-lg italic border-l-4 border-primary pl-4 mb-3">
                "{law.text}"
              </blockquote>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                {law.author && (
                  <span>— {law.author}</span>
                )}
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Submitted by {law.submittedBy}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(law.publishDate)}</span>
                </div>
                {law.stories.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{law.stories.length} {law.stories.length === 1 ? 'story' : 'stories'}</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1">
                {law.topics.map(topic => (
                  <Badge key={topic} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
                {law.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}