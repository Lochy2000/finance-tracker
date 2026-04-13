import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsApi } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { User, Settings2, CreditCard, Shield, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ currency: 'GBP', date_format: 'DD/MM/YYYY', theme: 'light', notifications_enabled: true });
  const [profile, setProfile] = useState({ name: '', email: '' });
  const [accounts, setAccounts] = useState([]);
  const [newAccountName, setNewAccountName] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, profileRes, accountsRes] = await Promise.all([settingsApi.get(), settingsApi.getProfile(), settingsApi.listAccounts()]);
      setSettings(settingsRes.data);
      setProfile(profileRes.data);
      setAccounts(accountsRes.data.accounts || []);
    } catch {
      // Failed to load settings
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try { await settingsApi.update(settings); toast.success('Settings saved'); }
    catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  }, [settings]);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    try { await settingsApi.updateProfile({ name: profile.name }); toast.success('Profile updated'); }
    catch { toast.error('Failed to update profile'); }
    finally { setSaving(false); }
  }, [profile.name]);

  const handleAddAccount = useCallback(async () => {
    if (!newAccountName.trim()) return;
    try {
      const response = await settingsApi.createAccount({ name: newAccountName });
      setAccounts((prev) => [...prev, response.data]);
      setNewAccountName('');
      toast.success('Account added');
    } catch { toast.error('Failed to add account'); }
  }, [newAccountName]);

  const handleDeleteAccount = useCallback(async (accountId) => {
    try {
      await settingsApi.deleteAccount(accountId);
      setAccounts((prev) => prev.filter((a) => a.account_id !== accountId));
      toast.success('Account removed');
    } catch { toast.error('Failed to remove account'); }
  }, []);

  if (loading) return <div className="flex items-center justify-center h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-accent-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="settings-page">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-fg-default">Settings</h1>
        <p className="text-fg-secondary mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfileCard profile={profile} setProfile={setProfile} saving={saving} onSave={handleSaveProfile} />
        <PreferencesCard settings={settings} setSettings={setSettings} saving={saving} onSave={handleSaveSettings} />
        <AccountsCard accounts={accounts} newAccountName={newAccountName} setNewAccountName={setNewAccountName} onAdd={handleAddAccount} onDelete={handleDeleteAccount} />
        <SecurityCard />
      </div>
    </div>
  );
}

function ProfileCard({ profile, setProfile, saving, onSave }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <div className="flex items-center gap-2"><User className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Profile</CardTitle></div>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} data-testid="profile-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} disabled className="bg-bg-subtle" />
          <p className="text-xs text-fg-muted">Email cannot be changed</p>
        </div>
        <Button onClick={onSave} disabled={saving} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="save-profile">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Profile
        </Button>
      </CardContent>
    </Card>
  );
}

function PreferencesCard({ settings, setSettings, saving, onSave }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <div className="flex items-center gap-2"><Settings2 className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Preferences</CardTitle></div>
        <CardDescription>Customize your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={settings.currency} onValueChange={(v) => setSettings({ ...settings, currency: v })}>
            <SelectTrigger data-testid="currency-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">GBP (£)</SelectItem><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select value={settings.date_format} onValueChange={(v) => setSettings({ ...settings, date_format: v })}>
            <SelectTrigger data-testid="date-format-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem><SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem><SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5"><Label>Notifications</Label><p className="text-xs text-fg-muted">Receive alerts about unusual spending</p></div>
          <Switch checked={settings.notifications_enabled} onCheckedChange={(v) => setSettings({ ...settings, notifications_enabled: v })} data-testid="notifications-toggle" />
        </div>
        <Button onClick={onSave} disabled={saving} className="bg-accent-primary hover:bg-accent-primary/90" data-testid="save-settings">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

function AccountsCard({ accounts, newAccountName, setNewAccountName, onAdd, onDelete }) {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Accounts</CardTitle></div>
        <CardDescription>Manage your linked bank accounts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {accounts.length > 0 ? (
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div key={acc.account_id} className="flex items-center justify-between p-3 bg-bg-subtle rounded-lg">
                <div>
                  <p className="font-medium text-fg-default">{acc.name}</p>
                  {acc.bank_name && <p className="text-xs text-fg-muted">{acc.bank_name}</p>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDelete(acc.account_id)}><Trash2 className="w-4 h-4 text-fg-muted" /></Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-muted py-4 text-center">No accounts added yet</p>
        )}
        <Separator />
        <div className="flex gap-2">
          <Input placeholder="Account name" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} data-testid="new-account-name" />
          <Button variant="outline" onClick={onAdd} disabled={!newAccountName.trim()} data-testid="add-account"><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityCard() {
  return (
    <Card className="border-border-color">
      <CardHeader>
        <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-accent-primary" /><CardTitle className="font-heading text-lg">Security</CardTitle></div>
        <CardDescription>Protect your account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-bg-subtle rounded-lg">
          <h4 className="font-medium text-fg-default mb-2">Data Privacy</h4>
          <p className="text-sm text-fg-muted">Your financial data is stored securely and never shared with third parties. All connections use encryption.</p>
        </div>
        <div className="p-4 bg-bg-subtle rounded-lg">
          <h4 className="font-medium text-fg-default mb-2">Change Password</h4>
          <p className="text-sm text-fg-muted mb-3">Update your password regularly to keep your account secure.</p>
          <Button variant="outline" disabled>Change Password (Coming Soon)</Button>
        </div>
        <div className="p-4 bg-bg-subtle rounded-lg border border-destructive/20">
          <h4 className="font-medium text-destructive mb-2">Delete Account</h4>
          <p className="text-sm text-fg-muted mb-3">Permanently delete your account and all associated data.</p>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" disabled>Delete Account (Coming Soon)</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SettingsPage;
