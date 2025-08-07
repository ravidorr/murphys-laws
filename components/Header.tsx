import { useState } from 'react';
import { Search, Menu, User, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

interface HeaderProps {
  onSearch: (query: string) => void;
  onNavigate: (page: string) => void;
  currentPage: string;
  isLoggedIn: boolean;
  currentUser?: string;
}

export function Header({ onSearch, onNavigate, currentPage, isLoggedIn, currentUser }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const NavigationLinks = () => (
    <>
      <Button 
        variant={currentPage === 'home' ? 'default' : 'ghost'}
        onClick={() => onNavigate('home')}
      >
        Home
      </Button>
      <Button 
        variant={currentPage === 'browse' ? 'default' : 'ghost'}
        onClick={() => onNavigate('browse')}
      >
        Browse All Laws
      </Button>
      <Button 
        variant={currentPage === 'submit' ? 'default' : 'ghost'}
        onClick={() => onNavigate('submit')}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Submit a Law
      </Button>
    </>
  );

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onNavigate('home')}
          >
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-primary-foreground font-bold">M</span>
            </div>
            <span className="font-semibold hidden sm:inline">Murphy's Law Archive</span>
            <span className="font-semibold sm:hidden">MLA</span>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search laws..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          </form>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <NavigationLinks />
            
            {isLoggedIn ? (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => onNavigate('profile')}
              >
                <User className="w-4 h-4" />
                {currentUser}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => onNavigate('login')}
                >
                  Log In
                </Button>
                <Button 
                  onClick={() => onNavigate('signup')}
                >
                  Sign Up
                </Button>
              </div>
            )}
          </nav>

          {/* Mobile Navigation */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <nav className="flex flex-col gap-4 mt-8">
                <NavigationLinks />
                
                {isLoggedIn ? (
                  <Button 
                    variant="outline" 
                    className="gap-2 justify-start"
                    onClick={() => onNavigate('profile')}
                  >
                    <User className="w-4 h-4" />
                    {currentUser}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => onNavigate('login')}
                    >
                      Log In
                    </Button>
                    <Button 
                      onClick={() => onNavigate('signup')}
                    >
                      Sign Up
                    </Button>
                  </div>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}