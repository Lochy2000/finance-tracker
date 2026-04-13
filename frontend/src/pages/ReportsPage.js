import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { reportsApi } from '../lib/api';
import { formatCurrency, formatDate, getCategoryColor } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { FileText, Calendar as CalendarIcon, Download, Loader2, Sparkles, BarChart3, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { toast } from 'sonner';

const CATEGORIES = ['Groceries','Transport','Dining','Shopping','Entertainment','Bills','Health','Subscriptions','Travel','Income','Other'];
const TOOLTIP_STYLE = { backgroundColor: '#fff', border: '1px solid #E5E5E2', borderRadius: '8px' };

export function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const fetchSavedReports = useCallback(async () => {
    try {
      const response = await reportsApi.list();
      setSavedReports(response.data.reports);
    } catch {
      // Failed to fetch reports
    }
  }, []);

  useEffect(() => {
    fetchSavedReports();
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start);
    setEndDate(end);
  }, [fetchSavedReports]);

  const handleGenerateReport = useCallback(async () => {
    if (!startDate || !endDate) { toast.error('Please select a date range'); return; }
    setGenerating(true);
    try {
      const response = await reportsApi.generate({
        start_date: startDate.toISOString(), end_date: endDate.toISOString(),
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        report_type: 'summary'
      });
      setCurrentReport(response.data);
      fetchSavedReports();
      toast.success('Report generated successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [startDate, endDate, selectedCategories, fetchSavedReports]);

  const handleViewReport = useCallback(async (reportId) => {
    setLoading(true);
    try {
      const response = await reportsApi.get(reportId);
      setCurrentReport(response.data);
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteReport = useCallback(async (reportId) => {
    try {
      await reportsApi.delete(reportId);
      setSavedReports((prev) => prev.filter((r) => r.report_id !== reportId));
      setCurrentReport((prev) => prev?.report_id === reportId ? null : prev);
      toast.success('Report deleted');
    } catch {
      toast.error('Failed to delete report');
    }
  }, []);

  const handleCategoryToggle = useCallback((category) => {
    setSelectedCategories((prev) => prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Reports</h1>
        <p className="text-fg-secondary mt-1">Generate custom financial reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReportConfigPanel
          startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          selectedCategories={selectedCategories} onCategoryToggle={handleCategoryToggle}
          onClearCategories={() => setSelectedCategories([])}
          generating={generating} onGenerate={handleGenerateReport}
          savedReports={savedReports} onViewReport={handleViewReport} onDeleteReport={handleDeleteReport}
        />

        <Card className="border-border-color lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">Report</CardTitle>
                {currentReport && <CardDescription>{formatDate(currentReport.start_date)} - {formatDate(currentReport.end_date)}</CardDescription>}
              </div>
              {currentReport && (
                <Button variant="outline" onClick={() => toast.info('Export feature coming soon')} data-testid="export-report">
                  <Download className="w-4 h-4 mr-2" />Export
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <ReportSkeleton /> : currentReport ? <ReportView report={currentReport} /> : <ReportEmptyState />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportConfigPanel({ startDate, setStartDate, endDate, setEndDate, selectedCategories, onCategoryToggle, onClearCategories, generating, onGenerate, savedReports, onViewReport, onDeleteReport }) {
  return (
    <Card className="border-border-color lg:col-span-1">
      <CardHeader>
        <CardTitle className="font-heading text-lg">Create Report</CardTitle>
        <CardDescription>Configure your report parameters</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerButton date={startDate} setDate={setStartDate} label="Start date" testId="start-date-picker" />
            <DatePickerButton date={endDate} setDate={setEndDate} label="End date" testId="end-date-picker" />
          </div>
        </div>
        <div className="space-y-3">
          <Label>Categories (optional)</Label>
          <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center space-x-2">
                <Checkbox id={`cat-${cat}`} checked={selectedCategories.includes(cat)} onCheckedChange={() => onCategoryToggle(cat)} />
                <label htmlFor={`cat-${cat}`} className="text-sm text-fg-secondary cursor-pointer">{cat}</label>
              </div>
            ))}
          </div>
          {selectedCategories.length > 0 && <Button variant="ghost" size="sm" onClick={onClearCategories} className="text-xs">Clear selection</Button>}
        </div>
        <Button className="w-full bg-accent-primary hover:bg-accent-primary/90" onClick={onGenerate} disabled={generating} data-testid="generate-report">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}Generate Report
        </Button>
        {savedReports.length > 0 && (
          <div className="pt-4 border-t border-border-color">
            <Label className="mb-3 block">Saved Reports</Label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {savedReports.map((r) => (
                <div key={r.report_id} className="flex items-center justify-between p-2 rounded-lg bg-bg-subtle hover:bg-bg-subtle/80 cursor-pointer" onClick={() => onViewReport(r.report_id)}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-fg-muted" />
                    <div>
                      <p className="text-xs text-fg-default">{formatDate(r.start_date)} - {formatDate(r.end_date)}</p>
                      <p className="text-xs text-fg-muted">{formatCurrency(r.total_spend)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onDeleteReport(r.report_id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DatePickerButton({ date, setDate, label, testId }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start text-left font-normal" data-testid={testId}>
          <CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, 'PP') : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
    </Popover>
  );
}

function ReportView({ report }) {
  const netColor = report.net_change >= 0 ? 'text-accent-positive' : 'text-accent-ai';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ReportStatBox label="Total Spend" value={formatCurrency(report.total_spend)} className="text-accent-ai" />
        <ReportStatBox label="Total Income" value={formatCurrency(report.total_income)} className="text-accent-positive" />
        <ReportStatBox label="Net Change" value={formatCurrency(report.net_change)} className={netColor} />
        <ReportStatBox label="Transactions" value={report.transaction_count} className="text-fg-default" />
      </div>

      {report.ai_summary && (
        <div className="p-4 ai-panel rounded-lg">
          <div className="flex items-start gap-2"><Sparkles className="w-5 h-5 text-accent-ai shrink-0" /><p className="text-fg-default">{report.ai_summary}</p></div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {report.category_breakdown?.length > 0 && <ReportPieChart data={report.category_breakdown} />}
        {report.daily_spending?.length > 0 && <ReportBarChart data={report.daily_spending} />}
      </div>

      {report.category_breakdown?.length > 0 && <CategoryBreakdownTable data={report.category_breakdown} />}
    </div>
  );
}

function ReportStatBox({ label, value, className }) {
  return (
    <div className="p-4 bg-bg-subtle rounded-lg">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className={`text-xl font-heading font-bold ${className}`}>{value}</p>
    </div>
  );
}

function ReportPieChart({ data }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-fg-secondary mb-4">Spending by Category</h4>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="total_amount" nameKey="category">
              {data.map((e) => <Cell key={e.category} fill={getCategoryColor(e.category)} />)}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ReportBarChart({ data }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-fg-secondary mb-4">Daily Spending</h4>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#68736E' }} tickFormatter={(v) => new Date(v).getDate()} />
            <YAxis tick={{ fontSize: 10, fill: '#68736E' }} tickFormatter={(v) => `£${v}`} />
            <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => formatDate(l)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="amount" fill="#1A2E25" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategoryBreakdownTable({ data }) {
  return (
    <div>
      <h4 className="text-sm font-medium text-fg-secondary mb-4">Category Breakdown</h4>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-color">
              <th className="text-left py-2 text-sm font-medium text-fg-muted">Category</th>
              <th className="text-right py-2 text-sm font-medium text-fg-muted">Amount</th>
              <th className="text-right py-2 text-sm font-medium text-fg-muted">Transactions</th>
              <th className="text-right py-2 text-sm font-medium text-fg-muted">% of Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((cat) => (
              <tr key={cat.category} className="border-b border-border-color/50">
                <td className="py-3"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(cat.category) }} /><span className="font-medium text-fg-default">{cat.category}</span></div></td>
                <td className="py-3 text-right font-mono text-fg-default">{formatCurrency(cat.total_amount)}</td>
                <td className="py-3 text-right text-fg-secondary">{cat.transaction_count}</td>
                <td className="py-3 text-right text-fg-secondary">{cat.percentage_of_total}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FileText className="w-12 h-12 text-fg-muted mb-4" />
      <h3 className="text-lg font-medium text-fg-default mb-2">No Report Generated</h3>
      <p className="text-fg-muted max-w-sm">Select a date range and click "Generate Report" to create a new financial report</p>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map((i) => <Skeleton key={`rs-${i}`} className="h-20" />)}</div>
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-6"><Skeleton className="h-[250px]" /><Skeleton className="h-[250px]" /></div>
    </div>
  );
}

export default ReportsPage;
