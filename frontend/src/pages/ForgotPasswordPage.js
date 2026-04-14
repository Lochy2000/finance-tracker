import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { formatApiErrorDetail } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-bg-default">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg-default mb-4">
            <ArrowLeft className="w-4 h-4" />Back to login
          </Link>
          <h1 className="font-heading text-3xl font-bold text-fg-default mb-2">Reset Password</h1>
          <p className="text-fg-secondary">Enter your email and we'll send you a reset link</p>
        </div>

        <Card className="border-border-color shadow-sm">
          <CardContent className="pt-6">
            {sent ? (
              <div className="text-center py-4" data-testid="reset-sent">
                <CheckCircle className="w-12 h-12 text-accent-positive mx-auto mb-4" />
                <h3 className="text-lg font-medium text-fg-default mb-2">Check your email</h3>
                <p className="text-fg-muted mb-6">
                  If an account exists with <strong>{email}</strong>, we've sent a password reset link.
                </p>
                <Button variant="outline" onClick={() => navigate('/login')}>Return to Login</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm" data-testid="reset-error">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email address</Label>
                  <Input id="reset-email" type="email" placeholder="you@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required data-testid="reset-email" />
                </div>
                <Button type="submit" className="w-full bg-accent-primary hover:bg-accent-primary/90" disabled={loading} data-testid="reset-submit">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
