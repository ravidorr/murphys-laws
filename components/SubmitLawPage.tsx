import { useState, useEffect } from 'react';
import { mockLaws, allTopics, allTags } from '../data/mockData';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Label } from './ui/label';
import { AlertCircle, CheckCircle, ArrowLeft, Plus } from 'lucide-react';

interface SubmitLawPageProps {
  isLoggedIn: boolean;
  currentUser?: string;
  onNavigate: (page: string, lawId?: string) => void;
}

export function SubmitLawPage({ isLoggedIn, currentUser, onNavigate }: SubmitLawPageProps) {
  const [lawText, setLawText] = useState('');
  const [author, setAuthor] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Check for duplicates as user types
  useEffect(() => {
    if (lawText.trim().length < 10) {
      setDuplicateWarning(null);
      return;
    }

    setCheckingDuplicate(true);
    
    const checkDuplicate = setTimeout(() => {
      const similar = mockLaws.find(law => {
        const similarity = calculateSimilarity(lawText.toLowerCase(), law.text.toLowerCase());
        return similarity > 0.7; // 70% similarity threshold
      });

      if (similar) {
        setDuplicateWarning(similar.id);
      } else {
        setDuplicateWarning(null);
      }
      setCheckingDuplicate(false);
    }, 500);

    return () => clearTimeout(checkDuplicate);
  }, [lawText]);

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity calculation based on common words
    const words1 = str1.split(' ').filter(w => w.length > 3);
    const words2 = str2.split(' ').filter(w => w.length > 3);
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  const handleAddTag = () => {
    const newTag = tagInput.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      setTags(prev => [...prev, newTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawText.trim() || !isLoggedIn) return;

    setIsSubmitting(true);

    // Simulate API submission
    setTimeout(() => {
      setIsSubmitting(false);
      // Reset form
      setLawText('');
      setAuthor('');
      setSelectedTopics([]);
      setTags([]);
      setTagInput('');
      
      // Navigate to success page or show success message
      onNavigate('submit-success');
    }, 2000);
  };

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-medium mb-4">Sign In Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to be signed in to submit new laws to the archive.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => onNavigate('login')}>
                Log In
              </Button>
              <Button variant="outline" onClick={() => onNavigate('signup')}>
                Sign Up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Back Navigation */}
      <Button 
        variant="ghost" 
        className="mb-6 gap-2"
        onClick={() => onNavigate('home')}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Submit a New Law</CardTitle>
          <p className="text-muted-foreground">
            Help build the definitive collection of Murphy's Laws. Your submission will be reviewed by moderators before publication.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Law Text */}
            <div className="space-y-2">
              <Label htmlFor="law-text">What is the law? *</Label>
              <Textarea
                id="law-text"
                placeholder="e.g., Anything that can go wrong will go wrong."
                value={lawText}
                onChange={(e) => setLawText(e.target.value)}
                rows={4}
                required
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground">
                Please be as concise and universal as possible.
              </p>
              
              {/* Duplicate Warning */}
              {duplicateWarning && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This looks similar to:{' '}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm underline"
                      onClick={() => onNavigate('law', duplicateWarning)}
                    >
                      View existing law
                    </Button>
                    . Please check to avoid duplicates.
                  </AlertDescription>
                </Alert>
              )}
              
              {checkingDuplicate && (
                <p className="text-sm text-muted-foreground">Checking for duplicates...</p>
              )}
            </div>

            {/* Author */}
            <div className="space-y-2">
              <Label htmlFor="author">Who is this law attributed to?</Label>
              <Input
                id="author"
                placeholder="e.g., 'Murphy', 'O'Toole', or leave blank for 'Anonymous'"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>

            {/* Topics */}
            <div className="space-y-3">
              <Label>Suggest a topic (optional)</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allTopics.map(topic => (
                  <div key={topic} className="flex items-center space-x-2">
                    <Checkbox
                      id={`topic-${topic}`}
                      checked={selectedTopics.includes(topic)}
                      onCheckedChange={() => handleTopicToggle(topic)}
                    />
                    <Label 
                      htmlFor={`topic-${topic}`}
                      className="text-sm cursor-pointer"
                    >
                      {topic}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-3">
              <Label>Add tags (optional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="gap-1 cursor-pointer"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      #{tag}
                      <span className="ml-1">×</span>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                <span className="text-sm text-muted-foreground">Suggestions:</span>
                {allTags.slice(0, 8).filter(tag => !tags.includes(tag)).map(tag => (
                  <Badge 
                    key={tag} 
                    variant="outline" 
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      if (!tags.includes(tag)) {
                        setTags(prev => [...prev, tag]);
                      }
                    }}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-between items-center pt-4">
              <p className="text-sm text-muted-foreground">
                Submitting as {currentUser}
              </p>
              <Button 
                type="submit" 
                disabled={!lawText.trim() || isSubmitting || !!duplicateWarning}
                className="gap-2"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Submission Guidelines */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Submission Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Make sure your law is universally applicable and not too specific</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Check that it hasn't already been submitted</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Provide attribution if you know the original source</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>Use clear, concise language that's easy to understand</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}