import { useState } from 'react';
import type { Employee, EmployeeProfile, ProjectAssignment, ProjectDetails, AttendanceRecord, ManualLeave } from '../hooks/usePlanningState';
import { format, eachDayOfInterval } from 'date-fns';
import { Search, UserX, AlertCircle, Download } from 'lucide-react';
import { exportAvailabilityReportToExcel } from '../utils/excelHelper';
import { getCellStatus, safeParseDate } from '../utils/timelineHelper';

interface AvailabilityViewProps {
  profiles: EmployeeProfile[];
  assignments: ProjectAssignment[];
  projects: ProjectDetails[];
  attendance: AttendanceRecord;
  manualLeaves: ManualLeave[];
}

export default function AvailabilityView({ profiles, assignments, projects, attendance, manualLeaves }: AvailabilityViewProps) {
  // Query Form State
  const [startDateStr, setStartDateStr] = useState('2026-05-01');
  const [endDateStr, setEndDateStr] = useState('2026-05-15');
  const [deptFilter, setDeptFilter] = useState('');
  const [funcFilter, setFuncFilter] = useState('');
  
  const [hasSearched, setHasSearched] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('allocated');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const departments = Array.from(new Set(profiles.map(p => p.department)));
  const functions = Array.from(new Set(profiles.map(p => p.function)));

  // Availability Logic: Find free employees
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const getAvailableStaff = () => {
    if (!hasSearched) return [];

    const searchStart = safeParseDate(startDateStr);
    const searchEnd = safeParseDate(endDateStr);
    
    if (isNaN(searchStart.getTime()) || isNaN(searchEnd.getTime()) || searchStart > searchEnd) {
      return [];
    }

    const availableStaffList: {
      employee: Employee;
      freeRanges: { startStr: string; endStr: string }[];
      totalFreeDays: number;
      occupiedDetails: string;
    }[] = [];

    profiles.forEach(prof => {
      // Find all assignments for this employee
      const empAssignments = assignments.filter(a => a.employeeId === prof.id);

      // Filter by department/function if requested
      if (deptFilter && prof.department !== deptFilter) return;
      if (funcFilter && prof.function !== funcFilter) return;

      const days = eachDayOfInterval({ start: searchStart, end: searchEnd });
      const freeDays: Date[] = [];
      const occupiedProjects = new Set<string>();

      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');

        // A: Check status from planning grid (getCellStatus)
        let dayProject = '';
        const isOccupied = empAssignments.some(assign => {
          const projDetails = projects.find(p => p.name === assign.projectName);
          const empObj: Employee = {
            id: prof.id,
            name: prof.name,
            department: prof.department,
            function: prof.function,
            project: assign.projectName,
            budgetCode: projDetails?.budgetCode || '',
            projectStartDate: projDetails?.startDate || '',
            projectEndDate: projDetails?.endDate || '',
            travelStartDate: assign.travelStartDate,
            travelEndDate: assign.travelEndDate,
            status: assign.status,
            remarks: assign.remarks
          };
          const status = getCellStatus(empObj, dayStr, []);
          const matched = status === 'W' || status === 'T' || status === 'L';
          if (matched) {
            dayProject = assign.projectName || 'On Leave/Travelling';
          }
          return matched;
        });

        // B: Check manual leaves override
        const hasLeave = manualLeaves.some(l => l.employeeId === prof.id && l.date === dayStr);

        // C: Check attendance override codes
        const attCode = attendance[`${prof.id}_${dayStr}`];
        const isUnavailableAtt = attCode === 'L' || attCode === 'T' || attCode === 'A';

        if (isOccupied || hasLeave || isUnavailableAtt) {
          if (dayProject) occupiedProjects.add(dayProject);
          if (hasLeave) occupiedProjects.add('On Leave');
          if (isUnavailableAtt) occupiedProjects.add('Attendance override');
        } else {
          freeDays.push(day);
        }
      });

      // If they have ANY free days in this search window, we include them!
      if (freeDays.length > 0) {
        // Group freeDays into contiguous ranges
        const sortedDays = [...freeDays].sort((a, b) => a.getTime() - b.getTime());
        const ranges: { startStr: string; endStr: string }[] = [];
        
        if (sortedDays.length > 0) {
          let currentStart = sortedDays[0];
          let currentEnd = sortedDays[0];

          for (let i = 1; i < sortedDays.length; i++) {
            const prev = sortedDays[i - 1];
            const curr = sortedDays[i];
            const diffTime = curr.getTime() - prev.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 1) {
              currentEnd = curr;
            } else {
              ranges.push({
                startStr: format(currentStart, 'dd-MM-yyyy'),
                endStr: format(currentEnd, 'dd-MM-yyyy')
              });
              currentStart = curr;
              currentEnd = curr;
            }
          }
          ranges.push({
            startStr: format(currentStart, 'dd-MM-yyyy'),
            endStr: format(currentEnd, 'dd-MM-yyyy')
          });
        }

        const allocations = empAssignments.map(assign => {
          if (!assign.projectName) return null;
          const label = assign.projectName;
          const start = assign.travelStartDate;
          const end = assign.travelEndDate;
          if (start && end) {
            return `${label} (${start} to ${end})`;
          }
          return label;
        }).filter(Boolean);

        const occupiedText = allocations.length > 0
          ? `Busy on: ${allocations.join(', ')}`
          : 'Fully Free';

        const empObj: Employee = {
          id: prof.id,
          name: prof.name,
          department: prof.department,
          function: prof.function,
          project: empAssignments.map(a => a.projectName).filter(Boolean).join(', ') || 'Unassigned',
          budgetCode: '',
          projectStartDate: '',
          projectEndDate: '',
          travelStartDate: '',
          travelEndDate: '',
          status: empAssignments[0]?.status || 'Working',
          remarks: ''
        };

        availableStaffList.push({
          employee: empObj,
          freeRanges: ranges,
          totalFreeDays: freeDays.length,
          occupiedDetails: occupiedText
        });
      }
    });

    // Sort: show employees based on sortField and sortAsc
    return availableStaffList.sort((a, b) => {
      let valA: any;
      let valB: any;

      if (sortField === 'id') {
        valA = a.employee.id;
        valB = b.employee.id;
      } else if (sortField === 'name') {
        valA = a.employee.name;
        valB = b.employee.name;
      } else if (sortField === 'department') {
        valA = a.employee.department;
        valB = b.employee.department;
      } else if (sortField === 'function') {
        valA = a.employee.function;
        valB = b.employee.function;
      } else if (sortField === 'totalFreeDays') {
        valA = a.totalFreeDays;
        valB = b.totalFreeDays;
      } else if (sortField === 'occupiedDetails') {
        valA = a.occupiedDetails;
        valB = b.occupiedDetails;
      } else {
        // default: allocated first, then free days descending
        const aAllocated = a.occupiedDetails !== 'Fully Free' ? 1 : 0;
        const bAllocated = b.occupiedDetails !== 'Fully Free' ? 1 : 0;
        if (aAllocated !== bAllocated) {
          return bAllocated - aAllocated;
        }
        return b.totalFreeDays - a.totalFreeDays;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  };

  const results = getAvailableStaff();
  const filteredResults = results.filter(res => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return res.employee.name.toLowerCase().includes(q) || res.employee.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Availability Finder</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Search and match available personnel for new project requirements without calendar scheduling conflicts.
        </p>
      </div>

      {/* Query panel */}
      <div className="glass-panel p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
            <input
              type="date"
              required
              value={startDateStr}
              onChange={e => setStartDateStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
            <input
              type="date"
              required
              value={endDateStr}
              onChange={e => setEndDateStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Function</label>
            <select
              value={funcFilter}
              onChange={e => setFuncFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">All Functions</option>
              {functions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button
            type="submit"
            className="flex items-center justify-center gap-2 w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md transition-all duration-200 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            Find Staff
          </button>
        </form>
      </div>

      {/* Results List */}
      {hasSearched ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Matching Free Staff ({filteredResults.length})</h3>
              <p className="text-xs text-slate-500">Query window: {startDateStr} to {endDateStr}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search Name or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500 w-52 transition-colors shadow-sm"
              />
              {filteredResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportAvailabilityReportToExcel(filteredResults, startDateStr, endDateStr)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to Excel
                </button>
              )}
            </div>
          </div>

          <div className="glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('id')}>
                      <div className="flex items-center gap-1">
                        Employee ID
                        <span className="text-[10px] opacity-70">{sortField === 'id' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        Name
                        <span className="text-[10px] opacity-70">{sortField === 'name' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('department')}>
                      <div className="flex items-center gap-1">
                        Department
                        <span className="text-[10px] opacity-70">{sortField === 'department' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('function')}>
                      <div className="flex items-center gap-1">
                        Function
                        <span className="text-[10px] opacity-70">{sortField === 'function' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 select-none">Available Periods (in Range)</th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('totalFreeDays')}>
                      <div className="flex items-center gap-1">
                        Total Free Days
                        <span className="text-[10px] opacity-70">{sortField === 'totalFreeDays' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('occupiedDetails')}>
                      <div className="flex items-center gap-1">
                        Allocation Details / Status
                        <span className="text-[10px] opacity-70">{sortField === 'occupiedDetails' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredResults.length > 0 ? (
                    filteredResults.map((res, index) => (
                      <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="py-3.5 px-6 font-mono font-medium text-slate-600 dark:text-slate-400">{res.employee.id}</td>
                        <td className="py-3.5 px-6 font-bold text-slate-800 dark:text-white">{res.employee.name}</td>
                        <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{res.employee.department}</td>
                        <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{res.employee.function}</td>
                        <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex flex-col gap-1">
                            {res.freeRanges.map((r, rIdx) => (
                              <span key={rIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/20 w-fit">
                                {r.startStr} to {r.endStr}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-blue-600 dark:text-blue-400 font-bold font-mono">{res.totalFreeDays} Days</td>
                        <td className="py-3.5 px-6">
                          <span className={`text-xs font-medium ${res.occupiedDetails === 'Fully Free' ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                            {res.occupiedDetails}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        <div className="flex flex-col items-center gap-2 justify-center py-4">
                          <UserX className="w-8 h-8 text-slate-400" />
                          <span>No staff available during this specific period. Try adjusting filters or dates.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto text-brand-500/80 mb-3 animate-pulse" />
          <h4 className="text-base font-bold text-slate-700 dark:text-slate-200">No Query Executed</h4>
          <p className="text-xs mt-1 max-w-sm mx-auto">
            Fill in the start/end dates and filters above and click "Find Staff" to run conflicts validation.
          </p>
        </div>
      )}
    </div>
  );
}
