import { useState, useEffect } from 'react';
import { Law, mockLaws } from '../data/mockData';
import { LawCard } from './LawCard';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Calendar, TrendingUp, Clock, Star } from 'lucide-react';

interface HomePageProps {
  isLoggedIn: boolean;
  onNavigate: (page: string, lawId?: string) => void;
  onVote: (contentId: string, voteType: 'up' | 'down' | 'cancel') => void;
}

export function HomePage({ isLoggedIn, onNavigate, onVote }: HomePageProps) {
  const [lawOfTheDay, setLawOfTheDay] = useState<Law | null>(null);
  const [topVotedLaws, setTopVotedLaws] = useState<Law[]>([]);
  const [trendingLaws, setTrendingLaws] = useState<Law[]>([]);
  const [recentLaws, setRecentLaws] = useState<Law[]>([]);

  useEffect(() => {
    // Simulate Law of the Day selection (highest scoring from yesterday)
    const sortedByScore = [...mockLaws].sort((a, b) => b.score - a.score);
    setLawOfTheDay(sortedByScore[0]);

    // Top voted laws (all time)
    setTopVotedLaws(sortedByScore.slice(0, 5));

    // Trending laws (simulate recent activity)
    const shuffled = [...mockLaws].sort(() => Math.random() - 0.5);
    setTrendingLaws(shuffled.slice(0, 3));

    // Recently added laws
    const sortedByDate = [...mockLaws].sort((a, b) => 
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );
    setRecentLaws(sortedByDate.slice(0, 3));
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Murphy's Law Archive
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          If it can go wrong, you'll find it here.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={() => onNavigate('submit')}
            className="gap-2"
          >
            Submit a Law
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            onClick={() => onNavigate('browse')}
            className="gap-2"
          >
            Browse All Laws
          </Button>
        </div>
      </div>

      {/* Law of the Day */}
      {lawOfTheDay && (
        <Card className="mb-12 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Star className="w-6 h-6 text-yellow-500" />
              Law of the Day
              <Badge variant="secondary" className="ml-2">
                {formatDate(new Date().toISOString())}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="cursor-pointer"
              onClick={() => onNavigate('law', lawOfTheDay.id)}
            >
              <blockquote className="text-2xl italic border-l-4 border-primary pl-6 mb-4">
                "{lawOfTheDay.text}"
              </blockquote>
              {lawOfTheDay.author && (
                <p className="text-lg text-muted-foreground mb-4">— {lawOfTheDay.author}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Score: +{lawOfTheDay.score}</span>
                <span>Submitted by {lawOfTheDay.submittedBy}</span>
                {lawOfTheDay.stories.length > 0 && (
                  <span>{lawOfTheDay.stories.length} stories</span>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Button variant="link" onClick={() => onNavigate('law-history')} className="p-0">
                View History →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {/* Top Voted Laws */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top Voted
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topVotedLaws.map((law, index) => (
              <div 
                key={law.id} 
                className="cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={() => onNavigate('law', law.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="font-bold text-primary text-sm w-6">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{law.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">+{law.score}</Badge>
                      {law.author && (
                        <span className="text-xs text-muted-foreground">— {law.author}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trending Laws */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Trending Now
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trendingLaws.map((law) => (
              <div 
                key={law.id} 
                className="cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={() => onNavigate('law', law.id)}
              >
                <p className="text-sm">{law.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">+{law.score}</Badge>
                  {law.author && (
                    <span className="text-xs text-muted-foreground">— {law.author}</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recently Added */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Recently Added
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLaws.map((law) => (
              <div 
                key={law.id} 
                className="cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={() => onNavigate('law', law.id)}
              >
                <p className="text-sm">{law.text}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">+{law.score}</Badge>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs text-muted-foreground">
                      {formatDate(law.publishDate)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <Card className="bg-muted/30">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl mb-4">Join the Community</h3>
          <p className="text-muted-foreground mb-6">
            Contribute to the definitive collection of Murphy's Laws. Share your discoveries, 
            vote on the best laws, and tell your stories of when things went wonderfully wrong.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isLoggedIn && (
              <Button onClick={() => onNavigate('signup')}>
                Sign Up to Contribute
              </Button>
            )}
            <Button variant="outline" onClick={() => onNavigate('submit')}>
              Submit a New Law
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}