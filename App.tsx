import { useState } from 'react';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { BrowsePage } from './components/BrowsePage';
import { LawDetailPage } from './components/LawDetailPage';
import { SubmitLawPage } from './components/SubmitLawPage';
import { AuthPage } from './components/AuthPages';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';

type Page = 'home' | 'browse' | 'law' | 'submit' | 'login' | 'signup' | 'profile' | 'submit-success' | 'law-history';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [currentLawId, setCurrentLawId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const handleNavigate = (page: string, lawId?: string) => {
    setCurrentPage(page as Page);
    if (lawId) {
      setCurrentLawId(lawId);
    }
    // Clear search when navigating away from search results
    if (page !== 'browse') {
      setSearchQuery('');
    }
    // Scroll to top
    window.scrollTo(0, 0);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage('browse');
  };

  const handleAuth = (username: string) => {
    setIsLoggedIn(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('home');
  };

  const handleVote = (contentId: string, voteType: 'up' | 'down' | 'cancel') => {
    // In a real app, this would make an API call to record the vote
    console.log(`Vote: ${voteType} on ${contentId}`);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            isLoggedIn={isLoggedIn}
            onNavigate={handleNavigate}
            onVote={handleVote}
          />
        );

      case 'browse':
        return (
          <BrowsePage
            isLoggedIn={isLoggedIn}
            searchQuery={searchQuery}
            onNavigate={handleNavigate}
            onVote={handleVote}
          />
        );

      case 'law':
        return currentLawId ? (
          <LawDetailPage
            lawId={currentLawId}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser || undefined}
            onNavigate={handleNavigate}
            onVote={handleVote}
          />
        ) : (
          <div className="container mx-auto px-4 py-8">
            <Card>
              <CardContent className="p-12 text-center">
                <h2 className="text-xl font-medium mb-4">Law Not Found</h2>
                <Button onClick={() => handleNavigate('browse')}>
                  Browse All Laws
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'submit':
        return (
          <SubmitLawPage
            isLoggedIn={isLoggedIn}
            currentUser={currentUser || undefined}
            onNavigate={handleNavigate}
          />
        );

      case 'login':
        return (
          <AuthPage
            type="login"
            onNavigate={handleNavigate}
            onAuth={handleAuth}
          />
        );

      case 'signup':
        return (
          <AuthPage
            type="signup"
            onNavigate={handleNavigate}
            onAuth={handleAuth}
          />
        );

      case 'submit-success':
        return (
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Button 
              variant="ghost" 
              className="mb-6 gap-2"
              onClick={() => handleNavigate('home')}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
            
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
                <h2 className="text-2xl font-medium mb-4">Thank You for Your Submission!</h2>
                <p className="text-muted-foreground mb-6">
                  Your law is now pending review by our moderators. You can track its status on your profile page. 
                  We'll notify you once it's been reviewed.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => handleNavigate('submit')}>
                    Submit Another Law
                  </Button>
                  <Button variant="outline" onClick={() => handleNavigate('profile')}>
                    View My Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'profile':
        return (
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Card>
              <CardContent className="p-12 text-center">
                <h2 className="text-xl font-medium mb-4">User Profile</h2>
                <p className="text-muted-foreground mb-6">
                  Profile functionality coming soon! You'll be able to view your submitted laws, 
                  stories, and track their status here.
                </p>
                <Button onClick={() => handleNavigate('home')}>
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'law-history':
        return (
          <div className="container mx-auto px-4 py-8 max-w-2xl">
            <Card>
              <CardContent className="p-12 text-center">
                <h2 className="text-xl font-medium mb-4">Law of the Day History</h2>
                <p className="text-muted-foreground mb-6">
                  Historical archive of previous "Law of the Day" selections coming soon!
                </p>
                <Button onClick={() => handleNavigate('home')}>
                  Back to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return (
          <HomePage
            isLoggedIn={isLoggedIn}
            onNavigate={handleNavigate}
            onVote={handleVote}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        onSearch={handleSearch}
        onNavigate={handleNavigate}
        currentPage={currentPage}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser || undefined}
      />
      
      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      <footer className="border-t bg-muted/30 py-12 mt-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-medium mb-4">Murphy's Law Archive</h4>
              <p className="text-sm text-muted-foreground">
                The definitive, community-curated online repository of Murphy's Laws and their corollaries.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Browse</h4>
              <div className="space-y-2 text-sm">
                <Button variant="link" className="p-0 h-auto text-left justify-start" onClick={() => handleNavigate('browse')}>
                  All Laws
                </Button>
                <Button variant="link" className="p-0 h-auto text-left justify-start" onClick={() => handleNavigate('browse')}>
                  Top Voted
                </Button>
                <Button variant="link" className="p-0 h-auto text-left justify-start" onClick={() => handleNavigate('browse')}>
                  Recently Added
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-4">Contribute</h4>
              <div className="space-y-2 text-sm">
                <Button variant="link" className="p-0 h-auto text-left justify-start" onClick={() => handleNavigate('submit')}>
                  Submit a Law
                </Button>
                {!isLoggedIn && (
                  <Button variant="link" className="p-0 h-auto text-left justify-start" onClick={() => handleNavigate('signup')}>
                    Join Community
                  </Button>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-4">Community</h4>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">A platform for sharing the wisdom of things going wrong.</p>
              </div>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2024 Murphy's Law Archive. Built with React and Tailwind CSS.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}