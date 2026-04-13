import React, { useState, useEffect } from 'react';
import { reportsApi, transactionsApi } from '../lib/api';
import { formatCurrency, formatDate, getCategoryColor } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { 
  FileText, 
  Calendar as CalendarIcon, 
  Download,
  Loader2,
  Sparkles,
  BarChart3,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { toast } from 'sonner';

const CATEGORIES = [
  'Groceries', 'Transport', 'Dining', 'Shopping', 'Entertainment',
  'Bills', 'Health', 'Subscriptions', 'Travel', 'Income', 'Other'
];

export function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedReports, setSavedReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  
  // Report configuration
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    fetchSavedReports();
    
    // Set default date range (last 30 days)
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start);
    setEndDate(end);
  }, []);

  const fetchSavedReports = async () => {
    try {
      const response = await reportsApi.list();
      setSavedReports(response.data.reports);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range');
      return;
    }

    setGenerating(true);
    try {
      const response = await reportsApi.generate({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
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
  };

  const handleViewReport = async (reportId) => {
    setLoading(true);
    try {
      const response = await reportsApi.get(reportId);
      setCurrentReport(response.data);
    } catch (error) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await reportsApi.delete(reportId);
      setSavedReports(savedReports.filter(r => r.report_id !== reportId));
      if (currentReport?.report_id === reportId) {
        setCurrentReport(null);
      }
      toast.success('Report deleted');
    } catch (error) {
      toast.error('Failed to delete report');
    }
  };

  const handleCategoryToggle = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info('Export feature coming soon');
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="reports-page">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">
          Reports
        </h1>
        <p className="text-fg-secondary mt-1">
          Generate custom financial reports
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Configuration */}
        <Card className="border-border-color lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Create Report</CardTitle>
            <CardDescription>Configure your report parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Range */}
            <div className="space-y-3">
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="justify-start text-left font-normal"
                      data-testid="start-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PP') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="justify-start text-left font-normal"
                      data-testid="end-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PP') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <Label>Categories (optional)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cat-${category}`}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleCategoryToggle(category)}
                    />
                    <label
                      htmlFor={`cat-${category}`}
                      className="text-sm text-fg-secondary cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
              {selectedCategories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategories([])}
                  className="text-xs"
                >
                  Clear selection
                </Button>
              )}
            </div>

            <Button
              className="w-full bg-accent-primary hover:bg-accent-primary/90"
              onClick={handleGenerateReport}
              disabled={generating}
              data-testid="generate-report"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              Generate Report
            </Button>

            {/* Saved Reports */}
            {savedReports.length > 0 && (
              <div className="pt-4 border-t border-border-color">
                <Label className="mb-3 block">Saved Reports</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {savedReports.map((report) => (
                    <div
                      key={report.report_id}
                      className="flex items-center justify-between p-2 rounded-lg bg-bg-subtle hover:bg-bg-subtle/80 cursor-pointer"
                      onClick={() => handleViewReport(report.report_id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-fg-muted" />
                        <div>
                          <p className="text-xs text-fg-default">
                            {formatDate(report.start_date)} - {formatDate(report.end_date)}
                          </p>
                          <p className="text-xs text-fg-muted">
                            {formatCurrency(report.total_spend)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReport(report.report_id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report View */}
        <Card className="border-border-color lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-lg">Report</CardTitle>
                {currentReport && (
                  <CardDescription>
                    {formatDate(currentReport.start_date)} - {formatDate(currentReport.end_date)}
                  </CardDescription>
                )}
              </div>
              {currentReport && (
                <Button variant="outline" onClick={handleExport} data-testid="export-report">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ReportSkeleton />
            ) : currentReport ? (
              <div className="space-y-6">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-bg-subtle rounded-lg">
                    <p className="text-sm text-fg-muted">Total Spend</p>
                    <p className="text-xl font-heading font-bold text-accent-ai">
                      {formatCurrency(currentReport.total_spend)}
                    </p>
                  </div>
                  <div className="p-4 bg-bg-subtle rounded-lg">
                    <p className="text-sm text-fg-muted">Total Income</p>
                    <p className="text-xl font-heading font-bold text-accent-positive">
                      {formatCurrency(currentReport.total_income)}
                    </p>
                  </div>
                  <div className="p-4 bg-bg-subtle rounded-lg">
                    <p className="text-sm text-fg-muted">Net Change</p>
                    <p className={`text-xl font-heading font-bold ${
                      currentReport.net_change >= 0 ? 'text-accent-positive' : 'text-accent-ai'
                    }`}>
                      {formatCurrency(currentReport.net_change)}
                    </p>
                  </div>
                  <div className="p-4 bg-bg-subtle rounded-lg">
                    <p className="text-sm text-fg-muted">Transactions</p>
                    <p className="text-xl font-heading font-bold text-fg-default">
                      {currentReport.transaction_count}
                    </p>
                  </div>
                </div>

                {/* AI Summary */}
                {currentReport.ai_summary && (
                  <div className="p-4 ai-panel rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-accent-ai shrink-0" />
                      <p className="text-fg-default">{currentReport.ai_summary}</p>
                    </div>
                  </div>
                )}

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category Breakdown */}
                  {currentReport.category_breakdown?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-fg-secondary mb-4">
                        Spending by Category
                      </h4>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={currentReport.category_breakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="total_amount"
                              nameKey="category"
                            >
                              {currentReport.category_breakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getCategoryColor(entry.category)} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => formatCurrency(value)}
                              contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E5E2',
                                borderRadius: '8px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Daily Spending */}
                  {currentReport.daily_spending?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-fg-secondary mb-4">
                        Daily Spending
                      </h4>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={currentReport.daily_spending}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E2" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 10, fill: '#68736E' }}
                              tickFormatter={(v) => new Date(v).getDate()}
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: '#68736E' }}
                              tickFormatter={(v) => `£${v}`}
                            />
                            <Tooltip
                              formatter={(value) => formatCurrency(value)}
                              labelFormatter={(label) => formatDate(label)}
                              contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E5E2',
                                borderRadius: '8px',
                              }}
                            />
                            <Bar dataKey="amount" fill="#1A2E25" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Table */}
                {currentReport.category_breakdown?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-fg-secondary mb-4">
                      Category Breakdown
                    </h4>
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
                          {currentReport.category_breakdown.map((cat) => (
                            <tr key={cat.category} className="border-b border-border-color/50">
                              <td className="py-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: getCategoryColor(cat.category) }}
                                  />
                                  <span className="font-medium text-fg-default">{cat.category}</span>
                                </div>
                              </td>
                              <td className="py-3 text-right font-mono text-fg-default">
                                {formatCurrency(cat.total_amount)}
                              </td>
                              <td className="py-3 text-right text-fg-secondary">
                                {cat.transaction_count}
                              </td>
                              <td className="py-3 text-right text-fg-secondary">
                                {cat.percentage_of_total}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-12 h-12 text-fg-muted mb-4" />
                <h3 className="text-lg font-medium text-fg-default mb-2">
                  No Report Generated
                </h3>
                <p className="text-fg-muted max-w-sm">
                  Select a date range and click "Generate Report" to create a new financial report
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-[250px]" />
        <Skeleton className="h-[250px]" />
      </div>
    </div>
  );
}

export default ReportsPage;
