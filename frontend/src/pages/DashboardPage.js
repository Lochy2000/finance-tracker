import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardApi } from '../lib/api';
import { formatCurrency, getMonthName, getCategoryColor } from '../lib/utils';
import { useSettings } from '../context/SettingsContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { TrendingDown, TrendingUp, CreditCard, Upload, Sparkles, ArrowUpRight, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const TOOLTIP_STYLE = { backgroundColor: '#fff', border: '1px solid #E5E5E2', borderRadius: '8px' };

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { settings } = useSettings();
  const currency = settings?.currency || 'GBP';
  const fmt = (amount) => formatCurrency(amount, currency);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dashboardApi.get(selectedMonth, selectedYear);
      setData(response.data);
    } catch {
      // Dashboard load failed
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const months = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: getMonthName(i + 1) })),
  []);

  const years = useMemo(() =>
    Array.from({ length: 3 }, (_, i) => ({ value: new Date().getFullYear() - i, label: String(new Date().getFullYear() - i) })),
  []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Dashboard</h1>
          <p className="text-fg-secondary mt-1">Your financial overview for {getMonthName(selectedMonth)} {selectedYear}</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[140px]" data-testid="month-select"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="year-select"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y.value} value={String(y.value)}>{y.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spending" value={fmt(data?.total_spend_month || 0)} icon={TrendingDown} iconColor="text-accent-ai" testId="stat-spending" />
        <StatCard title="Total Income" value={fmt(data?.total_income_month || 0)} icon={TrendingUp} iconColor="text-accent-positive" testId="stat-income" />
        <StatCard title="Transactions" value={data?.transaction_count || 0} icon={CreditCard} iconColor="text-accent-primary" testId="stat-transactions" />
        <StatCard title="Files Uploaded" value={data?.recent_uploads?.length || 0} icon={Upload} iconColor="text-accent-warning" testId="stat-uploads" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryPieChart categories={data?.spending_by_category} />
        <SpendingLineChart data={data?.spending_over_time} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopMerchantsList merchants={data?.top_merchants} />
        <AISummaryPanel summary={data?.ai_summary} />
      </div>

      {data?.budget_progress?.length > 0 && <BudgetProgressPanel budgets={data.budget_progress} />}

      {data?.recent_uploads?.length > 0 && <RecentUploadsList uploads={data.recent_uploads} />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, iconColor, testId }) {
  return (
    <Card className="border-border-color card-hover" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-fg-secondary mb-1">{title}</p>
            <p className="text-2xl font-heading font-bold text-fg-default">{value}</p>
          </div>
          <div className={`p-2 rounded-lg bg-bg-subtle ${iconColor}`}><Icon className="w-5 h-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryPieChart({ categories }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Spending by Category</CardTitle>
        <CardDescription>Where your money goes</CardDescription>
      </CardHeader>
      <CardContent>
        {categories?.length > 0 ? (
          <>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="amount" nameKey="category">
                    {categories.map((entry) => <Cell key={entry.category} fill={getCategoryColor(entry.category)} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {categories.slice(0, 6).map((cat) => (
                <div key={cat.category} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(cat.category) }} />
                  <span className="text-fg-secondary truncate">{cat.category}</span>
                  <span className="text-fg-muted ml-auto">{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState message="No spending data for this period" />
        )}
      </CardContent>
    </Card>
  );
}

function SpendingLineChart({ data }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Spending Over Time</CardTitle>
        <CardDescription>Daily spending trend</CardDescription>
      </CardHeader>
      <CardContent>
        {data?.length > 0 ? (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#68736E' }} tickFormatter={(v) => new Date(v).getDate()} />
                <YAxis tick={{ fontSize: 12, fill: '#68736E' }} tickFormatter={(v) => `£${v}`} />
                <Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(l) => new Date(l).toLocaleDateString('en-GB')} contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="amount" stroke="#1A2E25" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="No spending data for this period" />
        )}
      </CardContent>
    </Card>
  );
}

function TopMerchantsList({ merchants }) {
  return (
    <Card className="border-border-color lg:col-span-1">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Top Merchants</CardTitle>
        <CardDescription>Where you spend the most</CardDescription>
      </CardHeader>
      <CardContent>
        {merchants?.length > 0 ? (
          <div className="space-y-3">
            {merchants.slice(0, 5).map((m, idx) => (
              <div key={m.merchant} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-bg-subtle flex items-center justify-center text-xs font-medium text-fg-secondary">{idx + 1}</span>
                  <span className="text-sm font-medium text-fg-default truncate max-w-[150px]">{m.merchant}</span>
                </div>
                <span className="text-sm text-fg-secondary">{formatCurrency(m.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No merchant data" />
        )}
      </CardContent>
    </Card>
  );
}

function AISummaryPanel({ summary }) {
  return (
    <Card className="border-border-color lg:col-span-2 ai-panel" data-testid="ai-summary-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent-ai" />
          <CardTitle className="font-heading text-lg">AI Summary</CardTitle>
        </div>
        <CardDescription>Intelligent insights about your finances</CardDescription>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-4">
            <p className="text-fg-default leading-relaxed">{summary.summary_text}</p>
            {summary.highlights?.length > 0 && (
              <div className="space-y-2">
                {summary.highlights.map((h) => (
                  <div key={h} className="flex items-start gap-2">
                    <ArrowUpRight className="w-4 h-4 text-accent-ai mt-0.5 shrink-0" />
                    <span className="text-sm text-fg-secondary">{h}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <EmptyState message="Upload transactions to get AI insights" />
        )}
      </CardContent>
    </Card>
  );
}

function BudgetProgressPanel({ budgets }) {
  return (
    <Card className="border-border-color" data-testid="budget-progress-panel">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-accent-primary" />
          <CardTitle className="font-heading text-lg">Budget Progress</CardTitle>
        </div>
        <CardDescription>Monthly spending limits by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {budgets.map((b) => {
            const pct = Math.min(b.percentage, 100);
            let barColor = 'bg-accent-positive';
            if (b.percentage > 90) barColor = 'bg-destructive';
            else if (b.percentage > 70) barColor = 'bg-accent-warning';
            return (
              <div key={b.budget_id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(b.category) }} />
                    <span className="text-sm font-medium text-fg-default">{b.category}</span>
                  </div>
                  <span className="text-sm text-fg-secondary">
                    {formatCurrency(b.spent)} / {formatCurrency(b.monthly_limit)}
                    {b.over_budget && <span className="ml-2 text-destructive font-medium">Over budget</span>}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-bg-subtle overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentUploadsList({ uploads }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Recent Uploads</CardTitle>
        <CardDescription>Your recently uploaded files</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {uploads.map((file) => (
            <div key={file.file_id} className="flex items-center justify-between p-3 rounded-lg bg-bg-subtle">
              <div className="flex items-center gap-3">
                <Upload className="w-4 h-4 text-fg-muted" />
                <span className="text-sm font-medium text-fg-default">{file.filename}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-fg-muted">
                <span>{file.transaction_count || 0} transactions</span>
                <FileStatusBadge status={file.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FileStatusBadge({ status }) {
  let classes = 'bg-fg-muted/10 text-fg-muted';
  if (status === 'imported') classes = 'bg-accent-positive/10 text-accent-positive';
  else if (status === 'parsed') classes = 'bg-accent-warning/10 text-accent-warning';
  return <span className={`px-2 py-0.5 rounded text-xs ${classes}`}>{status}</span>;
}

function EmptyState({ message }) {
  return <div className="flex items-center justify-center h-[200px] text-fg-muted"><p>{message}</p></div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><Skeleton className="h-8 w-48" /><div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-24" /></div></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map((i) => <Skeleton key={`stat-skel-${i}`} className="h-24" />)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Skeleton className="h-[400px]" /><Skeleton className="h-[400px]" /></div>
    </div>
  );
}

export default DashboardPage;
