import { useState, useEffect } from 'react';
import { usePlanningState } from './hooks/usePlanningState';
import DashboardView from './views/DashboardView';
import MasterSheetView from './views/MasterSheetView';
import PlanningSheetView from './views/PlanningSheetView';
import AttendanceView from './views/AttendanceView';
import AvailabilityView from './views/AvailabilityView';
import LeaveManagementView from './views/LeaveManagementView';
import { validateMasterPlanningData } from './utils/validationHelper';

import AuditLogView from './views/AuditLogView';
import RecycleBinView from './views/RecycleBinView';
import NewJoineeReviewView from './views/NewJoineeReviewView';

// Icon imports
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  ClipboardCheck,
  SearchCheck,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  Bell,
  Trash2,
  Database,
  Calendar,
  History,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Sparkles
} from 'lucide-react';

export default function App() {
  const state = usePlanningState();
  const validationSummary = validateMasterPlanningData(
    state.profiles,
    state.projects,
    state.assignments,
    state.leaves,
    state.attendance
  );
  const hasValidationErrors = validationSummary.errorsCount > 0;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'master-sheet' | 'planning' | 'leave-management' | 'attendance' | 'availability-finder' | 'audit-log' | 'recycle-bin' | 'settings' | 'new-joinee-review'>(() => {
    return (localStorage.getItem('v2_active_tab') as any) || 'dashboard';
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Master Sheet lifted filters and subtab states
  const [masterSubTab, setMasterSubTab] = useState<'assignments' | 'employees' | 'projects'>('assignments');
  const [masterSearch, setMasterSearch] = useState('');
  const [masterDeptFilter, setMasterDeptFilter] = useState('');
  const [masterProjectFilter, setMasterProjectFilter] = useState('');
  const [masterStatusFilter, setMasterStatusFilter] = useState('');
  const [masterActiveTodayOnly, setMasterActiveTodayOnly] = useState<boolean>(false);
  const [isOthersExpanded, setIsOthersExpanded] = useState(() => {
    const tab = localStorage.getItem('v2_active_tab') || 'dashboard';
    return ['audit-log', 'recycle-bin', 'settings'].includes(tab);
  });

  const primaryNavigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'master-sheet', label: 'Master Sheet', icon: <Users className="w-5 h-5" /> },
    { id: 'planning', label: 'Planning Grid', icon: <CalendarRange className="w-5 h-5" /> },
    { id: 'leave-management', label: 'Leave Management', icon: <Calendar className="w-5 h-5" /> },
    { id: 'availability-finder', label: 'Available Staff', icon: <SearchCheck className="w-5 h-5" /> },
    { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: 'new-joinee-review', label: 'New Joinee Review', icon: <Sparkles className="w-5 h-5" /> },
  ];

  const othersSubItems = [
    { id: 'audit-log', label: 'History', icon: <History className="w-4 h-4" /> },
    { id: 'recycle-bin', label: 'Recycle Bin', icon: <Trash2 className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavigate = (
    tab: 'dashboard' | 'master-sheet' | 'planning' | 'leave-management' | 'attendance' | 'availability-finder' | 'settings' | 'new-joinee-review',
    subTab?: 'assignments' | 'employees' | 'projects' | 'recycle-bin',
    filters?: {
      search?: string;
      deptFilter?: string;
      projectFilter?: string;
      statusFilter?: string;
      activeTodayOnly?: boolean;
    }
  ) => {
    setActiveTab(tab);
    if (subTab === 'recycle-bin') {
      setActiveTab('recycle-bin');
    } else if (subTab) {
      setMasterSubTab(subTab);
    }
    // Always clear other filters first, and then apply specified ones from the dashboard click context
    setMasterSearch(filters?.search !== undefined ? filters.search : '');
    setMasterDeptFilter(filters?.deptFilter !== undefined ? filters.deptFilter : '');
    setMasterProjectFilter(filters?.projectFilter !== undefined ? filters.projectFilter : '');
    setMasterStatusFilter(filters?.statusFilter !== undefined ? filters.statusFilter : '');
    setMasterActiveTodayOnly(filters?.activeTodayOnly !== undefined ? filters.activeTodayOnly : false);
  };

  const handleSidebarTabClick = (tabId: any) => {
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
    if (tabId === 'master-sheet') {
      setMasterSubTab('assignments');
      setMasterSearch('');
      setMasterDeptFilter('');
      setMasterProjectFilter('');
      setMasterStatusFilter('');
      setMasterActiveTodayOnly(false);
    }
  };

  // Persist active tab across page refreshes
  useEffect(() => {
    localStorage.setItem('v2_active_tab', activeTab);
  }, [activeTab]);

  // Apply dark mode theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Navigation lists are declared as primaryNavigationItems and othersSubItems

  // Reset database helper for testing
  const handleResetData = async () => {
    if (confirm("Are you sure you want to delete all data in Firestore? This will permanently delete all custom employees, projects, assignments, leaves, and attendance.")) {
      try {
        await state.resetDatabase();
        alert("Firestore database successfully cleared!");
      } catch (err) {
        console.error("Failed to clear Firestore database:", err);
        alert("Error: Failed to clear Firestore database.");
      }
    }
  };

  const handleSeedData = async () => {
    if (confirm("Are you sure you want to seed the database? This will clear all existing data and populate your Firestore collections with standard premium sample data.")) {
      try {
        await state.seedDatabase();
        alert("Firestore database successfully seeded with sample data!");
      } catch (err) {
        console.error("Failed to seed Firestore database:", err);
        alert("Error: Failed to seed Firestore database.");
      }
    }
  };

  const renderActiveView = () => {
    
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView 
            profiles={state.profiles}
            assignments={state.assignments}
            projects={state.projects}
            leaves={state.leaves}
            reviews={state.reviews}
            onNavigate={handleNavigate}
          />
        );
      case 'master-sheet':
        return (
          <MasterSheetView
            attendance={state.attendance}
            leaves={state.leaves}
            profiles={state.profiles}
            projects={state.projects}
            assignments={state.assignments}
            addProfile={state.addProfile}
            editProfile={state.editProfile}
            deleteProfile={state.deleteProfile}
            addProject={state.addProject}
            editProject={state.editProject}
            deleteProject={state.deleteProject}
            addAssignment={state.addAssignment}
            editAssignment={state.editAssignment}
            deleteAssignment={state.deleteAssignment}
            activeSubTab={masterSubTab}
            setActiveSubTab={setMasterSubTab}
            search={masterSearch}
            setSearch={setMasterSearch}
            deptFilter={masterDeptFilter}
            setDeptFilter={setMasterDeptFilter}
            projectFilter={masterProjectFilter}
            setProjectFilter={setMasterProjectFilter}
            statusFilter={masterStatusFilter}
            setStatusFilter={setMasterStatusFilter}
            activeTodayOnly={masterActiveTodayOnly}
            setActiveTodayOnly={setMasterActiveTodayOnly}
            validationSummary={validationSummary}
            hasValidationErrors={hasValidationErrors}
            autoAlignMismatches={state.autoAlignMismatches}
          />
        );
      case 'planning':
        return (
          <PlanningSheetView 
            profiles={state.profiles}
            assignments={state.assignments}
            projects={state.projects}
            leaves={state.leaves}
            hasValidationErrors={hasValidationErrors}
          />
        );
      case 'leave-management':
        return (
          <LeaveManagementView
            profiles={state.profiles}
            leaves={state.leaves}
            projects={state.projects}
            assignments={state.assignments}
            addLeave={state.addLeave}
            editLeave={state.editLeave}
            deleteLeave={state.deleteLeave}
          />
        );
      case 'attendance':
        return (
          <AttendanceView
            profiles={state.profiles}
            assignments={state.assignments}
            projects={state.projects}
            leaves={state.leaves}
            hasValidationErrors={hasValidationErrors}
          />
        );
      case 'availability-finder':
        return (
          <AvailabilityView
            profiles={state.profiles}
            assignments={state.assignments}
            projects={state.projects}
            attendance={state.attendance}
            leaves={state.leaves}
          />
        );
      case 'audit-log':
        return (
          <AuditLogView
            auditLogs={state.auditLogs}
            revertChange={state.revertChange}
            profiles={state.profiles}
          />
        );
      case 'recycle-bin':
        return (
          <RecycleBinView
            recycleBin={state.recycleBin}
            restoreRecycleItem={state.restoreRecycleItem}
            deleteRecycleItemPermanently={state.deleteRecycleItemPermanently}
          />
        );

      case 'new-joinee-review':
        return (
          <NewJoineeReviewView
            reviews={state.reviews}
            scheduleReview={state.scheduleReview}
            triggerPowerAutomate={state.triggerPowerAutomate}
            submitMOM={state.submitMOM}
          />
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
              <p className="text-slate-500 dark:text-slate-400">Manage application configuration, themes, and data storage.</p>
            </div>
            
            <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6 max-w-xl">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Theme Preferences</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Toggle dark and light color modes</p>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setDarkMode(false)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all ${
                      !darkMode 
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    Light Theme
                  </button>
                  <button
                    onClick={() => setDarkMode(true)}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-sm font-semibold transition-all ${
                      darkMode 
                        ? 'border-brand-500 bg-brand-950/20 text-brand-400 font-bold shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-violet-400" />
                    Dark Theme
                  </button>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800" />

              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Leave Rules Rotation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Current leave engine configuration</p>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                    <div className="text-xs font-semibold text-slate-400">Active Work Period</div>
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-1">60 Days</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                    <div className="text-xs font-semibold text-slate-400">Rotation Leave Length</div>
                    <div className="text-lg font-bold text-slate-700 dark:text-slate-200 mt-1">30 Days</div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800" />

              <div>
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Danger Zone</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Destructive actions for testing purposes</p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={handleSeedData}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/20 dark:hover:bg-brand-900/20 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900/30 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    Seed Sample Data
                  </button>
                  <button
                    onClick={handleResetData}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40 rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Reset Database Mockup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <DashboardView 
            profiles={state.profiles}
            assignments={state.assignments}
            projects={state.projects}
            leaves={state.leaves}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans">
      
      <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 sticky top-0 h-screen z-40 transition-all duration-300`}>
        <div className={`h-16 flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-6'} border-b border-slate-200 dark:border-slate-800 shrink-0`}>
          {!isSidebarCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-500/20 shrink-0">
                  S
                </div>
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent truncate">
                  Staff Planner
                </span>
              </div>
              <button 
                onClick={() => setIsSidebarCollapsed(true)} 
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0 ml-1 animate-in fade-in"
                title="Collapse Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsSidebarCollapsed(false)} 
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer animate-in fade-in"
              title="Expand Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {/* Primary Navigation */}
          {primaryNavigationItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleSidebarTabClick(item.id as any)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 text-sm font-semibold rounded-xl transition-all duration-150 ${
                activeTab === item.id 
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="shrink-0">{item.icon}</div>
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}

          {/* Others Parent collapsible link */}
          <div className="pt-2">
            <button
              onClick={() => setIsOthersExpanded(!isOthersExpanded)}
              title={isSidebarCollapsed ? "Others" : undefined}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'} py-3 text-sm font-semibold rounded-xl transition-all ${
                ['audit-log', 'recycle-bin', 'settings'].includes(activeTab) && !isSidebarCollapsed
                  ? 'text-brand-600 dark:text-brand-400 bg-slate-100/40 dark:bg-slate-800/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800/40 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <MoreHorizontal className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && <span>Others</span>}
              </div>
              {!isSidebarCollapsed && (
                isOthersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Sub-items list */}
            {isOthersExpanded && !isSidebarCollapsed && (
              <div className="pl-6 mt-1 space-y-1">
                {othersSubItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSidebarTabClick(item.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 border-l-2 border-brand-500'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/20 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="shrink-0">{item.icon}</div>
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Collapsed sidebar mode sub-items display (as individual items below header) */}
            {isSidebarCollapsed && othersSubItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleSidebarTabClick(item.id as any)}
                title={item.label}
                className={`w-full flex items-center justify-center px-2 py-3 text-sm font-semibold rounded-xl transition-all duration-150 ${
                  activeTab === item.id 
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <div className="shrink-0">{item.icon}</div>
              </button>
            ))}
          </div>
        </nav>

        <div className={`p-4 border-t border-slate-200 dark:border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-4'} shrink-0`}>
          <div className={`${isSidebarCollapsed ? 'w-10 h-10 text-sm' : 'w-12 h-12 text-base'} rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white shadow-inner shrink-0`}>
            S
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Saranya</h5>
              <p className="text-xs text-slate-400 font-semibold truncate">HR</p>
            </div>
          )}
        </div>
      </aside>

      {/* 2. MOBILE TOP NAVIGATION HEADER */}
      <header className="flex md:hidden items-center justify-between h-16 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1 text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-extrabold text-base tracking-tight text-slate-800 dark:text-white">Staff Planner</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-500 dark:text-slate-400">
            {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-xs">S</div>
        </div>
      </header>

      {/* MOBILE DRAWER MENU */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm">
          <div className="w-64 bg-white dark:bg-slate-900 h-full p-4 flex flex-col justify-between shadow-xl animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <span className="font-extrabold text-base tracking-tight text-slate-800 dark:text-white">Staff Planner</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <nav className="space-y-1">
                {/* Primary navigation items */}
                {primaryNavigationItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSidebarTabClick(item.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}

                {/* Mobile Collapsible Others */}
                <div className="pt-2">
                  <button
                    onClick={() => setIsOthersExpanded(!isOthersExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-3">
                      <MoreHorizontal className="w-5 h-5" />
                      <span>Others</span>
                    </div>
                    {isOthersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  {isOthersExpanded && (
                    <div className="pl-6 mt-1 space-y-1">
                      {othersSubItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleSidebarTabClick(item.id as any)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                            activeTab === item.id 
                              ? 'bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 border-l-2 border-brand-500'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>
            
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white text-base shadow-inner shrink-0">S</div>
              <div className="flex-1 min-w-0">
                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Saranya</h5>
                <p className="text-xs text-slate-400 font-semibold truncate">HR</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between h-16 px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center">
            <div className="text-sm font-medium text-slate-400">
              Hi <strong className="text-slate-700 dark:text-slate-200 font-semibold">Saranya</strong>,
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button 
              onClick={() => setDarkMode(!darkMode)} 
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title={darkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
              </button>
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-white">Recent Notifications</span>
                    <button onClick={() => setIsNotificationsOpen(false)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Clear</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    <div className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors border-l-2 border-brand-500 text-left">
                      <div className="text-xs font-semibold text-slate-800 dark:text-white">Excel Import Complete</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Project details successfully imported with clean validation.</div>
                    </div>
                    <div className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors border-l-2 border-emerald-500 text-left">
                      <div className="text-xs font-semibold text-slate-800 dark:text-white">New Assignment Added</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Pritam Kulshreshtha linked to project Paradip Maintenance.</div>
                    </div>
                    <div className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-xl transition-colors border-l-2 border-purple-500 text-left">
                      <div className="text-xs font-semibold text-slate-800 dark:text-white">Attendance Updated</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Bulk update applied successfully for all employees.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* View container */}
        <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </div>
      </main>
    </div>
  );
}
