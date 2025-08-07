import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';

interface VotingControlsProps {
  contentId: string;
  contentType: 'law' | 'story';
  initialScore: number;
  initialUpvotes: number;
  initialDownvotes: number;
  isLoggedIn: boolean;
  onVote?: (contentId: string, voteType: 'up' | 'down' | 'cancel') => void;
}

export function VotingControls({ 
  contentId, 
  contentType, 
  initialScore,
  initialUpvotes,
  initialDownvotes,
  isLoggedIn,
  onVote 
}: VotingControlsProps) {
  const [currentVote, setCurrentVote] = useState<'up' | 'down' | null>(null);
  const [score, setScore] = useState(initialScore);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!isLoggedIn) {
      // In a real app, this would show a login prompt
      alert('Please log in to vote');
      return;
    }

    setIsVoting(true);

    // Calculate score change based on current state and new vote
    let scoreChange = 0;
    
    if (currentVote === voteType) {
      // Cancel vote
      scoreChange = voteType === 'up' ? -1 : 1;
      setCurrentVote(null);
      onVote?.(contentId, 'cancel');
    } else if (currentVote === null) {
      // New vote
      scoreChange = voteType === 'up' ? 1 : -1;
      setCurrentVote(voteType);
      onVote?.(contentId, voteType);
    } else {
      // Switch vote
      scoreChange = voteType === 'up' ? 2 : -2;
      setCurrentVote(voteType);
      onVote?.(contentId, voteType);
    }

    setScore(prev => prev + scoreChange);
    
    // Simulate API call delay
    setTimeout(() => {
      setIsVoting(false);
    }, 200);
  };

  return (
    <div className="flex flex-col items-center gap-1 min-w-[3rem]">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('up')}
        disabled={isVoting}
        className={`p-1 h-8 w-8 hover:bg-green-100 dark:hover:bg-green-900/20 ${
          currentVote === 'up' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : ''
        }`}
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
      
      <span className={`text-sm font-medium min-w-[2rem] text-center ${
        score > 0 ? 'text-green-600 dark:text-green-400' : 
        score < 0 ? 'text-red-600 dark:text-red-400' : 
        'text-muted-foreground'
      }`}>
        {score > 0 ? `+${score}` : score}
      </span>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote('down')}
        disabled={isVoting}
        className={`p-1 h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/20 ${
          currentVote === 'down' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ''
        }`}
      >
        <ChevronDown className="w-4 h-4" />
      </Button>
    </div>
  );
}