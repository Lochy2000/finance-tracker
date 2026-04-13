import React, { useState, useEffect, useCallback } from 'react';
import { transactionsApi } from '../lib/api';
import { formatCurrency, formatDate, getCategoryColor } from '../lib/utils';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Search, Filter, Edit2, ChevronLeft, ChevronRight, SortAsc, SortDesc, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Groceries','Transport','Dining','Shopping','Entertainment','Bills','Health','Subscriptions','Travel','Income','Other'];

export function TransactionsPage() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editForm, setEditForm] = useState({ merchant_clean: '', category: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await transactionsApi.list({ page, page_size: pageSize, search: search || undefined, category: categoryFilter || undefined, sort_by: sortBy, sort_order: sortOrder });
      setTransactions(response.data.transactions);
      setTotal(response.data.total);
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, categoryFilter, sortBy, sortOrder]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Debounced search resets page
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openEditModal = useCallback((txn) => {
    setEditingTransaction(txn);
    setEditForm({ merchant_clean: txn.merchant_clean || txn.merchant_raw || '', category: txn.category || '', notes: txn.notes || '' });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingTransaction) return;
    setSaving(true);
    try {
      await transactionsApi.update(editingTransaction.transaction_id, editForm);
      toast.success('Transaction updated');
      setEditingTransaction(null);
      fetchTransactions();
    } catch {
      toast.error('Failed to update transaction');
    } finally {
      setSaving(false);
    }
  }, [editingTransaction, editForm, fetchTransactions]);

  const toggleSort = useCallback((field) => {
    if (sortBy === field) { setSortOrder((o) => o === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(field); setSortOrder('desc'); }
  }, [sortBy]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="transactions-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Transactions</h1>
        <p className="text-fg-secondary mt-1">View and manage all your transactions</p>
      </div>

      <FilterBar search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />

      <Card className="border-border-color">
        <CardContent className="p-0">
          {loading ? <TransactionsSkeleton /> : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-fg-muted">No transactions found</p>
              {(search || categoryFilter) && <p className="text-sm text-fg-muted mt-1">Try adjusting your filters</p>}
            </div>
          ) : (
            <TransactionTable transactions={transactions} sortBy={sortBy} sortOrder={sortOrder} toggleSort={toggleSort} onEdit={openEditModal} />
          )}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} setPage={setPage} />}
        </CardContent>
      </Card>

      <EditTransactionDialog editing={editingTransaction} form={editForm} setForm={setEditForm} saving={saving} onSave={handleSaveEdit} onClose={() => setEditingTransaction(null)} />
    </div>
  );
}

function FilterBar({ search, setSearch, categoryFilter, setCategoryFilter }) {
  return (
    <Card className="border-border-color">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <Input placeholder="Search merchants, notes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" data-testid="search-input" />
          </div>
          <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="category-filter"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="All Categories" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          {(search || categoryFilter) && <Button variant="ghost" onClick={() => { setSearch(''); setCategoryFilter(''); }}><X className="w-4 h-4 mr-1" />Clear</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionTable({ transactions, sortBy, sortOrder, toggleSort, onEdit }) {
  const SortIcon = sortOrder === 'asc' ? SortAsc : SortDesc;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-bg-subtle" onClick={() => toggleSort('date')}>
              <div className="flex items-center gap-1">Date{sortBy === 'date' && <SortIcon className="w-3 h-3" />}</div>
            </TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right cursor-pointer hover:bg-bg-subtle" onClick={() => toggleSort('amount')}>
              <div className="flex items-center justify-end gap-1">Amount{sortBy === 'amount' && <SortIcon className="w-3 h-3" />}</div>
            </TableHead>
            <TableHead className="text-center">Confidence</TableHead>
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.transaction_id} className="group">
              <TableCell className="text-fg-secondary">{formatDate(txn.date)}</TableCell>
              <TableCell>
                <p className="font-medium text-fg-default">{txn.merchant_clean || txn.merchant_raw}</p>
                {txn.merchant_clean && txn.merchant_raw !== txn.merchant_clean && <p className="text-xs text-fg-muted truncate max-w-[200px]">{txn.merchant_raw}</p>}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" style={{ backgroundColor: `${getCategoryColor(txn.category)}15`, color: getCategoryColor(txn.category) }}>
                  {txn.category || 'Uncategorized'}
                </Badge>
              </TableCell>
              <TableCell className={`text-right font-mono ${txn.amount < 0 ? 'text-accent-ai' : 'text-accent-positive'}`}>{formatCurrency(txn.amount)}</TableCell>
              <TableCell className="text-center"><ConfidenceLabel score={txn.confidence_score} /></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(txn)} data-testid={`edit-${txn.transaction_id}`}>
                  <Edit2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConfidenceLabel({ score }) {
  if (!score) return <span className="text-fg-muted">-</span>;
  let cls = 'bg-fg-muted/10 text-fg-muted';
  if (score > 0.8) cls = 'bg-accent-positive/10 text-accent-positive';
  else if (score > 0.6) cls = 'bg-accent-warning/10 text-accent-warning';
  return <span className={`text-sm px-2 py-0.5 rounded ${cls}`}>{Math.round(score * 100)}%</span>;
}

function Pagination({ page, totalPages, total, pageSize, setPage }) {
  return (
    <div className="flex items-center justify-between p-4 border-t border-border-color">
      <p className="text-sm text-fg-muted">Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} data-testid="prev-page"><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-sm text-fg-secondary px-2">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="next-page"><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}

function EditTransactionDialog({ editing, form, setForm, saving, onSave, onClose }) {
  return (
    <Dialog open={!!editing} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Transaction</DialogTitle><DialogDescription>Update the merchant name, category, or add notes</DialogDescription></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="merchant">Merchant Name</Label>
            <Input id="merchant" value={form.merchant_clean} onChange={(e) => setForm({ ...form, merchant_clean: e.target.value })} data-testid="edit-merchant" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={form.category || "none"} onValueChange={(v) => setForm({ ...form, category: v === "none" ? "" : v })}>
              <SelectTrigger data-testid="edit-category"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent><SelectItem value="none">No Category</SelectItem>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Add a note..." data-testid="edit-notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="save-edit">{saving ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransactionsSkeleton() {
  return <div className="p-4 space-y-3">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={`txn-skel-${i}`} className="h-16" />)}</div>;
}

export default TransactionsPage;
