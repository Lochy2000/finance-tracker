import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { settingsApi, authApi, budgetsApi } from '../lib/api';
import { formatCurrency, getCategoryColor } from '../lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { User, Settings2, CreditCard, Shield, Loader2, Plus, Trash2, Target, Lock, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Groceries','Transport','Dining','Shopping','Entertainment','Bills','Health','Subscriptions','Travel','Other'];

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { settings: globalSettings, updateSettings: updateGlobalSettings, fetchSettings: refetchGlobalSettings } = useSettings();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState({ currency: 'GBP', date_format: 'DD/MM/YYYY', theme: 'light', notifications_enabled: true });
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [accounts, setAccounts] = useState([]);
  const [newAccountName, setNewAccountName] = useState('');
  const [budgets, setBudgets] = useState([]);
  const [newBudgetCat, setNewBudgetCat] = useState('');
  const [newBudgetLimit, setNewBudgetLimit] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, profileRes, accountsRes, budgetsRes] = await Promise.all([
        settingsApi.get(), settingsApi.getProfile(), settingsApi.listAccounts(), budgetsApi.list()
      ]);
      setLocalSettings(settingsRes.data);
      setProfile(profileRes.data);
      setAccounts(accountsRes.data.accounts || []);
      setBudgets(budgetsRes.data.budgets || []);
    } catch { /* Failed to load settings */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      await updateGlobalSettings(localSettings);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  }, [localSettings, updateGlobalSettings]);

  const handleThemeToggle = useCallback(() => {
    const newTheme = localSettings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...localSettings, theme: newTheme };
    setLocalSettings(updated);
    updateGlobalSettings(updated);
  }, [localSettings, updateGlobalSettings]);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try { await settingsApi.updateProfile({ name: profile.name }); toast.success('Profile updated'); }
    catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  }, [profile.name]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountName.trim()) return;
    try { const r = await settingsApi.createAccount({ name: newAccountName }); setAccounts((p) => [...p, r.data]); setNewAccountName(''); toast.success('Account added'); }
    catch { toast.error('Failed to add account'); }
  }, [newAccountName]);

  const handleDeleteAccount = useCallback(async (id) => {
    try { await settingsApi.deleteAccount(id); setAccounts((p) => p.filter((a) => a.account_id !== id)); toast.success('Account removed'); }
    catch { toast.error('Failed to remove account'); }
  }, []);

  const handleAddBudget = useCallback(async () => {
    if (!newBudgetCat || !newBudgetLimit) return;
    try { const r = await budgetsApi.create({ category: newBudgetCat, monthly_limit: parseFloat(newBudgetLimit) }); setBudgets((p) => [...p.filter((b) => b.category !== newBudgetCat), r.data]); setNewBudgetCat(''); setNewBudgetLimit(''); toast.success('Budget set'); }
    catch { toast.error('Failed to set budget'); }
  }, [newBudgetCat, newBudgetLimit]);

  const handleDeleteBudget = useCallback(async (id) => {
    try { await budgetsApi.delete(id); setBudgets((p) => p.filter((b) => b.budget_id !== id)); toast.success('Budget removed'); }
    catch { toast.error('Failed to remove budget'); }
  }, []);

  const handleDeleteUserAccount = useCallback(async () => {
    try {
      await settingsApi.deleteUserAccount();
      toast.success('Account deleted');
      await logout();
      navigate('/login');
    } catch { toast.error('Failed to delete account'); }
  }, [logout, navigate]);

  if (loading) return <div className="flex items-center justify-center h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Settings</h1>
          <p className="text-fg-secondary mt-1">Manage your account and preferences</p>
        </div>
        <Button variant="outline" size="icon" onClick={handleThemeToggle} data-testid="theme-toggle" title={`Switch to ${localSettings.theme === 'dark' ? 'light' : 'dark'} mode`}>
          {localSettings.theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileCard profile={profile} setProfile={setProfile} saving={saving} onSave={handleSaveProfile} />
        <PreferencesCard settings={localSettings} setSettings={setLocalSettings} saving={saving} onSave={handleSaveSettings} onThemeToggle={handleThemeToggle} />
        <BudgetsCard budgets={budgets} newCat={newBudgetCat} setNewCat={setNewBudgetCat} newLimit={newBudgetLimit} setNewLimit={setNewBudgetLimit} onAdd={handleAddBudget} onDelete={handleDeleteBudget} />
        <AccountsCard accounts={accounts} newAccountName={newAccountName} setNewAccountName={setNewAccountName} onAdd={handleAddAccount} onDelete={handleDeleteAccount} />
        <ChangePasswordCard />
        <SecurityCard onDeleteAccount={() => setDeleteDialogOpen(true)} />
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Account</DialogTitle><DialogDescription>This will permanently delete your account and all data. This cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteUserAccount} data-testid="confirm-delete-account">Delete Everything</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileCard({ profile, setProfile, saving, onSave }) {
  return (
    <Card className="border-border-color"><CardHeader><div className="flex items-center gap-2"><User className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Profile</CardTitle></div><CardDescription>Manage your personal information</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} data-testid="profile-name" /></div><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" value={profile.email} disabled className="bg-bg-subtle" /><p className="text-xs text-fg-muted">Email cannot be changed</p></div><Button onClick={onSave} disabled={saving} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="save-profile">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Profile</Button></CardContent></Card>
  );
}

