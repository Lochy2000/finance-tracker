import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Upload,
  CreditCard,
  Sparkles,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload' },
  { to: '/transactions', icon: CreditCard, label: 'Transactions' },
  { to: '/insights', icon: Sparkles, label: 'AI Insights' },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-bg-default flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-border-color-color">
        <div className="p-6 border-b border-border-color-color">
          <h1 className="font-heading text-xl font-bold text-fg-default">
            LedgerLens
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            AI Finance Tracker
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-accent-primary text-white'
                    : 'text-fg-secondary hover:bg-bg-subtle hover:text-fg-default'
                }`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border-color-color">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center">
              <span className="text-accent-primary font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg-default truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-fg-muted truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-fg-secondary hover:text-fg-default"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-border-color-color">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-heading text-lg font-bold text-fg-default">
            LedgerLens
          </h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-border-color shadow-lg">
            <nav className="p-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-accent-primary text-white'
                        : 'text-fg-secondary hover:bg-bg-subtle'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg w-full text-fg-secondary hover:bg-bg-subtle"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign out</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-16 overflow-auto">
        <div className="max-w-screen-2xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default Layout;
