import React, { useState, useEffect } from 'react';
import { insightsApi } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  RefreshCw,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  PiggyBank
} from 'lucide-react';

export function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const response = await insightsApi.getAll();
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <InsightsSkeleton />;
  }

  return (
    <div className="space-y-6 animate-fade-in" data-testid="insights-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">
            AI Insights
          </h1>
          <p className="text-fg-secondary mt-1">
            Smart analysis of your spending patterns
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Sparkles className="w-4 h-4 text-accent-ai" />
          <span>Powered by AI</span>
        </div>
      </div>

      {data?.message && !data.recurring_payments?.length && (
        <Card className="border-border-color ai-panel">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-accent-ai mx-auto mb-4" />
            <h3 className="text-lg font-medium text-fg-default mb-2">
              No Insights Yet
            </h3>
            <p className="text-fg-muted">
              {data.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Month Comparison */}
      {data?.month_comparison && (
        <Card className="border-border-color ai-panel" data-testid="month-comparison">
          <CardHeader>
            <div className="flex items-center gap-2">
              {data.month_comparison.trend === 'increased' ? (
                <TrendingUp className="w-5 h-5 text-accent-ai" />
              ) : data.month_comparison.trend === 'decreased' ? (
                <TrendingDown className="w-5 h-5 text-accent-positive" />
              ) : (
                <RefreshCw className="w-5 h-5 text-fg-muted" />
              )}
              <CardTitle className="font-heading text-lg">Month Over Month</CardTitle>
            </div>
            <CardDescription>How your spending compares to last month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white rounded-lg border border-border-color">
                <p className="text-sm text-fg-muted mb-1">This Month</p>
                <p className="text-2xl font-heading font-bold text-fg-default">
                  {formatCurrency(data.month_comparison.current_total)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-border-color">
                <p className="text-sm text-fg-muted mb-1">Last Month</p>
                <p className="text-2xl font-heading font-bold text-fg-default">
                  {formatCurrency(data.month_comparison.previous_total)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border border-border-color">
                <p className="text-sm text-fg-muted mb-1">Change</p>
                <p className={`text-2xl font-heading font-bold flex items-center justify-center gap-1 ${
                  data.month_comparison.percent_change > 0 ? 'text-accent-ai' : 'text-accent-positive'
                }`}>
                  {data.month_comparison.percent_change > 0 ? (
                    <ArrowUpRight className="w-5 h-5" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5" />
                  )}
                  {Math.abs(data.month_comparison.percent_change)}%
                </p>
              </div>
            </div>

            {/* Category Changes */}
            {data.month_comparison.category_changes?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-fg-secondary mb-3">
                  Biggest Category Changes
                </h4>
                <div className="space-y-2">
                  {data.month_comparison.category_changes.slice(0, 3).map((change) => (
                    <div 
                      key={change.category}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-border-color"
                    >
                      <span className="font-medium text-fg-default">{change.category}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-fg-muted">
                          {formatCurrency(change.previous)} → {formatCurrency(change.current)}
                        </span>
                        <Badge variant={change.change_percent > 0 ? "destructive" : "secondary"}>
                          {change.change_percent > 0 ? '+' : ''}{change.change_percent}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recurring Payments */}
        <Card className="border-border-color" data-testid="recurring-payments">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Repeat className="w-5 h-5 text-accent-primary" />
              <CardTitle className="font-heading text-lg">Recurring Payments</CardTitle>
            </div>
            <CardDescription>Detected subscriptions and regular payments</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.recurring_payments?.length > 0 ? (
              <div className="space-y-3">
                {data.recurring_payments.map((payment, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-fg-default">{payment.merchant}</p>
                      <p className="text-xs text-fg-muted">
                        {payment.frequency} · {payment.total_count} payments detected
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium text-fg-default">
                        {formatCurrency(Math.abs(payment.average_amount))}
                      </p>
                      <p className="text-xs text-fg-muted">
                        {Math.round(payment.confidence * 100)}% confident
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInsight message="No recurring payments detected yet" />
            )}
          </CardContent>
        </Card>

        {/* Unusual Spending */}
        <Card className="border-border-color" data-testid="unusual-spending">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-accent-warning" />
              <CardTitle className="font-heading text-lg">Unusual Spending</CardTitle>
            </div>
            <CardDescription>Transactions that stand out from your usual patterns</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.unusual_spending?.length > 0 ? (
              <div className="space-y-3">
                {data.unusual_spending.map((item, index) => (
                  <div 
                    key={index}
                    className="p-3 bg-bg-subtle rounded-lg border-l-4 border-accent-warning"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-fg-default">{item.merchant}</p>
                        <p className="text-xs text-fg-muted">{item.reason}</p>
                      </div>
                      <p className="font-mono font-medium text-accent-ai">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInsight message="No unusual spending patterns detected" icon={AlertTriangle} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Savings Suggestions */}
      <Card className="border-border-color ai-panel" data-testid="savings-suggestions">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-accent-ai" />
            <CardTitle className="font-heading text-lg">Savings Suggestions</CardTitle>
          </div>
          <CardDescription>AI-powered tips to help you save money</CardDescription>
        </CardHeader>
        <CardContent>
          {data?.savings_suggestions?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.savings_suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className="p-4 bg-white rounded-lg border border-border-color"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      suggestion.priority === 'high' 
                        ? 'bg-accent-ai/10 text-accent-ai' 
                        : suggestion.priority === 'medium'
                        ? 'bg-accent-warning/10 text-accent-warning'
                        : 'bg-accent-positive/10 text-accent-positive'
                    }`}>
                      <Lightbulb className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-fg-default mb-1">
                        {suggestion.title}
                      </h4>
                      <p className="text-sm text-fg-muted mb-2">
                        {suggestion.description}
                      </p>
                      {suggestion.potential_savings && (
                        <Badge variant="secondary" className="bg-accent-positive/10 text-accent-positive">
                          Save up to {formatCurrency(suggestion.potential_savings)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInsight message="Upload more transactions to get personalized savings tips" icon={PiggyBank} />
          )}
        </CardContent>
      </Card>

      {/* AI Disclaimer */}
      <Card className="border-border-color bg-bg-subtle">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-accent-ai shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-fg-secondary">
                <strong>About AI Insights:</strong> These insights are generated using pattern recognition 
                and should be used as a guide, not financial advice. The accuracy improves as you add 
                more transaction data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyInsight({ message, icon: Icon = Sparkles }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-fg-muted mb-2" />
      <p className="text-fg-muted">{message}</p>
    </div>
  );
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-[200px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
      <Skeleton className="h-[250px]" />
    </div>
  );
}

export default InsightsPage;
