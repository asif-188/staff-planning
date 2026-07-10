import type { Employee, ManualLeave } from '../hooks/usePlanningState';
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

export function getCellStatus(
  employee: Employee,
  dateStr: string,
  manualLeaves: ManualLeave[]
): 'W' | 'T' | 'L' | '' {
  const start = safeParseDate(employee.travelStartDate || employee.projectStartDate);
  const end = safeParseDate(employee.travelEndDate || employee.projectEndDate);
  const date = safeParseDate(dateStr);

  // Outside the travel range
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || date < start || date > end) {
    return '';
  }

  // 1. Check manual leaves first (manual leaves override assignment status)
  const hasManualLeave = manualLeaves.some(
    l => l.employeeId === employee.id && l.date === dateStr
  );
  if (hasManualLeave) {
    return 'L';
  }

  // 2. Map based on assignment status
  if (employee.status === 'Leave') {
    return 'L';
  }

  if (employee.status === 'Travelling') {
    return 'T';
  }

  // If status is 'Working': First day (travel start) and Last day (travel end) are Travel (T)
  if (isSameDay(date, start) || isSameDay(date, end)) {
    return 'T';
  }

  // Otherwise Working (W)
  return 'W';
}
