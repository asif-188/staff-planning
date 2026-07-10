import { useState } from 'react';
import type { Employee, EmployeeProfile, AttendanceRecord, ManualLeave } from '../hooks/usePlanningState';
import { getDatesForMonth, getCellStatus } from '../utils/timelineHelper';
import { format } from 'date-fns';
import { 
  CalendarDays, 
  TableProperties, 
  UserCheck, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  Download
} from 'lucide-react';
import { exportAttendanceToExcel } from '../utils/excelHelper';

interface AttendanceViewProps {
  employees: Employee[];
  profiles: EmployeeProfile[];
  attendance: AttendanceRecord;
  manualLeaves: ManualLeave[];
  setSingleAttendance: (employeeId: string, date: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => void;
  setBulkAttendance: (employeeId: string, startDateStr: string, endDateStr: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => void;
}

export default function AttendanceView({
  employees,
  profiles,
  attendance,
  setSingleAttendance,
  setBulkAttendance
}: AttendanceViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'table' | 'calendar' | 'bulk'>('table');
  const [currentMonthStr, setCurrentMonthStr] = useState('2026-05');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  
  const dates = getDatesForMonth(currentMonthStr);
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

  // Bulk Attendance State
  const [bulkEmpId, setBulkEmpId] = useState<string>('ALL');
  const [bulkStart, setBulkStart] = useState<string>('2026-05-01');
  const [bulkEnd, setBulkEnd] = useState<string>('2026-05-31');
  const [bulkStatus, setBulkStatus] = useState<'W' | 'L' | 'T' | 'A' | 'H' | 'HD'>('W');
  const [bulkSuccess, setBulkSuccess] = useState(false);

  // Searchable select states inside AttendanceView
  const [empSearch, setEmpSearch] = useState('ALL - All Employees');
  const [isEmpOpen, setIsEmpOpen] = useState(false);
  const [activeEmpIdx, setActiveEmpIdx] = useState(0);

  // Autocomplete filtering with show-all on focus (exact match override)
  const options = [
    { id: 'ALL', name: 'All Employees', project: 'All Departments' },
    ...profiles.map(p => ({
      id: p.id,
      name: p.name,
      project: p.department
    }))
  ];
  const isEmpExactMatch = options.some(e => `${e.id} - ${e.name}` === empSearch);
  const filteredEmployees = options.filter(e => {
    if (isEmpExactMatch) return true;
    if (!empSearch) return true;
    return (
      e.name.toLowerCase().includes(empSearch.toLowerCase()) || 
      e.id.toLowerCase().includes(empSearch.toLowerCase()) ||
      e.project.toLowerCase().includes(empSearch.toLowerCase())
    );
  });

  // Keyboard navigation arrow keys handlers
  const handleEmpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEmpOpen) {
      if (e.key === 'ArrowDown') {
        setIsEmpOpen(true);
        setActiveEmpIdx(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveEmpIdx(prev => (prev + 1) % Math.max(filteredEmployees.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveEmpIdx(prev => (prev - 1 + filteredEmployees.length) % Math.max(filteredEmployees.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredEmployees[activeEmpIdx];
      if (selected) {
        setBulkEmpId(selected.id);
        setEmpSearch(`${selected.id} - ${selected.name}`);
        setIsEmpOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsEmpOpen(false);
    }
  };

  // Month navigation logic
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

  // Toggle/cycle through values on click: W -> T -> L -> A -> H -> HD -> W
  const cycleAttendance = (employeeId: string, dateStr: string, currentVal: string) => {
    const order: ('W' | 'T' | 'L' | 'A' | 'H' | 'HD')[] = ['W', 'T', 'L', 'A', 'H', 'HD'];
    const currentIdx = order.indexOf(currentVal as any);
    const nextVal = order[(currentIdx + 1) % order.length];
    setSingleAttendance(employeeId, dateStr, nextVal);
  };

  // Calculate attendance summaries for Table View
  const getAttendanceSummary = (prof: EmployeeProfile) => {
    let w = 0, l = 0, t = 0, a = 0, h = 0, hd = 0;
    dates.forEach(d => {
      const planStatus = (() => {
        const empAssignments = employees.filter(e => e.id === prof.id);
        for (const assign of empAssignments) {
          const status = getCellStatus(assign, d.dateStr, []);
          if (status) return status;
        }
        return '';
      })();
      const status = attendance[`${prof.id}_${d.dateStr}`] || planStatus;

      if (status === 'W') w++;
      else if (status === 'L') l++;
      else if (status === 'T') t++;
      else if (status === 'A') a++;
      else if (status === 'H') h++;
      else if (status === 'HD') hd++;
    });

    const activeDays = w + t + hd * 0.5;
    const totalScheduled = w + t + l + a + hd + h;
    const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

    return { w, l, t, a, h, hd, rate };
  };

  const filteredProfiles = profiles.filter(prof => {
    const q = attendanceSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return prof.name.toLowerCase().includes(q) || 
           prof.id.toLowerCase().includes(q) || 
           prof.department.toLowerCase().includes(q) ||
           prof.function.toLowerCase().includes(q);
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
    } else if (sortField === 'function') {
      valA = a.function;
      valB = b.function;
    } else {
      // w, t, l, a, h, hd, rate
      const sumA = getAttendanceSummary(a);
      const sumB = getAttendanceSummary(b);
      valA = sumA[sortField as keyof typeof sumA] || 0;
      valB = sumB[sortField as keyof typeof sumB] || 0;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  // Handle Bulk submit
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkEmpId || !bulkStart || !bulkEnd) {
      alert("All fields are required");
      return;
    }
    setBulkAttendance(bulkEmpId, bulkStart, bulkEnd, bulkStatus);
    setBulkSuccess(true);
    setTimeout(() => setBulkSuccess(false), 3000);
  };

  const getCellBadgeClass = (status: string) => {
    switch (status) {
      case 'W': return 'bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40';
      case 'T': return 'bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40';
      case 'L': return 'bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/60';
      case 'A': return 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40';
      case 'H': return 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40';
      case 'HD': return 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40';
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
          <button
            onClick={() => setActiveSubTab('bulk')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeSubTab === 'bulk' 
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Bulk Update
          </button>
        </div>
      </div>

      {/* Main Section */}
      {activeSubTab === 'table' && (
        <div className="space-y-6">
          {/* Header & Legends */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 glass-panel p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Month Navigation & Excel Export */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search Name or ID..."
                value={attendanceSearchQuery}
                onChange={e => setAttendanceSearchQuery(e.target.value)}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500 w-48 transition-colors shadow-sm"
              />

              <div className="flex items-center gap-2">
                <button onClick={handlePrevMonth} className="p-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[100px] text-center">{displayMonthName}</span>
                <button onClick={handleNextMonth} className="p-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => exportAttendanceToExcel(sortedProfiles, employees, attendance, dates, currentMonthStr, displayMonthName)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer animate-in fade-in"
              >
                <Download className="w-3.5 h-3.5" />
                Export Excel
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 self-center uppercase text-[9px] font-bold">Statuses:</span>
              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 border border-blue-200">W: Work</span>
              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-600 border border-purple-200">T: Travel</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 border border-zinc-200">L: Leave</span>
              <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 border border-red-200">A: Absent</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200">H: Holiday</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 border border-amber-200">HD: Half Day</span>
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
                    <th className="py-3 px-4 text-left sticky left-[280px] z-30 bg-slate-50 dark:bg-slate-900 w-30 min-w-[120px] border-r border-slate-200 dark:border-slate-800 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-200" onClick={() => handleSort('function')}>
                      <div className="flex items-center gap-1">
                        Function
                        <span className="text-[9px] opacity-70">{sortField === 'function' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    {/* Summary columns */}
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-blue-600 dark:text-blue-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('w')}>
                      <div className="flex flex-col items-center">
                        <span>W</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'w' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-purple-600 dark:text-purple-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('t')}>
                      <div className="flex flex-col items-center">
                        <span>T</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 't' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-zinc-500 dark:text-zinc-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('l')}>
                      <div className="flex flex-col items-center">
                        <span>L</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'l' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-red-600 dark:text-red-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('a')}>
                      <div className="flex flex-col items-center">
                        <span>A</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'a' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-emerald-600 dark:text-emerald-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('h')}>
                      <div className="flex flex-col items-center">
                        <span>H</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'h' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 w-12 text-amber-600 dark:text-amber-400 cursor-pointer select-none hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('hd')}>
                      <div className="flex flex-col items-center">
                        <span>HD</span>
                        <span className="text-[8px] opacity-60 font-normal">{sortField === 'hd' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
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
                          <td className="py-2.5 px-4 sticky left-[280px] z-20 bg-white dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">{prof.function}</td>
                          
                          {/* Summary numbers */}
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.w}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.t}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.l}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.a}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.h}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold">{summary.hd}</td>
                          <td className="py-2.5 text-center font-mono border-r border-slate-200 dark:border-slate-800 bg-brand-50/50 dark:bg-brand-950/10 text-brand-700 dark:text-brand-400 font-bold">{summary.rate}%</td>

                          {/* Attendance interactive cells */}
                          {dates.map((d, dIdx) => {
                            const planStatus = (() => {
                              const empAssignments = employees.filter(e => e.id === prof.id);
                              for (const assign of empAssignments) {
                                const status = getCellStatus(assign, d.dateStr, []);
                                if (status) return status;
                              }
                              return '';
                            })();
                            const currentVal = attendance[`${prof.id}_${d.dateStr}`] || planStatus || '';
                            const isToday = d.dateStr === todayStr;
                            
                            return (
                              <td 
                                key={dIdx}
                                onClick={() => cycleAttendance(prof.id, d.dateStr, currentVal)}
                                className={`w-8 min-w-[32px] p-0.5 border-r border-slate-200 dark:border-slate-800/80 text-center font-mono font-bold text-[10px] cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/50 ${
                                  d.isWeekend ? 'bg-slate-50/80 dark:bg-slate-900/10' : ''
                                } ${isToday ? 'outline-2 outline-brand-500 outline' : ''}`}
                                title={`Click to change. Current: ${currentVal || 'None'}`}
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
                      <td colSpan={10 + dates.length} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        No employees found to mark attendance.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 justify-end">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Tip: Single click on cells to quickly cycle through attendance codes (W &rarr; T &rarr; L &rarr; A &rarr; H &rarr; HD)</span>
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
                const planStatus = (() => {
                  if (!selectedEmp) return '';
                  const empAssignments = employees.filter(e => e.id === selectedEmp.id);
                  for (const assign of empAssignments) {
                    const status = getCellStatus(assign, d.dateStr, []);
                    if (status) return status;
                  }
                  return '';
                })();
                const status = attendance[`${selectedEmp?.id}_${d.dateStr}`] || planStatus || '';
                const isToday = d.dateStr === todayStr;

                return (
                  <button
                    key={idx}
                    onClick={() => cycleAttendance(selectedEmp.id, d.dateStr, status)}
                    className={`p-3 border rounded-xl hover:scale-[1.03] transition-all flex flex-col items-center justify-between h-20 bg-white dark:bg-slate-900 hover:shadow-md ${
                      isToday ? 'ring-2 ring-brand-500' : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{d.dayNum}</span>
                    <span className={`w-8 py-1 rounded text-[10px] font-bold border ${getCellBadgeClass(status)}`}>
                      {status || '-'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'bulk' && (
        <div className="glass-panel p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-xl mx-auto space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500 animate-pulse" />
              Bulk Mark Attendance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Mark attendance for a specific employee across a custom date range in a single step.
            </p>
          </div>

          {bulkSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex items-center gap-2 text-sm">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
              <span>Bulk attendance marked successfully! Check the Grid View to verify.</span>
            </div>
          )}

          <form onSubmit={handleBulkSubmit} className="space-y-4 text-sm">
            {/* Select Employee */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Employee ID / Name</label>
              <input
                type="text"
                value={empSearch}
                placeholder="Type name or ID to search..."
                onFocus={() => {
                  setIsEmpOpen(true);
                  setActiveEmpIdx(0);
                }}
                onBlur={() => setTimeout(() => setIsEmpOpen(false), 250)}
                onKeyDown={handleEmpKeyDown}
                onChange={e => {
                  setEmpSearch(e.target.value);
                  setIsEmpOpen(true);
                  setActiveEmpIdx(0);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-500"
              />
              {isEmpOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-xl">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((e, idx) => {
                      const isSelected = idx === activeEmpIdx;
                      return (
                        <div
                          key={e.id}
                          onClick={() => {
                            setBulkEmpId(e.id);
                            setEmpSearch(`${e.id} - ${e.name}`);
                            setIsEmpOpen(false);
                          }}
                          className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                            isSelected 
                              ? 'bg-brand-600 text-white font-bold dark:bg-brand-700' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className={isSelected ? 'text-white' : 'font-semibold text-slate-900 dark:text-white'}>{e.id}</span> - {e.name} <span className={`text-xs ${isSelected ? 'text-brand-200' : 'text-slate-400'}`}>({e.project})</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">No matching employees found</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                <input
                  type="date"
                  required
                  value={bulkStart}
                  onChange={e => setBulkStart(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
                <input
                  type="date"
                  required
                  value={bulkEnd}
                  onChange={e => setBulkEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Attendance Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Attendance Status Code</label>
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="W">W: Working</option>
                <option value="L">L: Leave</option>
                <option value="T">T: Travel</option>
                <option value="A">A: Absent</option>
                <option value="H">H: Holiday</option>
                <option value="HD">HD: Half Day</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md transition-colors"
            >
              Apply Bulk Marking
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
