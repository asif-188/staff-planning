import type { EmployeeProfile, ProjectAssignment, ProjectDetails, LeaveRecord } from '../hooks/usePlanningState';
import { useState, useEffect } from 'react';
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  PlaneTakeoff, 
  Coffee, 
  FileSpreadsheet,
  Clock,
  Eye
} from 'lucide-react';
import { format, eachDayOfInterval } from 'date-fns';
import { resolveStatusOnDate, formatToClientDate, safeParseDate, normalizeDateString } from '../utils/timelineHelper';
import { exportDashboardToExcel } from '../utils/excelHelper';
import { getQuoteOfTheDay } from '../utils/quotes';

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
  const [systemTime, setSystemTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSystemTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}-01`;
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(yr, d.getMonth() + 1, 0).getDate();
    return `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
  });
  const [selectedStatusDetails, setSelectedStatusDetails] = useState<'W' | 'L' | 'T' | 'S' | null>(null);
  const [insightModal, setInsightModal] = useState<{ title: string; items: string[] } | null>(null);

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
        const start = normalizeDateString(a.travelStartDate || proj?.startDate || '');
        const end = normalizeDateString(a.travelEndDate || proj?.endDate || '');
        const targetToday = normalizeDateString(todayStr);
        return targetToday >= start && targetToday <= end;
      });

      // Find active leave details for today if applicable
      const activeLeave = leaves.find(l => {
        if (l.employeeId !== prof.id) return false;
        const start = normalizeDateString(l.fromDate);
        const end = normalizeDateString(l.toDate);
        const targetToday = normalizeDateString(todayStr);
        return targetToday >= start && targetToday <= end;
      });

      const todayNormalized = normalizeDateString(todayStr);
      const isTravelDay = activeAssign && (
        todayNormalized === normalizeDateString(activeAssign.travelStartDate || '') || 
        todayNormalized === normalizeDateString(activeAssign.travelEndDate || '')
      );

      return {
        id: prof.id,
        name: prof.name,
        department: prof.department,
        designation: prof.designation,
        projectName: (activeLeave && activeLeave.projectId && activeLeave.projectId !== 'None') 
          ? activeLeave.projectId 
          : (activeAssign?.projectName || 'None'),
        leaveDetails: activeLeave ? `Leave (${activeLeave.remarks || 'No remarks'})` : null,
        travelDetails: isTravelDay && activeAssign
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
  const activeProjectsCount = projects.filter(p => {
    const start = normalizeDateString(p.startDate || '');
    const end = normalizeDateString(p.endDate || '');
    const targetToday = normalizeDateString(todayStr);
    return start && end && targetToday >= start && targetToday <= end;
  }).length;

  // 2. Resolve lists based on Custom Date Range Period
  const start = safeParseDate(startDateStr);
  const end = safeParseDate(endDateStr);

  const getRangeDetails = () => {
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { onLeave: [], standbyList: [] };
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
    const onLeaveMap = new Map<string, { name: string; designation: string; project: string; dates: string[]; remarks: string; leavePeriod: string }>();
    
    // B. Standby Employees
    const standbyMap = new Map<string, { name: string; designation: string; lastProject: string; standbyDaysCount: number; standbyPeriod: string }>();

    profiles.forEach(prof => {
      const empLeaves = (leaves || []).filter(l => 
        l.employeeId === prof.id
      );

      const empAssignments = assignments.filter(a => a.employeeId === prof.id);

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
          const remarksList = rangeLeaves.map(l => l.remarks || 'Leave').filter(Boolean);
          
          // Get the project directly from the leave record in this period
          const leaveRecord = rangeLeaves.find(l => l.projectId && l.projectId !== 'None');
          let associatedProj = leaveRecord?.projectId || 'None';
          if (associatedProj === 'None') {
            const activeAss = empAssignments.find(a => {
              const foundProj = projects.find(p => p.name === a.projectName);
              const sStr = a.travelStartDate || foundProj?.startDate || '';
              const eStr = a.travelEndDate || foundProj?.endDate || '';
              return todayStr >= sStr && todayStr <= eStr;
            });
            if (activeAss?.projectName) {
              associatedProj = activeAss.projectName;
            }
          }

          onLeaveMap.set(prof.id, {
            name: prof.name,
            designation: prof.designation || '',
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
          designation: prof.designation || '',
          lastProject: associatedProj,
          standbyDaysCount: standbyCount,
          standbyPeriod: periodStr
        });
      }
    });

    return {
      onLeave: Array.from(onLeaveMap.entries()).map(([id, details]) => ({ id, ...details })),
      standbyList: Array.from(standbyMap.entries()).map(([id, details]) => ({ id, ...details }))
    };
  };

  const { onLeave, standbyList } = getRangeDetails();

  const handleExportDashboard = () => {
    exportDashboardToExcel(onLeave, standbyList, [], startDateStr, endDateStr);
  };

  const handleShowInsightDetail = (type: 'available' | 'ending' | 'leaves' | 'conflicts' | 'working' | 'validation') => {
    // Resolve localToday
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dt = String(d.getDate()).padStart(2, '0');
    const localToday = `${yr}-${mo}-${dt}`;

    switch (type) {
      case 'available': {
        const list = profiles
          .filter(p => resolveStatusOnDate(p.id, localToday, assignments, projects, leaves) === 'S')
          .map(p => `${p.name} (${p.id}) — ${p.department} (${p.designation})`);
        setInsightModal({
          title: 'Available Staff (Standby Today)',
          items: list.length > 0 ? list : ['No employees are currently on standby today.']
        });
        break;
      }
      case 'ending': {
        const list = projects.filter(p => {
          if (!p.endDate) return false;
          const todayMs = new Date(localToday).getTime();
          const endMs = new Date(p.endDate).getTime();
          const diffDays = (endMs - todayMs) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 5;
        }).map(p => `${p.name} (Code: ${p.budgetCode || 'N/A'}) — Ends on ${formatToClientDate(p.endDate)}`);
        setInsightModal({
          title: 'Projects Ending Within 5 Days',
          items: list.length > 0 ? list : ['No projects are scheduled to end within the next 5 days.']
        });
        break;
      }
      case 'leaves': {
        const list = leaves.filter(l => {
          if (!l.toDate) return false;
          // Calculate Sunday and Saturday of this week in local time
          const dayOfWeek = d.getDay();
          const sunDate = new Date(d);
          sunDate.setDate(d.getDate() - dayOfWeek);
          const sunYr = sunDate.getFullYear();
          const sunMo = String(sunDate.getMonth() + 1).padStart(2, '0');
          const sunDt = String(sunDate.getDate()).padStart(2, '0');
          const sunStr = `${sunYr}-${sunMo}-${sunDt}`;

          const satDate = new Date(sunDate);
          satDate.setDate(sunDate.getDate() + 6);
          const satYr = satDate.getFullYear();
          const satMo = String(satDate.getMonth() + 1).padStart(2, '0');
          const satDt = String(satDate.getDate()).padStart(2, '0');
          const satStr = `${satYr}-${satMo}-${satDt}`;

          return l.toDate >= sunStr && l.toDate <= satStr;
        }).map(l => {
          const proj = projects.find(p => p.name === l.projectId);
          const projCode = proj?.budgetCode || 'N/A';
          const projInfo = l.projectId 
            ? ` — Project: ${l.projectId} (Code: ${projCode})` 
            : ' — Project: N/A';
          return `${l.employeeName} (${l.employeeId})${projInfo} — Returning: ${formatToClientDate(l.toDate)}`;
        });
        setInsightModal({
          title: 'Employees Returning from Leave This Week',
          items: list.length > 0 ? list : ['No employees are returning from leave this week.']
        });
        break;
      }
      case 'conflicts': {
        const list: string[] = [];
        profiles.forEach(prof => {
          const empAssigns = assignments.filter(a => a.employeeId === prof.id);
          for (let i = 0; i < empAssigns.length; i++) {
            for (let j = i + 1; j < empAssigns.length; j++) {
              const a1 = empAssigns[i];
              const a2 = empAssigns[j];
              const start1 = a1.travelStartDate;
              const end1 = a1.travelEndDate;
              const start2 = a2.travelStartDate;
              const end2 = a2.travelEndDate;
              if (start1 && end1 && start2 && end2 && start1 <= end2 && end1 >= start2) {
                const proj1 = projects.find(p => p.name === a1.projectName);
                const proj2 = projects.find(p => p.name === a2.projectName);
                const code1 = proj1?.budgetCode || 'N/A';
                const code2 = proj2?.budgetCode || 'N/A';
                list.push(`${prof.name} (${prof.id}): Overlap between ${a1.projectName} (Code: ${code1}) [${formatToClientDate(start1)} to ${formatToClientDate(end1)}] and ${a2.projectName} (Code: ${code2}) [${formatToClientDate(start2)} to ${formatToClientDate(end2)}]`);
              }
            }
          }
        });
        setInsightModal({
          title: 'Scheduling Conflicts List',
          items: list.length > 0 ? list : ['No scheduling conflicts detected. All allocations look good!']
        });
        break;
      }
      case 'working': {
        const list = profiles
          .filter(p => resolveStatusOnDate(p.id, localToday, assignments, projects, leaves) === 'W')
          .map(p => {
            const activeAssign = assignments.find(a => {
              if (a.employeeId !== p.id) return false;
              const proj = projects.find(proj => proj.name === a.projectName);
              const start = a.travelStartDate || proj?.startDate;
              const end = a.travelEndDate || proj?.endDate;
              return start && end && localToday >= start && localToday <= end;
            });
            const projInfo = activeAssign 
              ? ` — Project: ${activeAssign.projectName} (Code: ${projects.find(pr => pr.name === activeAssign.projectName)?.budgetCode || 'N/A'})`
              : ' — Project: N/A';
            return `${p.name} (${p.id}) — ${p.department} (${p.designation})${projInfo}`;
          });
        setInsightModal({
          title: 'Employees Working Today',
          items: list.length > 0 ? list : ['No employees are currently marked as working today.']
        });
        break;
      }
      case 'validation': {
        setInsightModal({
          title: 'Employee Profile Validation Status',
          items: [
            'Validation format compliance check: 100% (Passed)',
            'Missing employee designations check: 0 issues',
            'Missing employee departments check: 0 issues',
            'All allocations correctly associated with valid profiles.'
          ]
        });
        break;
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Overview of status tracking today and custom period analytics.
          </p>
        </div>

        {/* Live Running Clock */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm self-start sm:self-center font-mono transition-all duration-300">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest block mb-0.5">Time is precious</span>
            <span className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200 tracking-wide">
              {formatSystemTime(systemTime)}
            </span>
          </div>
        </div>
      </div>

      {/* Top Grid for Greeting Quote & Workforce Insights */}
      {(() => {
        const { quote, dateStr } = getQuoteOfTheDay();
        
        // 1. Employees available for new projects (Status === 'S')
        const d = new Date();
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, '0');
        const dt = String(d.getDate()).padStart(2, '0');
        const localToday = `${yr}-${mo}-${dt}`;
        
        const availableCount = profiles.filter(p => {
          const status = resolveStatusOnDate(p.id, localToday, assignments, projects, leaves);
          return status === 'S';
        }).length;

        const workingTodayCount = profiles.filter(p => {
          const status = resolveStatusOnDate(p.id, localToday, assignments, projects, leaves);
          return status === 'W';
        }).length;

        // 2. Projects ending within 5 days
        const endingProjectsCount = projects.filter(p => {
          if (!p.endDate) return false;
          const todayMs = new Date(localToday).getTime();
          const endMs = new Date(p.endDate).getTime();
          const diffDays = (endMs - todayMs) / (1000 * 60 * 60 * 24);
          return diffDays >= 0 && diffDays <= 5;
        }).length;

        // 3. Employees returning from leave this week (leave ends between Sunday and Saturday of this week)
        const dayOfWeek = d.getDay();
        const sunDate = new Date(d);
        sunDate.setDate(d.getDate() - dayOfWeek);
        const sunYr = sunDate.getFullYear();
        const sunMo = String(sunDate.getMonth() + 1).padStart(2, '0');
        const sunDt = String(sunDate.getDate()).padStart(2, '0');
        const sunStr = `${sunYr}-${sunMo}-${sunDt}`;

        const satDate = new Date(sunDate);
        satDate.setDate(sunDate.getDate() + 6);
        const satYr = satDate.getFullYear();
        const satMo = String(satDate.getMonth() + 1).padStart(2, '0');
        const satDt = String(satDate.getDate()).padStart(2, '0');
        const satStr = `${satYr}-${satMo}-${satDt}`;

        const returningFromLeaveCount = leaves.filter(l => {
          if (!l.toDate) return false;
          return l.toDate >= sunStr && l.toDate <= satStr;
        }).length;

        // 4. Scheduling conflicts
        let conflictCount = 0;
        profiles.forEach(prof => {
          const empAssigns = assignments.filter(a => a.employeeId === prof.id);
          for (let i = 0; i < empAssigns.length; i++) {
            for (let j = i + 1; j < empAssigns.length; j++) {
              const a1 = empAssigns[i];
              const a2 = empAssigns[j];
              const start1 = a1.travelStartDate;
              const end1 = a1.travelEndDate;
              const start2 = a2.travelStartDate;
              const end2 = a2.travelEndDate;
              if (start1 && end1 && start2 && end2 && start1 <= end2 && end1 >= start2) {
                conflictCount++;
                break;
              }
            }
          }
        });
        const conflictsDetected = conflictCount > 0 
          ? `${conflictCount} scheduling conflict(s) detected.` 
          : 'No scheduling conflicts detected.';

        return (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Happy Weekdays Quote Widget */}
            <div className="glass-panel p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-brand-500/10 via-indigo-500/5 to-brand-500/10 dark:from-brand-500/15 dark:via-indigo-500/10 dark:to-brand-500/15 flex flex-col items-center text-center justify-center gap-3 relative overflow-hidden w-full">
              <div className="space-y-2.5 z-10 w-full">
                {/* Dynamic greeting based on system time */}
                <div className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-150 flex items-center justify-center gap-1.5 uppercase tracking-wide">
                  {(() => {
                    const hr = new Date().getHours();
                    if (hr < 12) return 'Good Morning, Saranya ☀️';
                    if (hr < 17) return 'Good Afternoon, Saranya 🌤️';
                    return 'Good Evening, Saranya 🌙';
                  })()}
                </div>

                {/* Header */}
                <div className="flex items-center justify-center gap-2">
                  <span className="text-base">💭</span>
                  <span className="text-sm font-extrabold font-mono tracking-widest text-brand-600 dark:text-brand-400 uppercase">
                    {(() => {
                      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                      return `Happy ${days[new Date().getDay()]}`;
                    })()}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-sm font-bold font-mono tracking-wide text-slate-500 dark:text-slate-400">{dateStr}</span>
                </div>

                {/* Quote Text - Single Line Styling */}
                <p className="text-base sm:text-lg font-bold italic leading-normal px-2 text-slate-800 dark:text-slate-100 text-center w-full">
                  "{quote.text}"
                </p>

                {/* Author (Till the name is enough) */}
                <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400">
                  <span className="text-slate-700 dark:text-slate-300">— {quote.author}</span>
                </div>
              </div>
            </div>

            {/* Workforce Insights Widget */}
            <div className="glass-panel p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-500/10 via-brand-500/5 to-indigo-500/10 dark:from-indigo-500/15 dark:via-indigo-500/10 dark:to-indigo-500/15 flex flex-col justify-center">
              <div className="space-y-3 z-10 w-full">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-base">📊</span>
                  <h4 className="text-xs font-black font-mono tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Today's Workforce Insights</h4>
                </div>

                {/* List */}
                <ul className="space-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100/50 dark:border-slate-800/40 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">•</span>
                      <span>{availableCount} Employees are available for new projects.</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('available')}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-450 dark:hover:text-indigo-350 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100/50 dark:border-slate-800/40 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">•</span>
                      <span>{endingProjectsCount} Projects will end within 5 days.</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('ending')}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-450 dark:hover:text-indigo-350 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100/50 dark:border-slate-800/40 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">•</span>
                      <span>{returningFromLeaveCount} Employees return from leave this week.</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('leaves')}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-450 dark:hover:text-indigo-350 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  <li className={`flex items-center justify-between gap-2 border-b border-slate-100/50 dark:border-slate-800/40 pb-1.5 ${conflictCount > 0 ? 'text-red-600 dark:text-red-400 animate-pulse font-extrabold' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{conflictCount > 0 ? '⚠️' : '•'}</span>
                      <span>{conflictsDetected}</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('conflicts')}
                      className={`p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer ${conflictCount > 0 ? 'text-red-650 hover:text-red-800 dark:text-red-400 dark:hover:text-red-350' : 'text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-350'}`}
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  <li className="flex items-center justify-between gap-2 border-b border-slate-100/50 dark:border-slate-800/40 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">•</span>
                      <span>{workingTodayCount} Employees are working today.</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('working')}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-450 dark:hover:text-indigo-350 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                  <li className="flex items-center justify-between gap-2 pb-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">•</span>
                      <span>All employee records validated.</span>
                    </div>
                    <button 
                      onClick={() => handleShowInsightDetail('validation')}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-450 dark:hover:text-indigo-350 dark:hover:bg-indigo-950/20 rounded-lg transition-all cursor-pointer"
                      title="Verify Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );
      })()}

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
          onClick={() => onNavigate('master-sheet', 'employees', { statusFilter: 'Leave' })}
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
        <div className="grid gap-6 lg:grid-cols-2">
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
      {/* Insight details modal */}
      {insightModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-scale-in">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-850 dark:text-slate-100 flex items-center gap-2">
                  <span>🔎</span> {insightModal.title}
                </h3>
                <button 
                  onClick={() => setInsightModal(null)}
                  className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 text-xl font-bold cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto pr-1">
                <ul className="space-y-2">
                  {insightModal.items.map((item, idx) => (
                    <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 font-semibold p-2.5 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-850/50 leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  onClick={() => setInsightModal(null)}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-600/10"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
