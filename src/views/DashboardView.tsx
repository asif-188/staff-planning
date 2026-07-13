import type { EmployeeProfile, ProjectAssignment, ProjectDetails, LeaveRecord } from '../hooks/usePlanningState';
import { useState } from 'react';
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  PlaneTakeoff, 
  Coffee, 
  FileSpreadsheet,
  Clock,
  AlertCircle
} from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { resolveStatusOnDate, formatToClientDate, safeParseDate } from '../utils/timelineHelper';
import { exportDashboardToExcel } from '../utils/excelHelper';

interface DashboardViewProps {
  profiles: EmployeeProfile[];
  assignments: ProjectAssignment[];
  projects: ProjectDetails[];
  leaves: LeaveRecord[];
  onNavigate: (
    tab: 'dashboard' | 'master-sheet' | 'planning' | 'leave-management' | 'attendance' | 'availability-finder' | 'settings',
    subTab?: 'assignments' | 'employees' | 'projects' | 'recycle-bin',
    filters?: {
      search?: string;
      deptFilter?: string;
      projectFilter?: string;
      statusFilter?: string;
      activeTodayOnly?: boolean;
    }
  ) => void;
}

export default function DashboardView({ 
  profiles, 
  assignments, 
  projects, 
  leaves,
  onNavigate
}: DashboardViewProps) {
  const [startDateStr, setStartDateStr] = useState('2026-05-01');
  const [endDateStr, setEndDateStr] = useState('2026-05-31');
  const [selectedStatusDetails, setSelectedStatusDetails] = useState<'W' | 'L' | 'T' | 'S' | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 1. Resolve Status TODAY based strictly on the 4 client statuses: Work, Leave, Travel, Standby
  const getStatusToday = (profId: string) => {
    return resolveStatusOnDate(profId, todayStr, assignments, projects, leaves);
  };

  const getEmployeesByStatusToday = (status: 'W' | 'L' | 'T' | 'S') => {
    return profiles.filter(p => getStatusToday(p.id) === status).map(prof => {
      // Find active assignment details for today if applicable
      const activeAssign = assignments.find(a => {
        if (a.employeeId !== prof.id) return false;
        const proj = projects.find(proj => proj.name === a.projectName);
        const start = a.travelStartDate || proj?.startDate || '';
        const end = a.travelEndDate || proj?.endDate || '';
        return todayStr >= start && todayStr <= end;
      });

      // Find approved leave details for today if applicable
      const activeLeave = leaves.find(l => 
        l.employeeId === prof.id &&
        l.status === 'Approved' &&
        todayStr >= l.fromDate &&
        todayStr <= l.toDate
      );

      return {
        id: prof.id,
        name: prof.name,
        department: prof.department,
        designation: prof.designation,
        projectName: activeAssign?.projectName || 'None',
        leaveDetails: activeLeave ? `${activeLeave.leaveType} (${activeLeave.remarks || 'No remarks'})` : null,
        travelDetails: (activeAssign && (todayStr === (activeAssign.travelStartDate || '') || todayStr === (activeAssign.travelEndDate || ''))) 
          ? `Travel Day (${activeAssign.travelStartDate ? `Start: ${formatToClientDate(activeAssign.travelStartDate)}` : ''} ${activeAssign.travelEndDate ? `End: ${formatToClientDate(activeAssign.travelEndDate)}` : ''})` 
          : null
      };
    });
  };

  const statusesToday = profiles.map(p => getStatusToday(p.id));
  const workingToday = statusesToday.filter(s => s === 'W').length;
  const travellingToday = statusesToday.filter(s => s === 'T').length;
  const leavesToday = statusesToday.filter(s => s === 'L').length;
  const standbyToday = statusesToday.filter(s => s === 'S').length;

  const totalEmployees = profiles.length;
  const activeProjectsCount = Array.from(new Set(assignments.map(a => a.projectName))).length;

  // 2. Resolve lists based on Custom Date Range Period
  const start = safeParseDate(startDateStr);
  const end = safeParseDate(endDateStr);

  const getRangeDetails = () => {
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { onLeave: [], standbyList: [], zeroBalance: [] };
    }

    const rangeDays = eachDayOfInterval({ start, end });

    // Helper to compute contiguous ranges
    const getContiguousRanges = (dateStrings: string[]) => {
      if (dateStrings.length === 0) return '';
      const sorted = [...dateStrings].sort();
      const ranges: { start: string; end: string }[] = [];
      
      let startStr = sorted[0];
      let lastDate = new Date(startStr);
      
      for (let i = 1; i < sorted.length; i++) {
        const currentDate = new Date(sorted[i]);
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          ranges.push({ start: startStr, end: sorted[i - 1] });
          startStr = sorted[i];
        }
        lastDate = currentDate;
      }
      ranges.push({ start: startStr, end: sorted[sorted.length - 1] });
      
      return ranges.map(r => {
        if (r.start === r.end) return formatToClientDate(r.start);
        return `${formatToClientDate(r.start)} to ${formatToClientDate(r.end)}`;
      }).join(', ');
    };

    // A. Employees on Leave with details
    const onLeaveMap = new Map<string, { name: string; project: string; dates: string[]; remarks: string; leavePeriod: string }>();
    
    // B. Standby Employees
    const standbyMap = new Map<string, { name: string; lastProject: string; standbyDaysCount: number; standbyPeriod: string }>();
    
    // C. Leave Balance = 0 (Calculate leaves taken overall or within range? We calculate overall since leave balance is a fixed total)
    const zeroBalanceList: { id: string; name: string; department: string; leavesTaken: number; balance: number }[] = [];

    profiles.forEach(prof => {
      const empLeaves = (leaves || []).filter(l => 
        l.employeeId === prof.id && 
        l.status === 'Approved'
      );

      let totalLeavesOverall = 0;
      empLeaves.forEach(l => {
        const fromDate = safeParseDate(l.fromDate);
        const toDate = safeParseDate(l.toDate);
        const start2026 = safeParseDate('2026-01-01');
        const end2026 = safeParseDate('2026-12-31');

        const overlapStart = fromDate > start2026 ? fromDate : start2026;
        const overlapEnd = toDate < end2026 ? toDate : end2026;

        if (overlapStart <= overlapEnd) {
          const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          totalLeavesOverall += diffDays;
        }
      });

      const empAssignments = assignments.filter(a => a.employeeId === prof.id);

      const leaveBalance = 30 - totalLeavesOverall;
      if (leaveBalance <= 0) {
        zeroBalanceList.push({
          id: prof.id,
          name: prof.name,
          department: prof.department,
          leavesTaken: totalLeavesOverall,
          balance: leaveBalance
        });
      }

      // Check overlap with custom period
      const rangeLeaves = empLeaves.filter(l => {
        return !(l.toDate < startDateStr || l.fromDate > endDateStr);
      });

      if (rangeLeaves.length > 0) {
        const leaveDates: string[] = [];
        rangeDays.forEach(day => {
          const dStr = format(day, 'yyyy-MM-dd');
          const isCovered = rangeLeaves.some(l => dStr >= l.fromDate && dStr <= l.toDate);
          if (isCovered) {
            leaveDates.push(dStr);
          }
        });

        if (leaveDates.length > 0) {
          const remarksList = rangeLeaves.map(l => `${l.leaveType}: ${l.remarks || 'Approved Leave'}`).filter(Boolean);
          let associatedProj = 'None';
          const activeAss = empAssignments.find(a => {
            const foundProj = projects.find(p => p.name === a.projectName);
            const sStr = a.travelStartDate || foundProj?.startDate || '';
            const eStr = a.travelEndDate || foundProj?.endDate || '';
            return todayStr >= sStr && todayStr <= eStr;
          });
          if (activeAss?.projectName) {
            associatedProj = activeAss.projectName;
          }

          onLeaveMap.set(prof.id, {
            name: prof.name,
            project: associatedProj,
            dates: leaveDates,
            remarks: remarksList.join('; ') || 'No remarks',
            leavePeriod: getContiguousRanges(leaveDates)
          });
        }
      }

      // Count standby days in custom range
      let standbyCount = 0;
      let associatedProj = 'None';
      const standbyDates: string[] = [];
      rangeDays.forEach(day => {
        const dStr = format(day, 'yyyy-MM-dd');
        const st = resolveStatusOnDate(prof.id, dStr, assignments, projects, leaves);
        if (st === 'S') {
          standbyCount++;
          standbyDates.push(dStr);
          // Find last project before this standby day
          const ended = empAssignments.map(a => {
            const foundProj = projects.find(p => p.name === a.projectName);
            const eStr = a.travelEndDate || foundProj?.endDate || '';
            return { name: a.projectName, end: safeParseDate(eStr) };
          }).filter(x => x.end < day);
          
          if (ended.length > 0) {
            ended.sort((a, b) => b.end.getTime() - a.end.getTime());
            associatedProj = ended[0].name;
          }
        }
      });

      if (standbyCount > 0 && standbyDates.length > 0) {
        const periodStr = getContiguousRanges(standbyDates);

        standbyMap.set(prof.id, {
          name: prof.name,
          lastProject: associatedProj,
          standbyDaysCount: standbyCount,
          standbyPeriod: periodStr
        });
      }
    });

    return {
      onLeave: Array.from(onLeaveMap.entries()).map(([id, details]) => ({ id, ...details })),
      standbyList: Array.from(standbyMap.entries()).map(([id, details]) => ({ id, ...details })),
      zeroBalance: zeroBalanceList
    };
  };

  const { onLeave, standbyList, zeroBalance } = getRangeDetails();

  const handleExportDashboard = () => {
    exportDashboardToExcel(onLeave, standbyList, zeroBalance, startDateStr, endDateStr);
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Overview of status tracking today and custom period analytics.
          </p>
        </div>

        <button
          onClick={handleExportDashboard}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors cursor-pointer self-start"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export Reports
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div 
          onClick={() => onNavigate('master-sheet', 'employees')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-brand-500/30 dark:hover:border-brand-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-500 transition-colors">Total Staff</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{totalEmployees}</h3>
            </div>
            <div className="p-3 bg-brand-100 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Total Projects */}
        <div 
          onClick={() => onNavigate('master-sheet', 'projects')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 transition-colors">Active Projects</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{activeProjectsCount}</h3>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Staff on Work Today */}
        <div 
          onClick={() => onNavigate('master-sheet', 'assignments')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-blue-500/30 dark:hover:border-blue-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-blue-500 transition-colors">Working Today</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{workingToday}</h3>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Staff on Leave Today */}
        <div 
          onClick={() => onNavigate('master-sheet', 'assignments', { statusFilter: 'Leave' })}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-rose-500/30 dark:hover:border-rose-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-rose-500 transition-colors">On Leave Today</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{leavesToday}</h3>
            </div>
            <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <Coffee className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Status Today Breakdown */}
      <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Status Today ({format(new Date(), 'dd-MM-yyyy')})</h3>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div 
            onClick={() => setSelectedStatusDetails('W')}
            className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-center cursor-pointer hover:scale-[1.03] active:scale-[0.98] hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
          >
            <UserCheck className="w-6 h-6 mx-auto text-blue-600 dark:text-blue-400" />
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Work</div>
            <div className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{workingToday}</div>
          </div>
          <div 
            onClick={() => setSelectedStatusDetails('L')}
            className="p-4 bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl text-center cursor-pointer hover:scale-[1.03] active:scale-[0.98] hover:shadow-md hover:border-rose-400 dark:hover:border-rose-500/50 transition-all"
          >
            <Coffee className="w-6 h-6 mx-auto text-rose-600 dark:text-rose-400" />
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Leave</div>
            <div className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-400">{leavesToday}</div>
          </div>
          <div 
            onClick={() => setSelectedStatusDetails('T')}
            className="p-4 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl text-center cursor-pointer hover:scale-[1.03] active:scale-[0.98] hover:shadow-md hover:border-purple-400 dark:hover:border-purple-500/50 transition-all"
          >
            <PlaneTakeoff className="w-6 h-6 mx-auto text-purple-600 dark:text-purple-400" />
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Travel</div>
            <div className="text-2xl font-bold mt-1 text-purple-700 dark:text-purple-400">{travellingToday}</div>
          </div>
          <div 
            onClick={() => setSelectedStatusDetails('S')}
            className="p-4 bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl text-center cursor-pointer hover:scale-[1.03] active:scale-[0.98] hover:shadow-md hover:border-orange-400 dark:hover:border-orange-500/50 transition-all"
          >
            <Clock className="w-6 h-6 mx-auto text-orange-600 dark:text-orange-400" />
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2">Standby</div>
            <div className="text-2xl font-bold mt-1 text-orange-700 dark:text-orange-400">{standbyToday}</div>
          </div>
        </div>
      </div>

      {/* Date Range Selector for Period Analysis */}
      <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Custom Period Analysis</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Filter details and metrics for a specific date range</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start">
            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase text-[9px]">From:</span>
                <input
                  type="date"
                  value={startDateStr}
                  onChange={e => setStartDateStr(e.target.value)}
                  className="bg-transparent focus:outline-none text-xs font-medium"
                />
              </div>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 uppercase text-[9px]">To:</span>
                <input
                  type="date"
                  value={endDateStr}
                  onChange={e => setEndDateStr(e.target.value)}
                  className="bg-transparent focus:outline-none text-xs font-medium"
                />
              </div>
            </div>

            <button
              onClick={handleExportDashboard}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export to Excel
            </button>
          </div>
        </div>

        {/* 3 Redesigned Period Lists */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* A. Employees on Leave */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Coffee className="w-4.5 h-4.5 text-rose-500" />
                Staff on Leave ({onLeave.length})
              </h4>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {onLeave.length > 0 ? (
                onLeave.map(item => (
                  <div key={item.id} className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-1">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-800 dark:text-white">{item.name}</span>
                      <span className="text-slate-400 font-mono">{item.id}</span>
                    </div>
                    <div className="text-slate-500"><span className="font-semibold">Project:</span> {item.project}</div>
                    <div className="text-slate-500 font-semibold mt-1">
                      {item.leavePeriod}
                    </div>
                    <div className="text-[10px] text-slate-400 italic mt-0.5">&ldquo;{item.remarks}&rdquo;</div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">No employees on leave in this period.</div>
              )}
            </div>
          </div>

          {/* B. Standby Employees */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-orange-500" />
              Standby Employees ({standbyList.length})
            </h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {standbyList.length > 0 ? (
                standbyList.map(item => (
                  <div key={item.id} className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-800 dark:text-white">{item.name}</span>
                      <span className="text-slate-400 font-mono">{item.id}</span>
                    </div>
                    <div className="text-slate-500"><span className="font-semibold">Last Project:</span> {item.lastProject}</div>
                    <div className="text-slate-500 font-semibold mt-1">
                      {item.standbyPeriod}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 rounded-full font-bold text-[10px] mt-1">
                      Standby: {item.standbyDaysCount} Days
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">No employees on standby in this period.</div>
              )}
            </div>
          </div>

          {/* C. Leave Balance = 0 */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-red-500" />
              Leave Balance = 0 ({zeroBalance.length})
            </h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {zeroBalance.length > 0 ? (
                zeroBalance.map(item => (
                  <div key={item.id} className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-xs space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-800 dark:text-white">{item.name}</span>
                      <span className="text-slate-400 font-mono">{item.id}</span>
                    </div>
                    <div className="text-slate-500"><span className="font-semibold">Dept:</span> {item.department}</div>
                    <div className="flex justify-between text-[10px] bg-red-50 dark:bg-red-950/20 p-2 rounded-lg font-bold mt-1 text-red-700 dark:text-red-400">
                      <span>Leaves Taken: {item.leavesTaken} Days</span>
                      <span>Balance: {item.balance} Days</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">No employees have reached a 0 leave balance.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zero Balance List */}
      <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Zero Leave Balance Alert</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4 text-center">Leaves Taken</th>
                <th className="py-3 px-4 text-center">Current Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
              {zeroBalance.length > 0 ? (
                zeroBalance.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">{emp.id}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">{emp.name}</td>
                    <td className="py-3.5 px-4 text-slate-650 dark:text-slate-400">{emp.department}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-rose-600">{emp.leavesTaken} days</td>
                    <td className="py-3.5 px-4 text-center"><span className="px-2.5 py-1 bg-red-150 text-red-700 rounded-lg text-xs font-bold">{emp.balance} days</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-550 italic">No employees with zero leave balance.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Details Modal */}
      {selectedStatusDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm animate-fade-in" 
            onClick={() => setSelectedStatusDetails(null)} 
          />

          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-scale-up">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {selectedStatusDetails === 'W' && <UserCheck className="w-6 h-6 text-blue-500" />}
                  {selectedStatusDetails === 'L' && <Coffee className="w-6 h-6 text-rose-500" />}
                  {selectedStatusDetails === 'T' && <PlaneTakeoff className="w-6 h-6 text-purple-500" />}
                  {selectedStatusDetails === 'S' && <Clock className="w-6 h-6 text-orange-500" />}
                  Staff List: {
                    selectedStatusDetails === 'W' ? 'Working Today' :
                    selectedStatusDetails === 'L' ? 'On Leave Today' :
                    selectedStatusDetails === 'T' ? 'Travelling Today' : 'On Standby Today'
                  }
                </h3>
                <button 
                  onClick={() => setSelectedStatusDetails(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-1">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-405 uppercase">
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Dept / Role</th>
                      {selectedStatusDetails === 'W' && <th className="py-2 px-3">Project</th>}
                      {selectedStatusDetails === 'L' && <th className="py-2 px-3">Leave details</th>}
                      {selectedStatusDetails === 'T' && <th className="py-2 px-3">Travel details</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                    {getEmployeesByStatusToday(selectedStatusDetails).length > 0 ? (
                      getEmployeesByStatusToday(selectedStatusDetails).map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800 dark:text-white">{emp.name}</div>
                            <div className="text-[11px] font-mono text-slate-400">{emp.id}</div>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-550 dark:text-slate-400">
                            <div>{emp.department}</div>
                            <div className="opacity-80">{emp.designation}</div>
                          </td>
                          {selectedStatusDetails === 'W' && (
                            <td className="py-3 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {emp.projectName}
                            </td>
                          )}
                          {selectedStatusDetails === 'L' && (
                            <td className="py-3 px-3 text-xs text-rose-600 dark:text-rose-450 italic font-medium">
                              {emp.leaveDetails || 'No details'}
                            </td>
                          )}
                          {selectedStatusDetails === 'T' && (
                            <td className="py-3 px-3 text-xs text-purple-655 dark:text-purple-400 font-medium">
                              {emp.travelDetails || 'Travelling'}
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={selectedStatusDetails === 'S' ? 2 : 3} className="py-4 text-center text-slate-450 italic">
                          No staff in this status today
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  onClick={() => setSelectedStatusDetails(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-755 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
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
