import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

interface AuthPageProps {
  type: 'login' | 'signup';
  onNavigate: (page: string) => void;
  onAuth: (username: string) => void;
}

export function AuthPage({ type, onNavigate, onAuth }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (type === 'signup' && !username)) return;

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      // In a real app, this would handle actual authentication
      onAuth(type === 'signup' ? username : email.split('@')[0]);
      onNavigate('home');
    }, 1500);
  };

  const handleSocialLogin = (provider: string) => {
    // Simulate social login
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onAuth(`${provider}User`);
      onNavigate('home');
    }, 1000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
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
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {type === 'login' ? 'Welcome Back' : 'Join the Community'}
          </CardTitle>
          <p className="text-muted-foreground">
            {type === 'login' 
              ? 'Sign in to vote, contribute, and share your stories'
              : 'Create an account to start contributing to the archive'
            }
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Social Login */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleSocialLogin('Google')}
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => handleSocialLogin('Facebook')}
              disabled={isSubmitting}
            >
              <svg className="w-4 h-4" fill="#1877F2" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Facebook
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {type === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {type === 'login' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="remember" className="text-sm">Remember me</Label>
                </div>
                <Button variant="link" className="p-0 h-auto text-sm">
                  Forgot password?
                </Button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !email || !password || (type === 'signup' && !username)}
            >
              {isSubmitting ? 'Please wait...' : (type === 'login' ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          {/* Switch Auth Type */}
          <div className="text-center text-sm text-muted-foreground">
            {type === 'login' ? "Don't have an account?" : 'Already have an account?'}
            {' '}
            <Button
              variant="link"
              className="p-0 h-auto text-sm"
              onClick={() => onNavigate(type === 'login' ? 'signup' : 'login')}
            >
              {type === 'login' ? 'Sign up' : 'Sign in'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {type === 'signup' && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground text-center">
              By creating an account, you agree to our Terms of Service and Privacy Policy. 
              We're committed to protecting your privacy and will never share your personal information.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}