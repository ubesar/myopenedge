import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import {
  LayoutDashboard, LineChart, Upload, Settings, BookOpen, TrendingUp, Menu, X, ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/logo.png';

const navItems = [
  { href: '/journal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/journal/analytics', label: 'Analytics', icon: TrendingUp },
  { href: '/journal/trades', label: 'Trades', icon: LineChart },
  { href: '/journal/playbooks', label: 'Playbooks', icon: BookOpen },
  { href: '/journal/import', label: 'Import', icon: Upload },
  { href: '/journal/settings', label: 'Settings', icon: Settings },
];

export function JournalLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accounts, selectedAccountId, setSelectedAccountId } = useAccounts();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const AccountSelector = () => (
    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
      <SelectTrigger className="w-full h-8 text-xs bg-[hsl(var(--sidebar-accent))] border-[hsl(var(--sidebar-border))]">
        <SelectValue placeholder="All Accounts" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Accounts</SelectItem>
        {accounts.map(acc => (
          <SelectItem key={acc.id} value={acc.id}>
            {acc.name}
            {acc.is_default && ' ★'}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-border bg-[hsl(var(--sidebar-background))] lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-6">
            <img src={logo} alt="MyOpenEdge" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-lg font-bold text-[hsl(var(--sidebar-foreground))]">Journal</span>
          </div>

          {/* Account Selector */}
          {accounts.length > 0 && (
            <div className="px-3 pt-3">
              <AccountSelector />
            </div>
          )}

          <nav className="flex-1 space-y-1 px-3 py-4">
            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))] transition-all duration-200 w-full mb-2"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Analysis
            </button>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]'
                      : 'text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[hsl(var(--sidebar-accent))] flex items-center justify-center">
                <span className="text-sm font-medium text-[hsl(var(--sidebar-foreground))]">
                  {user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--sidebar-foreground))] truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-3 lg:hidden">
        <div className="flex items-center gap-2">
          <img src={logo} alt="MyOpenEdge" className="h-7 w-7 rounded-full object-cover" />
          <span className="text-sm font-bold">Journal</span>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-background lg:hidden pt-14 overflow-y-auto">
          <nav className="flex flex-col p-3 space-y-1">
            <button
              onClick={() => { navigate('/app'); setMobileMenuOpen(false); }}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all w-full"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Analysis
            </button>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all',
                    isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
