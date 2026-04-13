import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { user, login, register, loginWithGoogle, handleGoogleCallback } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasProcessedCallback = useRef(false);
  
  // Form state
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '' });

  // Check for Google OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('session_id=') && !hasProcessedCallback.current) {
      hasProcessedCallback.current = true;
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        setLoading(true);
        handleGoogleCallback(sessionId).then((result) => {
          if (result.success) {
            // Clear the hash and navigate
            window.history.replaceState(null, '', window.location.pathname);
            navigate('/dashboard');
          } else {
            setError(result.error);
            setLoading(false);
          }
        });
      }
    }
  }, [handleGoogleCallback, navigate]);

  // Redirect if already logged in
  useEffect(() => {
    if (user && user !== false) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await login(loginForm.email, loginForm.password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const result = await register(registerForm.email, registerForm.password, registerForm.name);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="font-heading text-3xl font-bold text-fg-default mb-2">
              LedgerLens
            </h1>
            <p className="text-fg-secondary">
              AI-powered personal finance tracker
            </p>
          </div>

          <Card className="border-border-color shadow-sm">
            <CardHeader className="pb-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">Sign Up</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="auth-error">
                  {error}
                </div>
              )}

              {activeTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                      required
                      data-testid="login-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        required
                        data-testid="login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    <Link 
                      to="/forgot-password" 
                      className="text-sm text-accent-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-accent-primary hover:bg-accent-primary/90"
                    disabled={loading}
                    data-testid="login-submit"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Your name"
                      value={registerForm.name}
                      onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                      required
                      data-testid="register-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                      required
                      data-testid="register-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create a password (min 6 chars)"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        required
                        minLength={6}
                        data-testid="register-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-accent-primary hover:bg-accent-primary/90"
                    disabled={loading}
                    data-testid="register-submit"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              )}

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border-color"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-fg-muted">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-4"
                  onClick={loginWithGoogle}
                  disabled={loading}
                  data-testid="google-login"
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Image */}
      <div 
        className="hidden lg:block flex-1 bg-cover bg-center relative"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1721383168321-a013f8ae890f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwY2FsbSUyMHdvcmtzcGFjZSUyMGRlc2t8ZW58MHx8fHwxNzc2MDg4MTY1fDA&ixlib=rb-4.1.0&q=85)'
        }}
      >
        <div className="absolute inset-0 bg-accent-primary/10"></div>
        <div className="absolute bottom-8 left-8 right-8 p-6 bg-white/90 backdrop-blur-sm rounded-lg">
          <h2 className="font-heading text-xl font-semibold text-fg-default mb-2">
            Smart Financial Analysis
          </h2>
          <p className="text-fg-secondary">
            Upload your bank statements and let AI help you understand your spending patterns, 
            detect recurring payments, and generate insightful reports.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
