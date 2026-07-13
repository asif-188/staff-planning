import type { Employee, LeaveRecord, ProjectAssignment, ProjectDetails } from '../hooks/usePlanningState';
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  getWeek, 
  isSameDay, 
  parseISO,
  parse,
  isValid
} from 'date-fns';

export interface TimelineDate {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // Mon, Tue, etc.
  dayNum: string; // 1, 2, 3...
  weekNum: number;
  monthLabel: string; // May 2026
  isWeekend: boolean;
}

export function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  const clean = dateStr.trim();
  
  // 1. Try ISO parser (e.g. YYYY-MM-DD)
  let d = parseISO(clean);
  if (isValid(d)) return d;

  // 2. Try dd-MM-yyyy
  d = parse(clean, 'dd-MM-yyyy', new Date());
  if (isValid(d)) return d;

  // 3. Try dd/MM/yyyy
  d = parse(clean, 'dd/MM/yyyy', new Date());
  if (isValid(d)) return d;

  // 4. Try yyyy/MM/dd
  d = parse(clean, 'yyyy/MM/dd', new Date());
  if (isValid(d)) return d;

  // Fallback
  const native = new Date(clean);
  if (isValid(native)) return native;

  return new Date(NaN);
}

export function normalizeDateString(dateStr: string): string {
  const d = safeParseDate(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, 'yyyy-MM-dd');
}

export function formatToClientDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = safeParseDate(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, 'dd-MM-yyyy');
}

export function getDatesForMonth(monthStr: string): TimelineDate[] {
  // monthStr: YYYY-MM
  const parts = monthStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const start = startOfMonth(new Date(year, month, 1));
  const end = endOfMonth(start);

  const days = eachDayOfInterval({ start, end });

  return days.map(day => {
    const dayOfWeek = day.getDay();
    return {
      dateStr: format(day, 'yyyy-MM-dd'),
      dayLabel: format(day, 'EEE'),
      dayNum: format(day, 'd'),
      weekNum: getWeek(day),
      monthLabel: format(day, 'MMMM yyyy'),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    };
  });
}

export function getDatesForInterval(startStr: string, endStr: string): TimelineDate[] {
  const start = safeParseDate(startStr);
  const end = safeParseDate(endStr);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [];
  }

  const days = eachDayOfInterval({ start, end });

  return days.map(day => {
    const dayOfWeek = day.getDay();
    return {
      dateStr: format(day, 'yyyy-MM-dd'),
      dayLabel: format(day, 'EEE'),
      dayNum: format(day, 'd'),
      weekNum: getWeek(day),
      monthLabel: format(day, 'MMMM yyyy'),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    };
  });
}

export function resolveStatusOnDate(
  employeeId: string,
  dateStr: string,
  assignments: ProjectAssignment[],
  projects: ProjectDetails[],
  leaves: LeaveRecord[]
): 'W' | 'T' | 'L' | 'S' | '' {
  if (!employeeId || !dateStr) return '';
  const date = safeParseDate(dateStr);
  if (isNaN(date.getTime())) return '';

  // 1. Check approved leave record first (Leave overrides active project assignment on those dates)
  const isApprovedLeave = (leaves || []).some(l => {
    if (l.employeeId !== employeeId || l.status !== 'Approved') return false;
    const from = safeParseDate(l.fromDate);
    const to = safeParseDate(l.toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return false;
    return date >= from && date <= to;
  });

  if (isApprovedLeave) {
    return 'L';
  }

  // 2. Check active assignment
  const empAssignments = assignments.filter(a => a.employeeId === employeeId);
  let activeAssignment: ProjectAssignment | null = null;
  let activeStart: Date | null = null;
  let activeEnd: Date | null = null;

  for (const a of empAssignments) {
    const foundProj = projects.find(p => p.name === a.projectName);
    const startStr = a.travelStartDate || foundProj?.startDate || '';
    const endStr = a.travelEndDate || foundProj?.endDate || '';
    if (startStr && endStr) {
      const start = safeParseDate(startStr);
      const end = safeParseDate(endStr);
      if (date >= start && date <= end) {
        activeAssignment = a;
        activeStart = start;
        activeEnd = end;
        break;
      }
    }
  }

  if (activeAssignment) {
    // First day and last day is 'T' (Travel)
    if (activeStart && activeEnd) {
      if (isSameDay(date, activeStart) || isSameDay(date, activeEnd)) {
        return 'T';
      }
    }
    return 'W';
  }

  // 3. Otherwise -> Standby
  return 'S';
}

export function getCellStatus(
  employee: Employee,
  dateStr: string,
  leaves: LeaveRecord[]
): 'W' | 'T' | 'L' | 'S' | '' {
  const assignments: ProjectAssignment[] = [{
    employeeId: employee.id,
    projectName: employee.project,
    travelStartDate: employee.travelStartDate,
    travelEndDate: employee.travelEndDate,
    status: employee.status || 'Working',
    remarks: employee.remarks
  }];
  const projects: ProjectDetails[] = [{
    name: employee.project,
    budgetCode: employee.budgetCode,
    startDate: employee.projectStartDate,
    endDate: employee.projectEndDate
  }];
  return resolveStatusOnDate(employee.id, dateStr, assignments, projects, leaves);
}
