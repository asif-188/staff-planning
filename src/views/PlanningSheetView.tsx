import { useState } from 'react';
import type { Employee, ManualLeave } from '../hooks/usePlanningState';
import { getDatesForInterval, getCellStatus } from '../utils/timelineHelper';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { exportPlanningGridToExcel } from '../utils/excelHelper';

interface PlanningSheetViewProps {
  employees: Employee[];
  manualLeaves: ManualLeave[];
}

export default function PlanningSheetView({ employees, manualLeaves }: PlanningSheetViewProps) {
  // Use May 1 to June 30, 2026 as default custom interval
  const [customStart, setCustomStart] = useState('2026-05-01');
  const [customEnd, setCustomEnd] = useState('2026-06-30');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  
  const dates = getDatesForInterval(customStart, customEnd);
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return emp.name.toLowerCase().includes(q) || 
           emp.id.toLowerCase().includes(q) || 
           emp.project.toLowerCase().includes(q);
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let valA = a[sortField as keyof Employee] || '';
    let valB = b[sortField as keyof Employee] || '';

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Dynamic Grouping of Months spanning the selected interval
  const months: { label: string; span: number }[] = [];
  dates.forEach(d => {
    const lastMonth = months[months.length - 1];
    if (lastMonth && lastMonth.label === d.monthLabel) {
      lastMonth.span += 1;
    } else {
      months.push({ label: d.monthLabel, span: 1 });
    }
  });

  // Group weeks for Header 2
  const weeks: { weekNum: number; span: number }[] = [];
  dates.forEach(d => {
    const lastWeek = weeks[weeks.length - 1];
    if (lastWeek && lastWeek.weekNum === d.weekNum) {
      lastWeek.span += 1;
    } else {
      weeks.push({ weekNum: d.weekNum, span: 1 });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'W':
        return 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
      case 'T':
        return 'bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40';
      case 'L':
        return 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60';
      case 'A':
        return 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40';
      case 'H':
        return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40';
      default:
        return 'bg-transparent text-transparent border-slate-100 dark:border-slate-800/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header with Date Selectors */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Planning Sheet</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Timeline schedule automatically generated from project start/end dates and leave allocations.
          </p>
        </div>

        {/* Custom Date Range Selectors & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search Name, ID or Project..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold focus:outline-none focus:border-brand-500 w-64 shadow-sm transition-colors"
          />

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs font-semibold uppercase">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 text-xs font-medium"
              />
            </div>
            
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
              <span className="text-slate-400 text-xs font-semibold uppercase">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 text-xs font-medium"
              />
            </div>
          </div>

          <button
            onClick={() => exportPlanningGridToExcel(filteredEmployees, manualLeaves, customStart, customEnd)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl shadow-sm text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-800">
        <span className="uppercase text-[10px] tracking-wider text-slate-400 font-bold self-center">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded flex items-center justify-center bg-blue-100 dark:bg-blue-950/40 text-blue-600 border border-blue-200 text-[10px] font-bold">W</span>
          <span>Working</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded flex items-center justify-center bg-purple-100 dark:bg-purple-950/40 text-purple-600 border border-purple-200 text-[10px] font-bold">T</span>
          <span>Travel</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 border border-zinc-200 text-[10px] font-bold">L</span>
          <span>Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 text-[10px] font-bold">H</span>
          <span>Holiday</span>
        </div>
      </div>

      {/* Excel Sheet Grid Container */}
      <div className="glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto select-none">
          <table className="w-full border-collapse border-spacing-0">
            <thead>
              {/* Row 1: Month Titles dynamically grouped */}
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
                <th colSpan={6} className="py-2.5 px-4 text-left border-r border-slate-200 dark:border-slate-800 sticky left-0 z-30 bg-slate-50 dark:bg-slate-900">
                  Staff Assignment Info
                </th>
                {months.map((m, i) => (
                  <th 
                    key={i} 
                    colSpan={m.span} 
                    className="py-2.5 text-center tracking-wider border-r border-slate-200 dark:border-slate-800 bg-brand-50/50 dark:bg-brand-950/20 text-brand-700 dark:text-brand-300 border-b"
                  >
                    {m.label.toUpperCase()}
                  </th>
                ))}
              </tr>

              {/* Row 2: Weeks Header */}
              <tr className="bg-slate-100/50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                <th colSpan={6} className="px-4 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-30 bg-slate-50 dark:bg-slate-900" />
                {weeks.map((wk, i) => (
                  <th 
                    key={i} 
                    colSpan={wk.span} 
                    className="py-1 border-r border-slate-200 dark:border-slate-800 text-center font-mono bg-slate-100 dark:bg-slate-900"
                  >
                    Week {wk.weekNum}
                  </th>
                ))}
              </tr>

              {/* Row 3: Day Label Header (Mon, Tue) */}
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <th colSpan={6} className="px-4 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-30 bg-slate-50 dark:bg-slate-900" />
                {dates.map((d, i) => (
                  <th 
                    key={i} 
                    className={`py-1 w-9 min-w-[36px] text-center border-r border-slate-200 dark:border-slate-800 ${d.isWeekend ? 'bg-slate-100/60 dark:bg-slate-900/40 text-slate-400' : ''}`}
                  >
                    {d.dayLabel[0]}
                  </th>
                ))}
              </tr>

              {/* Row 4: Dates Header (1, 2, 3...) */}
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <th className="py-2.5 px-4 text-left sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 w-40 min-w-[160px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    Employee Name
                    <span className="text-[9px] opacity-70">{sortField === 'name' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-left sticky left-[160px] z-30 bg-slate-50 dark:bg-slate-900 w-32 min-w-[128px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('department')}>
                  <div className="flex items-center gap-1">
                    Department
                    <span className="text-[9px] opacity-70">{sortField === 'department' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-left sticky left-[288px] z-30 bg-slate-50 dark:bg-slate-900 w-32 min-w-[128px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('function')}>
                  <div className="flex items-center gap-1">
                    Function
                    <span className="text-[9px] opacity-70">{sortField === 'function' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-left sticky left-[416px] z-30 bg-slate-50 dark:bg-slate-900 w-36 min-w-[144px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('project')}>
                  <div className="flex items-center gap-1">
                    Project
                    <span className="text-[9px] opacity-70">{sortField === 'project' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center sticky left-[560px] z-30 bg-slate-50 dark:bg-slate-900 w-24 min-w-[96px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('projectStartDate')}>
                  <div className="flex items-center justify-center gap-1">
                    Proj Start
                    <span className="text-[9px] opacity-70">{sortField === 'projectStartDate' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                <th className="py-2.5 px-4 text-center sticky left-[656px] z-30 bg-slate-50 dark:bg-slate-900 w-24 min-w-[96px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('projectEndDate')}>
                  <div className="flex items-center justify-center gap-1">
                    Proj End
                    <span className="text-[9px] opacity-70">{sortField === 'projectEndDate' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                  </div>
                </th>
                {dates.map((d, i) => {
                  const isToday = d.dateStr === todayStr;
                  return (
                    <th 
                      key={i} 
                      className={`py-2 w-9 min-w-[36px] text-center border-r border-slate-200 dark:border-slate-800 font-mono ${
                        isToday ? 'bg-brand-500 text-white font-bold' : (d.isWeekend ? 'bg-slate-100/60 dark:bg-slate-900/40' : '')
                      }`}
                    >
                      {d.dayNum}
                    </th>
                  );
                })}
              </tr>
            </thead>
            
            {/* Body */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {sortedEmployees.length > 0 ? (
                sortedEmployees.map((emp, empIdx) => (
                  <tr 
                    key={empIdx}
                    className="hover:bg-slate-100/30 dark:hover:bg-slate-900/10 transition-colors"
                  >
                    {/* Sticky left info columns */}
                    <td className="py-3 px-4 sticky left-0 z-20 bg-white dark:bg-slate-950 font-semibold text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.name}</td>
                    <td className="py-3 px-4 sticky left-[160px] z-20 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.department}</td>
                    <td className="py-3 px-4 sticky left-[288px] z-20 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.function}</td>
                    <td className="py-3 px-4 sticky left-[416px] z-20 bg-white dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.project}</td>
                    <td className="py-3 px-4 text-center sticky left-[560px] z-20 bg-white dark:bg-slate-950 font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.projectStartDate}</td>
                    <td className="py-3 px-4 text-center sticky left-[656px] z-20 bg-white dark:bg-slate-950 font-mono text-[11px] text-slate-500 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{emp.projectEndDate}</td>

                    {/* Timeline Cell Mapping */}
                    {dates.map((d, dateIdx) => {
                      const status = getCellStatus(emp, d.dateStr, manualLeaves);
                      return (
                        <td 
                          key={dateIdx}
                          className={`w-9 min-w-[36px] p-0.5 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-xs ${
                            d.isWeekend ? 'bg-slate-50/80 dark:bg-slate-900/10' : ''
                          }`}
                        >
                          <div className={`w-full py-1.5 rounded border transition-all duration-200 text-xs font-bold ${getStatusColor(status)}`}>
                            {status || '-'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6 + dates.length} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No matching assignments or employees found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
