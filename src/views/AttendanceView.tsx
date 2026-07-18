import type { EmployeeProfile, ProjectAssignment, ProjectDetails, LeaveRecord } from '../hooks/usePlanningState';
import { getDatesForMonth, getDatesForInterval, resolveStatusOnDate } from '../utils/timelineHelper';
import { format } from 'date-fns';
import { 
  CalendarDays, 
  TableProperties, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle,
  Download
} from 'lucide-react';
import { exportAttendanceToExcel } from '../utils/excelHelper';

interface AttendanceViewProps {
  profiles: EmployeeProfile[];
  assignments: ProjectAssignment[];
  projects: ProjectDetails[];
  leaves: LeaveRecord[];
  hasValidationErrors?: boolean;
}

import { useState } from 'react';

export default function AttendanceView({
  profiles,
  assignments,
  projects,
  leaves,
  hasValidationErrors
}: AttendanceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'calendar'>('table');
  
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(yr, d.getMonth() + 1, 0).getDate();
    return `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
  });

  // Month selector for Calendar View (needs to draw offsets)
  const [currentMonthStr, setCurrentMonthStr] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  });
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  
  const dates = activeSubTab === 'table' 
    ? getDatesForInterval(customStart, customEnd)
    : getDatesForMonth(currentMonthStr);
    
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Calendar View specific state
  const [selectedEmpId, setSelectedEmpId] = useState<string>(profiles[0]?.id || '');
  const selectedEmp = profiles.find(e => e.id === selectedEmpId) || profiles[0];



  // Month navigation logic for Calendar View
  const [year, month] = currentMonthStr.split('-');
  const displayMonthName = format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy');

  const handlePrevMonth = () => {
    const prevDate = new Date(parseInt(year), parseInt(month) - 2, 1);
    setCurrentMonthStr(format(prevDate, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const nextDate = new Date(parseInt(year), parseInt(month), 1);
    setCurrentMonthStr(format(nextDate, 'yyyy-MM'));
  };

  // Calculate attendance summaries for Table View
  const getAttendanceSummary = (prof: EmployeeProfile) => {
    let w = 0, l = 0, t = 0, s = 0;
    dates.forEach(d => {
      const status = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles);

      if (status === 'W') w++;
      else if (status === 'L') l++;
      else if (status === 'T') t++;
      else if (status === 'S') s++;
    });

    const activeDays = w + t;
    const totalScheduled = w + t + l + s;
    const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

    return { w, l, t, s, rate };
  };

  const filteredProfiles = profiles.filter(prof => {
    const q = attendanceSearchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchesProjOrCode = assignments.filter(a => a.employeeId === prof.id).some(a => {
      const proj = projects.find(p => p.name === a.projectName);
      return a.projectName.toLowerCase().includes(q) || (proj?.budgetCode || '').toLowerCase().includes(q);
    });
    return prof.name.toLowerCase().includes(q) || 
           prof.id.toLowerCase().includes(q) || 
           prof.department.toLowerCase().includes(q) ||
           prof.designation.toLowerCase().includes(q) ||
           matchesProjOrCode;
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    let valA: any;
    let valB: any;

    if (sortField === 'id') {
      valA = a.id;
      valB = b.id;
    } else if (sortField === 'name') {
      valA = a.name;
      valB = b.name;
    } else if (sortField === 'department') {
      valA = a.department;
      valB = b.department;
    } else if (sortField === 'designation') {
      valA = a.designation;
      valB = b.designation;
    } else {
      const sumA = getAttendanceSummary(a);
      const sumB = getAttendanceSummary(b);
      valA = sumA[sortField as keyof typeof sumA] || 0;
      valB = sumB[sortField as keyof typeof sumB] || 0;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });



  const getCellBadgeClass = (status: string) => {
    switch (status) {
      case 'W': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
      case 'T': return 'bg-purple-700 text-white border-purple-800';
      case 'L': return 'bg-purple-100 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/30';
      case 'S': return 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/40';
      default: return 'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700 border-slate-200 dark:border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Attendance Module</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Track daily attendance, customize scheduling rules, and view summaries.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shadow-inner self-start">
          <button
            onClick={() => setActiveSubTab('table')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'table' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5" />
            Grid View
          </button>
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'calendar' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Calendar View
          </button>
        </div>
      </div>

      {/* Main Section */}
      {activeSubTab === 'table' && (
        <div className="space-y-6">
          {/* Header & Legends */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 glass-panel p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Custom Date Range & Excel Export */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search Name or ID..."
                value={attendanceSearchQuery}
                onChange={e => setAttendanceSearchQuery(e.target.value)}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500 w-48 transition-colors shadow-sm"
              />

              {/* From / To Date Filter for Attendance Grid */}
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[9px] font-bold">From:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="bg-transparent focus:outline-none text-xs font-medium"
                  />
                </div>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 uppercase text-[9px] font-bold">To:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="bg-transparent focus:outline-none text-xs font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-col items-end">
                <button
                  type="button"
                  disabled={hasValidationErrors}
                  onClick={() => exportAttendanceToExcel(assignments, profiles, projects, leaves, customStart, customEnd)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl shadow-sm transition-colors ${
                    hasValidationErrors
                      ? 'bg-red-50/20 text-red-400 border border-red-200 dark:border-red-950/30 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel
                </button>
                {hasValidationErrors && (
                  <span className="text-[9px] font-bold text-red-500 mt-1">
                    ❌ Resolve validation errors in Master Sheet
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 self-center uppercase text-[9px] font-bold">Statuses:</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 border border-blue-200">W: Work</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-700 text-white border border-purple-800">T: Travel</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/20 text-purple-700 border border-purple-200">L: Leave</span>
              <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/40 text-orange-600 border border-orange-200">S: Standby</span>
            </div>
          </div>

          {/* Excel Like Grid */}
          <div className="glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto select-none">
              <table className="w-full border-collapse border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 text-left sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 w-40 min-w-[160px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        Employee
                        <span className="text-[9px] opacity-70">{sortField === 'name' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 text-left sticky left-[160px] z-30 bg-slate-50 dark:bg-slate-900 w-30 min-w-[120px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('department')}>
                      <div className="flex items-center gap-1">
                        Department
                        <span className="text-[9px] opacity-70">{sortField === 'department' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 text-left sticky left-[280px] z-30 bg-slate-50 dark:bg-slate-900 w-30 min-w-[120px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('designation')}>
                      <div className="flex items-center gap-1">
                        Designation
                        <span className="text-[9px] opacity-70">{sortField === 'designation' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    {/* Summary columns */}
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-blue-600 dark:text-blue-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('w')}>
                      <div className="flex flex-col items-center">
                        <span>W</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'w' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('l')}>
                      <div className="flex flex-col items-center">
                        <span>L</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'l' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-purple-600 dark:text-purple-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('t')}>
                      <div className="flex flex-col items-center">
                        <span>T</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 't' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-orange-600 dark:text-orange-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('s')}>
                      <div className="flex flex-col items-center">
                        <span>S</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 's' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-brand-50 dark:bg-brand-950/20 border-r border-slate-200 dark:border-slate-800 w-16 text-brand-600 dark:text-brand-400 font-bold cursor-pointer select-none hover:bg-brand-100/50 dark:hover:bg-brand-900/30" onClick={() => handleSort('rate')}>
                      <div className="flex flex-col items-center">
                        <span>%</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'rate' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
 
                    {/* Timeline dates */}
                    {dates.map((d, i) => (
                      <th 
                        key={i} 
                        className={`py-3 w-8 min-w-[32px] text-center border-r border-slate-200 dark:border-slate-800 ${
                          d.dateStr === todayStr ? 'bg-brand-500 text-white font-bold' : (d.isWeekend ? 'bg-slate-100/60 dark:bg-slate-900/40' : '')
                        }`}
                      >
                        <div className="font-mono text-[10px]">{d.dayNum}</div>
                        <div className="text-[8px] font-normal uppercase text-slate-400 dark:text-slate-500">{d.dayLabel[0]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {sortedProfiles.length > 0 ? (
                    sortedProfiles.map((prof, empIdx) => {
                      const summary = getAttendanceSummary(prof);
                      return (
                        <tr key={empIdx} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors">
                          {/* Info columns */}
                          <td className="py-2.5 px-4 sticky left-0 z-20 bg-white dark:bg-slate-950 font-semibold text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{prof.name}</td>
                          <td className="py-2.5 px-4 sticky left-[160px] z-20 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{prof.department}</td>
                          <td className="py-2.5 px-4 sticky left-[280px] z-20 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{prof.designation}</td>
                          
                          {/* Summary numbers */}
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.w}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.l}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.t}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.s}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-brand-50/50 dark:bg-brand-950/10 text-brand-700 dark:text-brand-400 font-bold">{summary.rate}%</td>

                          {/* Attendance interactive cells */}
                          {dates.map((d, dIdx) => {
                            const currentVal = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles);
                            const isToday = d.dateStr === todayStr;
                            
                            return (
                              <td 
                                key={dIdx}
                                className={`w-8 min-w-[32px] p-0.5 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-[10px] ${
                                  d.isWeekend ? 'bg-slate-50/80 dark:bg-slate-900/10' : ''
                                } ${isToday ? 'outline-2 outline-brand-500 outline' : ''}`}
                                title={`Resolved status: ${currentVal || 'None'}`}
                              >
                                <div className={`w-full py-1 rounded border transition-colors ${getCellBadgeClass(currentVal)}`}>
                                  {currentVal || '-'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8 + dates.length} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        No employees found to mark attendance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 justify-end">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Attendance is automatically calculated based on project assignments and approved leave records.</span>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'calendar' && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left panel: Employee selection */}
          <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Select Employee</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {profiles.map(prof => (
                <button
                  key={prof.id}
                  onClick={() => setSelectedEmpId(prof.id)}
                  className={`w-full text-left p-3 rounded-xl border text-sm font-semibold transition-all ${
                    selectedEmpId === prof.id 
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-400 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold">{prof.name}</div>
                  <div className="text-xs font-normal text-slate-400 dark:text-slate-500 mt-0.5">ID: {prof.id} | {prof.department}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right panel: Calendar View */}
          <div className="md:col-span-2 glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Calendar: {selectedEmp?.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Mark schedules and view leaves for this employee</p>
              </div>
              
              {/* Month Selector inside calendar */}
              <div className="flex items-center gap-2">
                <button onClick={handlePrevMonth} className="p-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center min-w-[80px]">{displayMonthName}</span>
                <button onClick={handleNextMonth} className="p-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid 7 Columns for Days */}
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-xs font-bold text-slate-400 uppercase py-1">{d}</div>
              ))}

              {/* Offset cells for calendar start */}
              {(() => {
                const [y, m] = currentMonthStr.split('-');
                const firstDayIdx = new Date(parseInt(y), parseInt(m) - 1, 1).getDay();
                const offsets = [];
                for (let i = 0; i < firstDayIdx; i++) {
                  offsets.push(<div key={`offset-${i}`} className="p-4 bg-slate-50/40 dark:bg-slate-900/10 rounded-xl" />);
                }
                return offsets;
              })()}

              {dates.map((d, idx) => {
                const status = resolveStatusOnDate(selectedEmp.id, d.dateStr, assignments, projects, leaves, profiles) || '';
                const isToday = d.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    className={`p-3 border rounded-xl flex flex-col items-center justify-between h-20 bg-white dark:bg-slate-900 ${
                      isToday ? 'ring-2 ring-brand-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{d.dayNum}</span>
                    <span className={`w-8 py-1 rounded text-[10px] font-bold border ${getCellBadgeClass(status)}`}>
                      {status || '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
