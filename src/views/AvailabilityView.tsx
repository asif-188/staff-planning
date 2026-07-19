import { useState } from 'react';
import type { Employee, EmployeeProfile, ProjectAssignment, ProjectDetails, AttendanceRecord, LeaveRecord } from '../hooks/usePlanningState';
import { format, eachDayOfInterval, differenceInDays } from 'date-fns';
import { Search, UserX, AlertCircle, Download } from 'lucide-react';
import { exportAvailabilityReportToExcel } from '../utils/excelHelper';
import { safeParseDate, resolveStatusOnDate, formatToClientDate } from '../utils/timelineHelper';

interface AvailabilityViewProps {
  profiles: EmployeeProfile[];
  assignments: ProjectAssignment[];
  projects: ProjectDetails[];
  attendance: AttendanceRecord;
  leaves: LeaveRecord[];
}

export default function AvailabilityView({ profiles, assignments, projects, attendance, leaves }: AvailabilityViewProps) {
  // Query Form State
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
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
  const designations = Array.from(new Set(profiles.map(p => p.designation)));

  // Availability Logic: Find free employees
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const getAvailableStaff = () => {
    if (!hasSearched) return [];

    const isRangeQueried = startDateStr && endDateStr;
    const searchStart = isRangeQueried ? safeParseDate(startDateStr) : null;
    const searchEnd = isRangeQueried ? safeParseDate(endDateStr) : null;
    
    if (isRangeQueried && (isNaN(searchStart!.getTime()) || isNaN(searchEnd!.getTime()) || searchStart! > searchEnd!)) {
      return [];
    }

    const availableStaffList: {
      employee: Employee;
      freeRange: { startStr: string; endStr: string; daysCount: number };
      totalFreeDays: number;
      occupiedDetails: string;
      workingDetails: string;
      leaveDetails: string;
      todayStatus: 'W' | 'T' | 'L' | 'S';
      todayStatusLabel: string;
      periodOccupancies: string[];
    }[] = [];

    profiles.forEach(prof => {
      // Find all assignments for this employee
      const empAssignments = assignments.filter(a => a.employeeId === prof.id);

      // Filter by department/function if requested
      if (deptFilter && prof.department !== deptFilter) return;
      if (funcFilter && prof.designation !== funcFilter) return;

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const todayStatus = resolveStatusOnDate(prof.id, todayStr, assignments, projects, leaves, profiles) || 'S';
      
      let todayStatusLabel = 'Standby';
      if (todayStatus === 'W') {
        const activeAssToday = empAssignments.find(a => {
          const proj = projects.find(p => p.name === a.projectName);
          const start = a.travelStartDate || proj?.startDate || '';
          const end = a.travelEndDate || proj?.endDate || '';
          return todayStr >= start && todayStr <= end;
        });
        todayStatusLabel = activeAssToday ? `Working (${activeAssToday.projectName})` : 'Working';
      } else if (todayStatus === 'T') {
        const activeAssToday = empAssignments.find(a => {
          const proj = projects.find(p => p.name === a.projectName);
          const start = a.travelStartDate || proj?.startDate || '';
          const end = a.travelEndDate || proj?.endDate || '';
          return todayStr >= start && todayStr <= end;
        });
        todayStatusLabel = activeAssToday ? `Travelling (${activeAssToday.projectName})` : 'Travelling';
      } else if (todayStatus === 'L') {
        todayStatusLabel = 'On Leave';
      }

      if (!isRangeQueried) {
        // No date range requested: show all assignments and leaves for the employee
        const workingList: string[] = [];
        empAssignments.forEach(assign => {
          if (!assign.projectName) return;
          const proj = projects.find(p => p.name === assign.projectName);
          const start = assign.travelStartDate || proj?.startDate || '';
          const end = assign.travelEndDate || proj?.endDate || '';
          workingList.push(`${assign.projectName} (ID: ${proj?.budgetCode || 'N/A'}) [${formatToClientDate(start)} to ${formatToClientDate(end)}]`);
        });
        const workingDetailsVal = workingList.join('; ') || 'None';

        const leaveList: string[] = [];
        leaves.forEach(l => {
          if (l.employeeId !== prof.id) return;
          const proj = projects.find(p => p.name === l.projectId);
          const projPart = l.projectId && l.projectId !== 'None' ? ` for ${l.projectId} (ID: ${proj?.budgetCode || 'N/A'})` : '';
          leaveList.push(`On Leave${projPart} [${formatToClientDate(l.fromDate)} to ${formatToClientDate(l.toDate)}]`);
        });
        const leaveDetailsVal = leaveList.join('; ') || 'None';

        const empObj: Employee = {
          id: prof.id,
          name: prof.name,
          department: prof.department,
          designation: prof.designation,
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
          freeRange: { startStr: '-', endStr: '-', daysCount: 0 },
          totalFreeDays: 0,
          occupiedDetails: `Today: ${todayStatusLabel}`,
          workingDetails: workingDetailsVal,
          leaveDetails: leaveDetailsVal,
          todayStatus,
          todayStatusLabel,
          periodOccupancies: []
        });
        return;
      }

      // Range is queried: run day-by-day search range logic
      const days = eachDayOfInterval({ start: searchStart!, end: searchEnd! });
      const freeDays: Date[] = [];
      const occupiedProjects = new Set<string>();

      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');

        // A: Check status from planning grid using resolved status
        const status = resolveStatusOnDate(prof.id, dayStr, assignments, projects, leaves, profiles);

        // B: Check attendance override codes
        const attCode = attendance[`${prof.id}_${dayStr}`];
        const isUnavailableAtt = attCode === 'L' || attCode === 'T';

        if (status === 'W' || status === 'T' || status === 'L' || isUnavailableAtt) {
          if (status === 'W' || status === 'T') {
            const activeAss = empAssignments.find(assign => {
              const projDetails = projects.find(p => p.name === assign.projectName);
              const startStr = assign.travelStartDate || projDetails?.startDate || '';
              const endStr = assign.travelEndDate || projDetails?.endDate || '';
              return dayStr >= startStr && dayStr <= endStr;
            });
            occupiedProjects.add(activeAss?.projectName || 'Project Allocation');
          } else if (status === 'L') {
            occupiedProjects.add('On Leave');
          }
          if (isUnavailableAtt) {
            occupiedProjects.add('Attendance override');
          }
        } else {
          freeDays.push(day);
        }
      });

      if (freeDays.length > 0) {
        // Group freeDays into contiguous ranges
        const sortedDays = [...freeDays].sort((a, b) => a.getTime() - b.getTime());
        const ranges: { startStr: string; endStr: string; daysCount: number }[] = [];
        
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
              const count = differenceInDays(currentEnd, currentStart) + 1;
              ranges.push({
                startStr: format(currentStart, 'dd-MM-yyyy'),
                endStr: format(currentEnd, 'dd-MM-yyyy'),
                daysCount: count
              });
              currentStart = curr;
              currentEnd = curr;
            }
          }
          const count = differenceInDays(currentEnd, currentStart) + 1;
          ranges.push({
            startStr: format(currentStart, 'dd-MM-yyyy'),
            endStr: format(currentEnd, 'dd-MM-yyyy'),
            daysCount: count
          });
        }

        const periodOccupancies: string[] = [];
        empAssignments.forEach(assign => {
          if (!assign.projectName) return;
          const proj = projects.find(p => p.name === assign.projectName);
          const start = assign.travelStartDate || proj?.startDate || '';
          const end = assign.travelEndDate || proj?.endDate || '';
          if (!(end < startDateStr || start > endDateStr)) {
            const statusPrefix = assign.status === 'Travelling' ? 'Travelling for' : 'Working on';
            periodOccupancies.push(`${statusPrefix}: ${assign.projectName} (${formatToClientDate(start)} to ${formatToClientDate(end)})`);
          }
        });

        leaves.forEach(l => {
          if (l.employeeId !== prof.id) return;
          const start = l.fromDate;
          const end = l.toDate;
          if (!(end < startDateStr || start > endDateStr)) {
            periodOccupancies.push(`On Leave (${formatToClientDate(start)} to ${formatToClientDate(end)})`);
          }
        });

        const getStartDateOfOcc = (occStr: string) => {
          const match = occStr.match(/\((\d{2}-\d{2}-\d{4})/);
          if (match) {
            const parts = match[1].split('-');
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
          }
          return 0;
        };
        periodOccupancies.sort((a, b) => getStartDateOfOcc(a) - getStartDateOfOcc(b));

        let occupiedText = `Today: ${todayStatusLabel}`;
        // Compute working details
        const workingList: string[] = [];
        empAssignments.forEach(assign => {
          if (!assign.projectName) return;
          const proj = projects.find(p => p.name === assign.projectName);
          const start = assign.travelStartDate || proj?.startDate || '';
          const end = assign.travelEndDate || proj?.endDate || '';
          if (!(end < startDateStr || start > endDateStr)) {
            workingList.push(`${assign.projectName} (ID: ${proj?.budgetCode || 'N/A'}) [${formatToClientDate(start)} to ${formatToClientDate(end)}]`);
          }
        });
        const workingDetailsVal = workingList.join('; ') || 'None';

        // Compute leave details
        const leaveList: string[] = [];
        leaves.forEach(l => {
          if (l.employeeId !== prof.id) return;
          const start = l.fromDate;
          const end = l.toDate;
          if (!(end < startDateStr || start > endDateStr)) {
            const proj = projects.find(p => p.name === l.projectId);
            const projPart = l.projectId && l.projectId !== 'None' ? ` for ${l.projectId} (ID: ${proj?.budgetCode || 'N/A'})` : '';
            leaveList.push(`On Leave${projPart} [${formatToClientDate(start)} to ${formatToClientDate(end)}]`);
          }
        });
        const leaveDetailsVal = leaveList.join('; ') || 'None';

        const empObj: Employee = {
          id: prof.id,
          name: prof.name,
          department: prof.department,
          designation: prof.designation,
          project: empAssignments.map(a => a.projectName).filter(Boolean).join(', ') || 'Unassigned',
          budgetCode: '',
          projectStartDate: '',
          projectEndDate: '',
          travelStartDate: '',
          travelEndDate: '',
          status: empAssignments[0]?.status || 'Working',
          remarks: ''
        };

        ranges.forEach(r => {
          availableStaffList.push({
            employee: empObj,
            freeRange: r,
            totalFreeDays: r.daysCount,
            occupiedDetails: occupiedText,
            workingDetails: workingDetailsVal,
            leaveDetails: leaveDetailsVal,
            todayStatus,
            todayStatusLabel,
            periodOccupancies
          });
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
      } else if (sortField === 'designation') {
        valA = a.employee.designation;
        valB = b.employee.designation;
      } else if (sortField === 'totalFreeDays') {
        valA = a.totalFreeDays;
        valB = b.totalFreeDays;
      } else if (sortField === 'occupiedDetails') {
        valA = a.occupiedDetails;
        valB = b.occupiedDetails;
      } else {
        // default: allocated first, then free days descending
        const aAllocated = a.occupiedDetails !== 'Standby' ? 1 : 0;
        const bAllocated = b.occupiedDetails !== 'Standby' ? 1 : 0;
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
    const matchesProjOrCode = assignments.filter(a => a.employeeId === res.employee.id).some(a => {
      const proj = projects.find(p => p.name === a.projectName);
      return a.projectName.toLowerCase().includes(q) || (proj?.budgetCode || '').toLowerCase().includes(q);
    });
    return res.employee.name.toLowerCase().includes(q) || 
           res.employee.id.toLowerCase().includes(q) || 
           res.employee.department.toLowerCase().includes(q) ||
           matchesProjOrCode;
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
              value={startDateStr}
              onChange={e => setStartDateStr(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">End Date</label>
            <input
              type="date"
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
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Designation</label>
            <select
              value={funcFilter}
              onChange={e => setFuncFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors cursor-pointer"
            >
              <option value="">All Designations</option>
              {designations.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="flex gap-2 w-full">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md transition-all duration-200 cursor-pointer text-sm"
            >
              <Search className="w-4 h-4" />
              Find Staff
            </button>
            {(startDateStr || endDateStr) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateStr('');
                  setEndDateStr('');
                }}
                className="flex items-center justify-center px-3 py-2 bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all duration-200 cursor-pointer border border-slate-300 dark:border-slate-700 text-xs"
                title="Clear dates"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results List */}
      {hasSearched ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Matching Standby Staff ({filteredResults.length})</h3>
              <p className="text-xs text-slate-500">Query window: {startDateStr && endDateStr ? `${startDateStr} to ${endDateStr}` : 'All Time'}</p>
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
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('designation')}>
                      <div className="flex items-center gap-1">
                        Designation
                        <span className="text-[10px] opacity-70">{sortField === 'designation' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 select-none">Available Periods (in Range)</th>
                    <th className="py-3.5 px-6 cursor-pointer select-none hover:text-slate-800 dark:hover:text-slate-100 transition-colors" onClick={() => handleSort('totalFreeDays')}>
                      <div className="flex items-center gap-1">
                        Total Standby Days
                        <span className="text-[10px] opacity-70">{sortField === 'totalFreeDays' ? (sortAsc ? '▲' : '▼') : '↕'}</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-6 select-none text-xs font-semibold uppercase tracking-wider">Working Details</th>
                    <th className="py-3.5 px-6 select-none text-xs font-semibold uppercase tracking-wider">Leave Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {filteredResults.length > 0 ? (
                    filteredResults.map((res, index) => (
                      <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                        <td className="py-3.5 px-6 font-mono font-medium text-slate-600 dark:text-slate-400">{res.employee.id}</td>
                        <td className="py-3.5 px-6 font-bold text-slate-800 dark:text-white">{res.employee.name}</td>
                        <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{res.employee.department}</td>
                        <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{res.employee.designation}</td>
                        <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/20 w-fit">
                            {res.freeRange.startStr} to {res.freeRange.endStr}
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-blue-600 dark:text-blue-400 font-bold font-mono">{res.totalFreeDays} Days</td>
                        <td className="py-3.5 px-6 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                          {res.workingDetails}
                        </td>
                        <td className="py-3.5 px-6 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                          {res.leaveDetails}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
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