function PreferencesCard({ settings, setSettings, saving, onSave, onThemeToggle }) {
  return (
    <Card className="border-border-color"><CardHeader><div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Preferences</CardTitle></div><CardDescription>Customize your experience</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Currency</Label><Select value={settings.currency} onValueChange={(v) => setSettings({ ...settings, currency: v })}><SelectTrigger data-testid="currency-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Date Format</Label><Select value={settings.date_format} onValueChange={(v) => setSettings({ ...settings, date_format: v })}><SelectTrigger data-testid="date-format-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem><SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem></SelectContent></Select></div>
        <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Dark Mode</Label><p className="text-xs text-fg-muted">Switch between light and dark theme</p></div><Switch checked={settings.theme === 'dark'} onCheckedChange={onThemeToggle} data-testid="dark-mode-toggle" /></div>
        <div className="flex items-center justify-between"><div className="space-y-0.5"><Label>Notifications</Label><p className="text-xs text-fg-muted">Receive alerts about unusual spending</p></div><Switch checked={settings.notifications_enabled} onCheckedChange={(v) => setSettings({ ...settings, notifications_enabled: v })} data-testid="notifications-toggle" /></div>
        <Button onClick={onSave} disabled={saving} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="save-settings">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Preferences</Button>
      </CardContent></Card>
  );
}

function BudgetsCard({ budgets, newCat, setNewCat, newLimit, setNewLimit, onAdd, onDelete }) {
  const available = CATEGORIES.filter((c) => !budgets.some((b) => b.category === c));
  return (
    <Card className="border-border-color" data-testid="budgets-card"><CardHeader><div className="flex items-center gap-2"><Target className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Monthly Budgets</CardTitle></div><CardDescription>Set spending limits per category</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {budgets.length > 0 ? <div className="space-y-2">{budgets.map((b) => <div key={b.budget_id} className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(b.category) }} /><span className="font-medium text-fg-default">{b.category}</span></div><div className="flex items-center gap-3"><span className="text-sm text-fg-secondary">{formatCurrency(b.monthly_limit)}/mo</span><Button variant="ghost" size="icon" onClick={() => onDelete(b.budget_id)} data-testid={`delete-budget-${b.budget_id}`}><Trash2 className="w-4 h-4 text-fg-muted" /></Button></div></div>)}</div> : <p className="text-sm text-fg-muted py-4 text-center">No budgets set. Add one below.</p>}
        <Separator />
        <div className="flex gap-2"><Select value={newCat || "pick"} onValueChange={(v) => setNewCat(v === "pick" ? "" : v)}><SelectTrigger className="flex-1" data-testid="budget-category-select"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="pick" disabled>Category</SelectItem>{available.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><Input type="number" placeholder="Limit (£)" value={newLimit} onChange={(e) => setNewLimit(e.target.value)} className="w-28" data-testid="budget-limit-input" /><Button variant="outline" onClick={onAdd} disabled={!newCat || !newLimit} data-testid="add-budget-btn"><Plus className="w-4 h-4 mr-1" />Set</Button></div>
      </CardContent></Card>
  );
}

function AccountsCard({ accounts, newAccountName, setNewAccountName, onAdd, onDelete }) {
  return (
    <Card className="border-border-color"><CardHeader><div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Accounts</CardTitle></div><CardDescription>Manage your linked bank accounts</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {accounts.length > 0 ? <div className="space-y-2">{accounts.map((a) => <div key={a.account_id} className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg"><div><p className="font-medium text-fg-default">{a.name}</p>{a.bank_name && <p className="text-xs text-fg-muted">{a.bank_name}</p>}</div><Button variant="ghost" size="icon" onClick={() => onDelete(a.account_id)}><Trash2 className="w-4 h-4 text-fg-muted" /></Button></div>)}</div> : <p className="text-sm text-fg-muted py-4 text-center">No accounts added yet</p>}
        <Separator /><div className="flex gap-2"><Input placeholder="Account name" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} data-testid="new-account-name" /><Button variant="outline" onClick={onAdd} disabled={!newAccountName.trim()} data-testid="add-account"><Plus className="w-4 h-4 mr-1" />Add</Button></div>
      </CardContent></Card>
  );
}

function ChangePasswordCard() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saving, setSaving] = useState(false);
  const handleChange = async () => {
    if (newPw.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setSaving(true);
    try { await authApi.changePassword(currentPw, newPw); toast.success('Password changed'); setCurrentPw(''); setNewPw(''); }
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to change password'); }
    finally { setSaving(false); }
  };
  return (
    <Card className="border-border-color" data-testid="change-password-card"><CardHeader><div className="flex items-center gap-2"><Lock className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Change Password</CardTitle></div><CardDescription>Update your account password</CardDescription></CardHeader>
      <CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="current-pw">Current Password</Label><Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} data-testid="current-password" /></div><div className="space-y-2"><Label htmlFor="new-pw">New Password</Label><Input id="new-pw" type="password" placeholder="Min 6 characters" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="new-password" /></div><Button onClick={handleChange} disabled={saving || !currentPw || newPw.length < 6} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="change-password-btn">{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Change Password</Button></CardContent></Card>
  );
}

function SecurityCard({ onDeleteAccount }) {
  return (
    <Card className="border-border-color"><CardHeader><div className="flex items-center gap-2"><Shield className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Security</CardTitle></div><CardDescription>Protect your account</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-bg-subtle rounded-lg"><h4 className="font-medium text-fg-default mb-2">Data Privacy</h4><p className="text-sm text-fg-muted">Your financial data is stored securely and never shared with third parties.</p></div>
        <div className="p-4 bg-bg-subtle rounded-lg border border-destructive/20"><h4 className="font-medium text-destructive mb-2">Delete Account</h4><p className="text-sm text-fg-muted mb-3">Permanently delete your account and all associated data. This cannot be undone.</p><Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={onDeleteAccount} data-testid="delete-account-btn">Delete Account</Button></div>
      </CardContent></Card>
  );
}

export default SettingsPage;
