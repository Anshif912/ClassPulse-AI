import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Bot,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Sparkles,
  Command,
  User,
  Bell,
  Layers,
  FileText,
  Shield,
  Video,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from './Logo';
import { CommandPalette } from './CommandPalette';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  activeNav?: 'dashboard' | 'classes' | 'materials' | 'ai' | 'settings';
  onNewClass?: () => void;
  onJoinClass?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  title,
  activeNav = 'dashboard',
  onNewClass,
  onJoinClass,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isTeacher = user?.role === 'TEACHER';

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      path: '/dashboard',
      badge: null,
    },
    {
      id: 'classes',
      label: 'Classrooms',
      icon: <GraduationCap className="w-4 h-4" />,
      path: '/dashboard',
      badge: null,
    },
    {
      id: 'settings',
      label: 'Settings & Devices',
      icon: <Settings className="w-4 h-4" />,
      path: '/settings',
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col antialiased selection:bg-blue-600/30 selection:text-blue-200">
      {/* ── Top Header ────────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6">
        {/* Left: Logo & Sidebar Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div
            onClick={() => navigate('/dashboard')}
            className="cursor-pointer flex items-center transition-opacity hover:opacity-90"
          >
            <Logo size="sm" showText={true} />
          </div>
        </div>

        {/* Center: Global Search / Command Bar */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={() => setIsCommandOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 text-xs text-slate-400 hover:text-slate-200 transition-all shadow-inner"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search classrooms, materials, commands...</span>
            </div>
            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/90 border border-slate-700/80 rounded">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </button>
        </div>

        {/* Right: Quick Action, Profile & Menu */}
        <div className="flex items-center gap-2.5">
          {/* Quick Create / Join */}
          {isTeacher ? (
            <button
              onClick={onNewClass || (() => navigate('/dashboard'))}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Class</span>
            </button>
          ) : (
            <button
              onClick={onJoinClass || (() => navigate('/dashboard'))}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Join Class</span>
            </button>
          )}

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2.5 pr-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-200 leading-tight truncate max-w-[120px]">
                  {user?.name || 'User'}
                </p>
                <p className="text-[10px] text-blue-400 font-semibold leading-tight capitalize">
                  {isTeacher ? 'Teacher' : 'Student'}
                </p>
              </div>

              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-lg ring-2 ring-blue-500/30 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
            </button>

            {/* Profile Dropdown */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {user?.role}
                  </span>
                </div>

                <button
                  onClick={() => { navigate('/dashboard'); setIsProfileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
                  Dashboard
                </button>

                <button
                  onClick={() => { navigate('/settings'); setIsProfileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-violet-400" />
                  Settings & Audio/Video
                </button>

                <div className="border-t border-slate-800 my-1" />

                <button
                  onClick={() => { logout(); setIsProfileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Container: Sidebar + Content ────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`shrink-0 border-r border-slate-800/80 bg-slate-950/50 backdrop-blur-sm transition-all duration-200 flex flex-col justify-between p-3 ${
            sidebarCollapsed ? 'w-16' : 'w-56'
          }`}
        >
          {/* Top navigation */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                (item.id === 'dashboard' && location.pathname === '/dashboard') ||
                (item.id === 'settings' && location.pathname === '/settings');

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/15 border border-blue-500/30 text-blue-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className={isActive ? 'text-blue-400' : 'text-slate-400'}>{item.icon}</span>
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Bottom badge / AI Helper status */}
          <div className="space-y-2">
            {!sidebarCollapsed && (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-800/30">
                <div className="flex items-center gap-2 text-indigo-300 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-bold">AI Tutor Ready</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Grounds answers in teacher-uploaded textbook notes.
                </p>
              </div>
            )}

            <button
              onClick={logout}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors ${
                sidebarCollapsed ? 'justify-center px-0' : ''
              }`}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#080C14]">
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onOpenCreateModal={onNewClass}
        onOpenJoinModal={onJoinClass}
      />
    </div>
  );
};
