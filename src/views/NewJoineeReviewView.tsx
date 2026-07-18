import React, { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileSpreadsheet, 
  FileText, 
  CalendarDays,
  X, 
  Search, 
  Filter, 
  RotateCcw,
  Sparkles,
  Link,
  Server
} from 'lucide-react';
import type { ReviewRecord } from '../hooks/usePlanningState';
import { exportNewJoineeReviewsToExcel } from '../utils/excelHelper';
import { formatToClientDate } from '../utils/timelineHelper';

interface NewJoineeReviewViewProps {
  reviews: ReviewRecord[];
  scheduleReview: (id: string, reviewer: string) => Promise<void>;
  triggerPowerAutomate: (id: string) => Promise<void>;
  submitMOM: (id: string, mom: {
    notes: string;
    feedback: string;
    actionItems: string;
    attachmentName?: string;
    completionDate: string;
  }) => Promise<void>;
}

export default function NewJoineeReviewView({
  reviews,
  scheduleReview,
  triggerPowerAutomate,
  submitMOM
}: NewJoineeReviewViewProps) {
  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [reviewerFilter, setReviewerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Modals state
  const [selectedReview, setSelectedReview] = useState<ReviewRecord | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isMomModalOpen, setIsMomModalOpen] = useState(false);
  const [isViewMomOpen, setIsViewMomOpen] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  
  // MOM Form states
  const [momNotes, setMomNotes] = useState('');
  const [momFeedback, setMomFeedback] = useState('');
  const [momActionItems, setMomActionItems] = useState('');
  const [momAttachment, setMomAttachment] = useState('');
  const [momCompletionDate, setMomCompletionDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Power Automate Simulation state
  const [simulatingReviewId, setSimulatingReviewId] = useState<string | null>(null);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('v2_pa_webhook_url') || '');

  useEffect(() => {
    localStorage.setItem('v2_pa_webhook_url', webhookUrl);
  }, [webhookUrl]);

  // Derived dashboard widgets counts
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const startOfWk = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endOfWk = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const reviewsDueToday = reviews.filter(r => r.dueDate === todayStr && r.status !== 'Completed').length;
  const reviewsDueThisWeek = reviews.filter(r => r.dueDate >= startOfWk && r.dueDate <= endOfWk && r.status !== 'Completed').length;
  const overdueReviewsCount = reviews.filter(r => r.status === 'Overdue').length;
  const completedReviewsCount = reviews.filter(r => r.status === 'Completed').length;

  // Filter reviews
  const filteredReviews = reviews.filter(r => {
    const matchesSearch = 
      r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !deptFilter || r.department === deptFilter;
    const matchesReviewer = !reviewerFilter || (r.reviewer || '').toLowerCase().includes(reviewerFilter.toLowerCase());
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesPeriod = !periodFilter || r.reviewType === periodFilter;
    const matchesDateRange = 
      (!startDateFilter || r.dueDate >= startDateFilter) &&
      (!endDateFilter || r.dueDate <= endDateFilter);

    return matchesSearch && matchesDept && matchesReviewer && matchesStatus && matchesPeriod && matchesDateRange;
  });

  // Extract unique departments for dropdown
  const departments = Array.from(new Set(reviews.map(r => r.department))).filter(Boolean);

  // Generate Outlook calendar .ics download
  const handleDownloadICS = (r: ReviewRecord) => {
    const start = new Date(r.dueDate);
    start.setHours(10, 0, 0); // Default to 10:00 AM
    const end = new Date(r.dueDate);
    end.setHours(10, 30, 0); // Default to 10:30 AM
    
    const formatDateICS = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Staff Planner//New Joinee Review//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${r.id}@staffplanner.com`,
      `DTSTAMP:${formatDateICS(new Date())}`,
      `DTSTART:${formatDateICS(start)}`,
      `DTEND:${formatDateICS(end)}`,
      `SUMMARY:${r.reviewType} probation Review - ${r.employeeName}`,
      `DESCRIPTION:Probation review meeting for ${r.employeeName} (${r.designation})\\nDepartment: ${r.department}\\nJoining Date: ${r.joiningDate}\\nReviewer: ${r.reviewer || 'Not Assigned'}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Review_${r.employeeName.replace(/\s+/g, '_')}_${r.reviewType.replace(/\s+/g, '')}.ics`;
    link.click();
    window.URL.revokeObjectURL(url);

    // Also update UI that invite is generated
    scheduleReview(r.id, r.reviewer || 'TBD');
  };

  // Microsoft Power Automate webhook run & simulation
  const handleTriggerPowerAutomate = async (r: ReviewRecord) => {
    setSimulatingReviewId(r.id);
    setSimulationStep(1);
    setSimulationLogs([`[INFO] 📡 Power Automate Flow triggered for Review ID: ${r.id}...`]);

    // Send HTTP POST if webhook is configured
    if (webhookUrl) {
      try {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reviewId: r.id,
            employeeId: r.employeeId,
            employeeName: r.employeeName,
            department: r.department,
            designation: r.designation,
            joiningDate: r.joiningDate,
            reviewType: r.reviewType,
            dueDate: r.dueDate,
            reviewer: r.reviewer || 'HR Team',
            status: r.status,
            triggeredAt: new Date().toISOString()
          })
        });
        setSimulationLogs(prev => [...prev, `[SUCCESS] 📤 Real webhook payload dispatched to Microsoft Flow!`]);
      } catch (err) {
        setSimulationLogs(prev => [...prev, `[ERROR] Failed to post webhook: ${(err as Error).message}`]);
      }
    }

    // Step-by-step UI visualizer delay
    setTimeout(() => {
      setSimulationStep(2);
      setSimulationLogs(prev => [...prev, `[INFO] 📧 Email warning generated for Reviewer: ${r.reviewer || 'HR Team'}`]);
      
      setTimeout(() => {
        setSimulationStep(3);
        setSimulationLogs(prev => [...prev, `[INFO] 📅 Created Outlook Calendar Event on ${r.dueDate} at 10:00 AM`]);
        
        setTimeout(() => {
          setSimulationStep(4);
          setSimulationLogs(prev => [
            ...prev, 
            `[INFO] 👤 HR Notification pushed to Teams channel: "New Joinee Probation Review Checklist"`,
            `[SUCCESS] 🎉 Automation flow executed fully (100% completed).`
          ]);
          triggerPowerAutomate(r.id);
        }, 1200);
      }, 1000);
    }, 800);
  };

  const openScheduleModal = (r: ReviewRecord) => {
    setSelectedReview(r);
    setReviewerName(r.reviewer || '');
    setIsScheduleModalOpen(true);
  };

  const saveScheduledReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    await scheduleReview(selectedReview.id, reviewerName);
    setIsScheduleModalOpen(false);
    
    // Automatically trigger calendar invite file download
    const updatedRecord = { ...selectedReview, reviewer: reviewerName };
    handleDownloadICS(updatedRecord);
  };

  const openMomModal = (r: ReviewRecord) => {
    setSelectedReview(r);
    setMomNotes(r.notes || '');
    setMomFeedback(r.feedback || '');
    setMomActionItems(r.actionItems || '');
    setMomAttachment(r.attachmentName || '');
    setMomCompletionDate(r.completionDate || format(new Date(), 'yyyy-MM-dd'));
    setIsMomModalOpen(true);
  };

  const saveMom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    await submitMOM(selectedReview.id, {
      notes: momNotes,
      feedback: momFeedback,
      actionItems: momActionItems,
      attachmentName: momAttachment || undefined,
      completionDate: momCompletionDate
    });
    setIsMomModalOpen(false);
    setSelectedReview(null);
  };

  const openViewMom = (r: ReviewRecord) => {
    setSelectedReview(r);
    setIsViewMomOpen(true);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDeptFilter('');
    setReviewerFilter('');
    setStatusFilter('');
    setPeriodFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30';
      case 'Scheduled': return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/30';
      case 'Overdue': return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800/30 animate-pulse';
      default: return 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            New Joinee Review <Sparkles className="w-5 h-5 text-brand-500" />
          </h1>
          <p className="text-slate-500 dark:text-slate-400">Automated tracking and minutes documentation for new employee probation milestones.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportNewJoineeReviewsToExcel(filteredReviews)}
            className="flex items-center gap-2 px-4.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-350 dark:hover:border-slate-750 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-sm transition shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            Export List
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center text-orange-600 dark:text-orange-500 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due Today</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{reviewsDueToday}</h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-950/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Due This Week</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{reviewsDueThisWeek}</h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 animate-pulse">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Overdue Reviews</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{overdueReviewsCount}</h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-500 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Completed Reviews</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{completedReviewsCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Simulator Block */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Search & Filters */}
        <div className="xl:col-span-2 glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-500" />
              Filter Reviews
            </h3>
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Search Employee</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ID or Name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Department</label>
              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Reviewer</label>
              <input
                type="text"
                placeholder="Reviewer Name..."
                value={reviewerFilter}
                onChange={e => setReviewerFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Review Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Review Type</label>
              <select
                value={periodFilter}
                onChange={e => setPeriodFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
              >
                <option value="">All Milestones</option>
                <option value="30 Days">30th Day Review</option>
                <option value="90 Days">90th Day Review</option>
                <option value="180 Days">180th Day Review</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">From Due</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">To Due</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Power Automate Simulator */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800/60 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-brand-500 animate-pulse" />
              Power Automate Simulator
            </h3>
            <span className="inline-flex px-2 py-0.5 bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400 border border-brand-200 dark:border-brand-900/30 text-[10px] font-black uppercase rounded-md tracking-wider">Active</span>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">MS Power Automate Webhook URL</label>
              <input
                type="text"
                placeholder="https://prod-XX.westus.logic.azure.com:443/workflows/..."
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
              />
            </div>

            {/* Visual Simulator Flow map */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850 text-[11px] font-bold text-slate-500 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] shrink-0 transition ${
                  simulationStep >= 1 ? 'bg-indigo-500 border-indigo-500 text-white animate-bounce' : 'bg-slate-100 dark:bg-slate-900 border-slate-350 text-slate-400'
                }`}>1</span>
                <span className={simulationStep >= 1 ? 'text-indigo-600 dark:text-indigo-400' : ''}>Flow Trigger / Webhook Call</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] shrink-0 transition ${
                  simulationStep >= 2 ? 'bg-indigo-500 border-indigo-500 text-white animate-bounce' : 'bg-slate-100 dark:bg-slate-900 border-slate-350 text-slate-400'
                }`}>2</span>
                <span className={simulationStep >= 2 ? 'text-indigo-600 dark:text-indigo-400' : ''}>Auto-Send Mail Warning to Reviewer</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] shrink-0 transition ${
                  simulationStep >= 3 ? 'bg-indigo-500 border-indigo-500 text-white animate-bounce' : 'bg-slate-100 dark:bg-slate-900 border-slate-350 text-slate-400'
                }`}>3</span>
                <span className={simulationStep >= 3 ? 'text-indigo-600 dark:text-indigo-400' : ''}>Generate Outlook Meeting Invite</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border text-[8px] shrink-0 transition ${
                  simulationStep >= 4 ? 'bg-indigo-500 border-indigo-500 text-white animate-bounce' : 'bg-slate-100 dark:bg-slate-900 border-slate-350 text-slate-400'
                }`}>4</span>
                <span className={simulationStep >= 4 ? 'text-emerald-600 dark:text-emerald-400' : ''}>Log Teams Notification & Escalation Check</span>
              </div>
            </div>

            {/* Simulation Log console */}
            <div className="p-3 bg-slate-900 dark:bg-black rounded-xl text-[10px] font-mono text-slate-300 border border-slate-800 h-28 overflow-y-auto space-y-1">
              {simulationLogs.length === 0 ? (
                <div className="text-slate-500 italic py-2 text-center select-none">No active flow running. Click "Automate ⚡" on any scheduled record.</div>
              ) : (
                simulationLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review List Table Grid */}
      <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                <th className="py-4.5 px-6">Employee ID</th>
                <th className="py-4.5 px-6">Name</th>
                <th className="py-4.5 px-6">Milestone</th>
                <th className="py-4.5 px-6">Joining Date</th>
                <th className="py-4.5 px-6">Due Date</th>
                <th className="py-4.5 px-6">Reviewer</th>
                <th className="py-4.5 px-6">Status</th>
                <th className="py-4.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
              {filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500 font-semibold bg-white dark:bg-slate-900">
                    No new joinee reviews found matching your search.
                  </td>
                </tr>
              ) : (
                filteredReviews.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition bg-white dark:bg-slate-900">
                    <td className="py-4 px-6 font-bold text-slate-800 dark:text-white">{r.employeeId}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800 dark:text-white">{r.employeeName}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{r.designation} &bull; {r.department}</div>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{r.reviewType}</td>
                    <td className="py-4 px-6 text-xs font-semibold font-mono text-slate-500 dark:text-slate-455">{formatToClientDate(r.joiningDate)}</td>
                    <td className="py-4 px-6 text-xs font-bold font-mono text-slate-600 dark:text-slate-350">{formatToClientDate(r.dueDate)}</td>
                    <td className="py-4 px-6 font-semibold text-slate-700 dark:text-slate-300">{r.reviewer || <span className="text-slate-400 dark:text-slate-600 font-normal italic">Unassigned</span>}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === 'Pending' && (
                          <button
                            onClick={() => openScheduleModal(r)}
                            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer"
                          >
                            Schedule
                          </button>
                        )}

                        {(r.status === 'Scheduled' || r.status === 'Overdue') && (
                          <>
                            <button
                              onClick={() => openMomModal(r)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer"
                            >
                              Record MOM
                            </button>
                            <button
                              onClick={() => handleTriggerPowerAutomate(r)}
                              disabled={simulatingReviewId === r.id}
                              title="Trigger Power Automate Flows"
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 rounded-lg text-xs transition border border-indigo-200 dark:border-indigo-900/30 cursor-pointer disabled:opacity-50"
                            >
                              Automate ⚡
                            </button>
                          </>
                        )}

                        {r.status === 'Completed' && (
                          <button
                            onClick={() => openViewMom(r)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-250 font-bold rounded-lg text-xs transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            View MOM
                          </button>
                        )}

                        <button
                          onClick={() => handleDownloadICS(r)}
                          title="Download Outlook Calendar invite (.ics)"
                          className="p-1.5 bg-white hover:bg-slate-100 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-xs transition border border-slate-200 dark:border-slate-755 cursor-pointer"
                        >
                          <CalendarDays className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Review Modal */}
      {isScheduleModalOpen && selectedReview && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Schedule Probation Review</h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={saveScheduledReview} className="p-6 space-y-4.5">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-855 text-xs space-y-1 text-slate-500 dark:text-slate-400">
                <div><span className="font-bold">Employee:</span> {selectedReview.employeeName} ({selectedReview.employeeId})</div>
                <div><span className="font-bold">Milestone:</span> {selectedReview.reviewType} Probation Review</div>
                <div><span className="font-bold">Suggested Due Date:</span> {formatToClientDate(selectedReview.dueDate)}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign Reviewer</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HR Manager / Dept Head"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl text-sm focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  Save & Generate Calendar Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record MOM Modal */}
      {isMomModalOpen && selectedReview && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-150 dark:border-slate-855 bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Record Minutes of Meeting (MOM)</h3>
              <button onClick={() => setIsMomModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={saveMom} className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-855 text-xs text-slate-500 dark:text-slate-400">
                <div><span className="font-bold">Employee Name:</span> {selectedReview.employeeName}</div>
                <div><span className="font-bold">Reviewer:</span> {selectedReview.reviewer}</div>
                <div><span className="font-bold">Milestone:</span> {selectedReview.reviewType}</div>
                <div><span className="font-bold">Due Date:</span> {formatToClientDate(selectedReview.dueDate)}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Review Notes / Summary</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Record summary of discussion..."
                  value={momNotes}
                  onChange={e => setMomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Employee Performance & Feedback</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Reviewer feedback and comments..."
                  value={momFeedback}
                  onChange={e => setMomFeedback(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Action Items & Deliverables</label>
                <textarea
                  required
                  rows={2}
                  placeholder="List next steps and tasks..."
                  value={momActionItems}
                  onChange={e => setMomActionItems(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Completion Date</label>
                  <input
                    type="date"
                    required
                    value={momCompletionDate}
                    onChange={e => setMomCompletionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Attach Review Document</label>
                  <input
                    type="text"
                    placeholder="Document name or link..."
                    value={momAttachment}
                    onChange={e => setMomAttachment(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-350 dark:border-slate-750 rounded-xl focus:outline-none focus:border-brand-500 text-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMomModalOpen(false)}
                  className="px-4.5 py-2.5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer"
                >
                  Submit MOM & Complete Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View MOM details Modal */}
      {isViewMomOpen && selectedReview && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-150 dark:border-slate-855 bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-extrabold text-slate-900 dark:text-white">Probation Review MOM Details</h3>
              <button onClick={() => setIsViewMomOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-100 dark:border-slate-800/60 pb-3">
                  <div>
                    <span className="block font-bold text-slate-400">Employee</span>
                    <span className="font-semibold text-slate-850 dark:text-slate-100">{selectedReview.employeeName}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-400">Reviewer</span>
                    <span className="font-semibold text-slate-855 dark:text-slate-100">{selectedReview.reviewer}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-400">Milestone</span>
                    <span className="font-semibold text-slate-855 dark:text-slate-100">{selectedReview.reviewType}</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-400">Completed Date</span>
                    <span className="font-semibold text-slate-855 dark:text-slate-100 font-mono">{selectedReview.completionDate ? formatToClientDate(selectedReview.completionDate) : '-'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MOM Summary Notes</h4>
                  <p className="p-3 bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 rounded-xl text-slate-700 dark:text-slate-350 leading-relaxed text-xs">
                    {selectedReview.notes || 'No notes recorded.'}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Feedback</h4>
                  <p className="p-3 bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 rounded-xl text-slate-700 dark:text-slate-350 leading-relaxed text-xs">
                    {selectedReview.feedback || 'No feedback recorded.'}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Action Items</h4>
                  <p className="p-3 bg-slate-50 dark:bg-slate-955 border border-slate-150 dark:border-slate-850 rounded-xl text-slate-700 dark:text-slate-350 leading-relaxed text-xs">
                    {selectedReview.actionItems || 'No action items recorded.'}
                  </p>
                </div>

                {selectedReview.attachmentName && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-450">
                      <FileText className="w-4 h-4" />
                      {selectedReview.attachmentName}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 flex items-center gap-1 cursor-pointer hover:underline">
                      <Link className="w-3.5 h-3.5 text-emerald-500" />
                      View Document
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsViewMomOpen(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
