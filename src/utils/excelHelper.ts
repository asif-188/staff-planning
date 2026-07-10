import ExcelJS from 'exceljs';
import type { Employee, AttendanceRecord, ManualLeave, EmployeeProfile, ProjectDetails } from '../hooks/usePlanningState';
import { getDatesForMonth, getCellStatus, getDatesForInterval } from './timelineHelper';
import { format } from 'date-fns';

// Helper to get color code fill for Planning and Attendance cells
const getStatusFill = (status: string) => {
  switch (status) {
    case 'W':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE6F1' } }; // Light Blue
    case 'L':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E4E4E7' } }; // Gray
    case 'T':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } }; // Light Purple
    case 'A':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } }; // Light Red
    case 'H':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Light Green
    case 'HD':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } }; // Light Yellow
    default:
      return null;
  }
};

const getStatusFontColor = (status: string) => {
  switch (status) {
    case 'W': return '1E40AF'; // Dark Blue
    case 'L': return '3F3F46'; // Dark Gray
    case 'T': return '6B21A8'; // Dark Purple
    case 'A': return '991B1B'; // Dark Red
    case 'H': return '166534'; // Dark Green
    case 'HD': return '854D0E'; // Dark Yellow
    default: return '000000';
  }
};

export async function exportToExcel(
  employees: Employee[],
  attendance: AttendanceRecord,
  manualLeaves: ManualLeave[],
  currentMonth: string // YYYY-MM
) {
  const workbook = new ExcelJS.Workbook();
  const dates = getDatesForMonth(currentMonth);

  // ==========================================
  // 1. MASTER SHEET TABS
  // ==========================================
  const masterSheet = workbook.addWorksheet('Master Sheet');
  masterSheet.columns = [
    { header: 'Employee ID', key: 'id', width: 15 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Function', key: 'function', width: 20 },
    { header: 'Project', key: 'project', width: 20 },
    { header: 'Budget Code', key: 'budgetCode', width: 18 },
    { header: 'Project Start Date', key: 'projectStartDate', width: 18 },
    { header: 'Project End Date', key: 'projectEndDate', width: 18 },
    { header: 'Travel Start Date', key: 'travelStartDate', width: 18 },
    { header: 'Travel End Date', key: 'travelEndDate', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];

  // Stylize master headers
  masterSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  masterSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };

  employees.forEach(emp => {
    masterSheet.addRow(emp);
  });

  // ==========================================
  // 2. PLANNING SHEET TAB
  // ==========================================
  const planningSheet = workbook.addWorksheet('Planning Sheet');
  
  // Row 1: Month name merged
  // Row 2: Week numbers
  // Row 3: Day labels (Mon, Tue...)
  // Row 4: Dates (1, 2, 3...)
  // Row 5+: Data rows
  const timelineStartCol = 7; // After Name, Dept, Function, Project, Start, End

  const rowMonth = planningSheet.getRow(1);
  const rowWeek = planningSheet.getRow(2);
  const rowDay = planningSheet.getRow(3);
  const rowDate = planningSheet.getRow(4);

  // Write static headers
  const staticHeaders = ['Employee Name', 'Department', 'Function', 'Project', 'Project Start', 'Project End'];
  staticHeaders.forEach((h, idx) => {
    const cell = planningSheet.getCell(1, idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    planningSheet.mergeCells(1, idx + 1, 4, idx + 1);
  });

  // Write timeline headers
  dates.forEach((d, idx) => {
    const colIdx = timelineStartCol + idx;
    
    // Month
    rowMonth.getCell(colIdx).value = d.monthLabel;
    
    // Week
    rowWeek.getCell(colIdx).value = `Wk ${d.weekNum}`;
    
    // Day Label
    rowDay.getCell(colIdx).value = d.dayLabel;
    
    // Date Num
    rowDate.getCell(colIdx).value = parseInt(d.dayNum, 10);
  });

  // Merge months dynamically
  let monthStart = timelineStartCol;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].monthLabel !== dates[i - 1].monthLabel) {
      if (monthStart < timelineStartCol + i - 1) {
        planningSheet.mergeCells(1, monthStart, 1, timelineStartCol + i - 1);
      }
      monthStart = timelineStartCol + i;
    }
  }

  // Merge weeks dynamically
  let weekStart = timelineStartCol;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].weekNum !== dates[i - 1].weekNum) {
      if (weekStart < timelineStartCol + i - 1) {
        planningSheet.mergeCells(2, weekStart, 2, timelineStartCol + i - 1);
      }
      weekStart = timelineStartCol + i;
    }
  }

  // Set timeline header styling
  for (let r = 1; r <= 4; r++) {
    const row = planningSheet.getRow(r);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.font = { bold: true, size: 9 };
  }

  // Set column widths for timeline
  for (let i = 0; i < dates.length; i++) {
    const col = planningSheet.getColumn(timelineStartCol + i);
    col.width = 4.5;
  }
  // Base columns width
  for (let i = 1; i < timelineStartCol; i++) {
    planningSheet.getColumn(i).width = 18;
  }

  // Write rows
  employees.forEach((emp, empIdx) => {
    const rowIdx = 5 + empIdx;
    const row = planningSheet.getRow(rowIdx);
    
    row.getCell(1).value = emp.name;
    row.getCell(2).value = emp.department;
    row.getCell(3).value = emp.function;
    row.getCell(4).value = emp.project;
    row.getCell(5).value = emp.projectStartDate;
    row.getCell(6).value = emp.projectEndDate;

    dates.forEach((d, dIdx) => {
      const colIdx = timelineStartCol + dIdx;
      const cell = row.getCell(colIdx);
      const status = getCellStatus(emp, d.dateStr, manualLeaves);
      cell.value = status;
      cell.alignment = { horizontal: 'center' };
      
      const fill = getStatusFill(status);
      if (fill) {
        cell.fill = fill as any;
        cell.font = { bold: true, color: { argb: getStatusFontColor(status) }, size: 9 };
      }
    });
  });

  // Freeze Panes for Planning Sheet (Sticky Columns & Rows)
  planningSheet.views = [
    { state: 'frozen', xSplit: 6, ySplit: 4 }
  ];

  // ==========================================
  // 3. ATTENDANCE SHEET TAB
  // ==========================================
  const attSheet = workbook.addWorksheet('Attendance Sheet');
  
  // Attendance headers
  const attStaticCols = ['Employee Name', 'Department', 'Function', 'Project'];
  attStaticCols.forEach((h, idx) => {
    attSheet.getCell(3, idx + 1).value = h;
    attSheet.getCell(3, idx + 1).font = { bold: true };
    attSheet.mergeCells(1, idx + 1, 3, idx + 1);
  });

  dates.forEach((d, idx) => {
    const colIdx = 5 + idx;
    attSheet.getCell(1, colIdx).value = d.monthLabel;
    attSheet.getCell(2, colIdx).value = d.dayLabel;
    attSheet.getCell(3, colIdx).value = parseInt(d.dayNum, 10);
  });

  // Merge months for attendance
  let attMonthStart = 5;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].monthLabel !== dates[i - 1].monthLabel) {
      if (attMonthStart < 5 + i - 1) {
        attSheet.mergeCells(1, attMonthStart, 1, 5 + i - 1);
      }
      attMonthStart = 5 + i;
    }
  }

  // Style headers
  for (let r = 1; r <= 3; r++) {
    const row = attSheet.getRow(r);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.font = { bold: true, size: 9 };
  }

  for (let i = 0; i < dates.length; i++) {
    attSheet.getColumn(5 + i).width = 4.5;
  }
  for (let i = 1; i <= 4; i++) {
    attSheet.getColumn(i).width = 18;
  }

  employees.forEach((emp, empIdx) => {
    const rowIdx = 4 + empIdx;
    const row = attSheet.getRow(rowIdx);
    row.getCell(1).value = emp.name;
    row.getCell(2).value = emp.department;
    row.getCell(3).value = emp.function;
    row.getCell(4).value = emp.project;

    dates.forEach((d, dIdx) => {
      const colIdx = 5 + dIdx;
      const cell = row.getCell(colIdx);
      // Fallback to auto planning status if no manual attendance marked
      const planStatus = getCellStatus(emp, d.dateStr, manualLeaves);
      const attStatus = attendance[`${emp.id}_${d.dateStr}`] || planStatus || '';
      
      cell.value = attStatus;
      cell.alignment = { horizontal: 'center' };
      
      const fill = getStatusFill(attStatus);
      if (fill) {
        cell.fill = fill as any;
        cell.font = { bold: true, color: { argb: getStatusFontColor(attStatus) }, size: 9 };
      }
    });
  });

  attSheet.views = [
    { state: 'frozen', xSplit: 4, ySplit: 3 }
  ];

  // ==========================================
  // 4. SUMMARY REPORT TAB
  // ==========================================
  const summarySheet = workbook.addWorksheet('Summary Report');
  summarySheet.columns = [
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Function', key: 'function', width: 20 },
    { header: 'Working Days', key: 'working', width: 15 },
    { header: 'Leave Days', key: 'leave', width: 15 },
    { header: 'Travel Days', key: 'travel', width: 15 },
    { header: 'Absent Days', key: 'absent', width: 15 },
    { header: 'Holiday', key: 'holiday', width: 15 },
    { header: 'Half Day', key: 'halfday', width: 15 },
    { header: 'Attendance %', key: 'attendanceRate', width: 18 }
  ];

  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F172A' } // Dark Slate
  };

  employees.forEach(emp => {
    let working = 0, leave = 0, travel = 0, absent = 0, holiday = 0, halfday = 0;
    
    dates.forEach(d => {
      const planStatus = getCellStatus(emp, d.dateStr, manualLeaves);
      const status = attendance[`${emp.id}_${d.dateStr}`] || planStatus;
      
      if (status === 'W') working++;
      else if (status === 'L') leave++;
      else if (status === 'T') travel++;
      else if (status === 'A') absent++;
      else if (status === 'H') holiday++;
      else if (status === 'HD') halfday++;
    });

    const activeDays = working + travel + halfday * 0.5;
    const totalScheduled = working + travel + leave + absent + halfday + holiday;
    const rate = totalScheduled > 0 ? (activeDays / totalScheduled) * 100 : 100;

    summarySheet.addRow({
      name: emp.name,
      department: emp.department,
      function: emp.function,
      working,
      leave,
      travel,
      absent,
      holiday,
      halfday,
      attendanceRate: `${rate.toFixed(1)}%`
    });
  });

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Staff_Planning_Report_${currentMonth}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Excel JS Import Parser
export async function importFromExcel(file: File): Promise<Employee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        // Find the sheet (look for 'Master' or get the first sheet)
        let sheet = workbook.worksheets.find(w => w.name.toLowerCase().includes('master'));
        if (!sheet) {
          sheet = workbook.worksheets[0];
        }

        if (!sheet) {
          reject(new Error("No sheet found in Excel workbook"));
          return;
        }

        const employees: Employee[] = [];
        
        // Parse columns dynamically to map them
        const headerRow = sheet.getRow(1);
        const colIndices: { [key: string]: number } = {};
        
        headerRow.eachCell((cell, colNumber) => {
          const value = cell.value?.toString().toLowerCase().trim() || '';
          if (value.includes('id')) colIndices.id = colNumber;
          else if (value.includes('name')) colIndices.name = colNumber;
          else if (value.includes('dept') || value.includes('department')) colIndices.department = colNumber;
          else if (value.includes('func') || value.includes('role')) colIndices.function = colNumber;
          else if (value.includes('project')) colIndices.project = colNumber;
          else if (value.includes('budget')) colIndices.budgetCode = colNumber;
          else if (value.includes('start') && !value.includes('travel')) colIndices.projectStartDate = colNumber;
          else if (value.includes('end') && !value.includes('travel')) colIndices.projectEndDate = colNumber;
          else if (value.includes('travel') && value.includes('start')) colIndices.travelStartDate = colNumber;
          else if (value.includes('travel') && value.includes('end')) colIndices.travelEndDate = colNumber;
          else if (value.includes('status')) colIndices.status = colNumber;
          else if (value.includes('remark')) colIndices.remarks = colNumber;
        });

        // Use default columns fallback if headers not matching
        const idCol = colIndices.id || 1;
        const nameCol = colIndices.name || 2;
        const deptCol = colIndices.department || 3;
        const funcCol = colIndices.function || 4;
        const projCol = colIndices.project || 5;
        const budgetCol = colIndices.budgetCode || 6;
        const startCol = colIndices.projectStartDate || 7;
        const endCol = colIndices.projectEndDate || 8;
        const travelStartCol = colIndices.travelStartDate || 9;
        const travelEndCol = colIndices.travelEndDate || 10;
        const statusCol = colIndices.status || 11;
        const remarkCol = colIndices.remarks || 12;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const idVal = row.getCell(idCol).value?.toString().trim();
          const nameVal = row.getCell(nameCol).value?.toString().trim();
          if (!idVal || !nameVal) return; // Skip empty rows

          const getVal = (col: number) => {
            const v = row.getCell(col).value;
            if (v instanceof Date) {
              return v.toISOString().split('T')[0];
            }
            if (v && typeof v === 'object' && 'result' in v) {
              return v.result?.toString() || '';
            }
            return v?.toString().trim() || '';
          };

          const parseDate = (val: string) => {
            if (!val) return '';
            try {
              // Handle Excel serial date numbers or text
              const d = new Date(val);
              if (isNaN(d.getTime())) return val;
              return d.toISOString().split('T')[0];
            } catch {
              return val;
            }
          };

          const projStart = parseDate(getVal(startCol));
          const projEnd = parseDate(getVal(endCol));
          const travelStart = parseDate(getVal(travelStartCol)) || projStart;
          const travelEnd = parseDate(getVal(travelEndCol)) || projEnd;
          let statusVal = getVal(statusCol) as any;
          if (!['Active', 'On Leave', 'Travelling', 'Available'].includes(statusVal)) {
            statusVal = 'Active';
          }

          employees.push({
            id: idVal,
            name: nameVal,
            department: getVal(deptCol) || 'Operations',
            function: getVal(funcCol) || 'Staff',
            project: getVal(projCol) || 'Internal',
            budgetCode: getVal(budgetCol) || 'BC-GENERAL',
            projectStartDate: projStart || format(new Date(), 'yyyy-MM-dd'),
            projectEndDate: projEnd || format(new Date(), 'yyyy-MM-dd'),
            travelStartDate: travelStart,
            travelEndDate: travelEnd,
            status: statusVal,
            remarks: getVal(remarkCol) || ''
          });
        });

        resolve(employees);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

export async function exportAvailabilityReportToExcel(
  results: {
    employee: Employee;
    freeRanges: { startStr: string; endStr: string }[];
    totalFreeDays: number;
    occupiedDetails: string;
  }[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Availability Report');

  // Title block
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Availability Finder Report (Period: ${startDate} to ${endDate})`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  sheet.addRow([]);

  // Table headers
  sheet.addRow([
    'Employee ID',
    'Employee Name',
    'Department',
    'Function',
    'Available Periods (in Range)',
    'Total Free Days',
    'Allocation Status / Details'
  ]);
  
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 25;

  // Set widths
  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 40;
  sheet.getColumn(6).width = 18;
  sheet.getColumn(7).width = 35;

  results.forEach(res => {
    const rangeText = res.freeRanges.map(r => `${r.startStr} to ${r.endStr}`).join(', ');
    sheet.addRow([
      res.employee.id,
      res.employee.name,
      res.employee.department,
      res.employee.function,
      rangeText,
      `${res.totalFreeDays} Days`,
      res.occupiedDetails
    ]);
  });

  // Highlight cells
  for (let r = 4; r <= results.length + 3; r++) {
    const row = sheet.getRow(r);
    row.getCell(5).font = { color: { argb: '166534' }, bold: true }; // Green text
    row.getCell(6).font = { color: { argb: '1E40AF' }, bold: true }; // Blue text
    row.getCell(7).font = { color: { argb: '475569' } };
  }

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Availability_Report_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportAttendanceToExcel(
  profiles: EmployeeProfile[],
  employees: Employee[],
  attendance: AttendanceRecord,
  dates: { dateStr: string; dayNum: string; dayLabel: string; isWeekend: boolean }[],
  monthStr: string,
  displayMonthName: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');

  const totalCols = 11 + dates.length;
  const getColLetter = (colIndex: number) => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      const modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };
  const lastColLetter = getColLetter(totalCols);

  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Attendance Report (Month: ${displayMonthName})`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  sheet.addRow([]);

  const baseHeaders = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Function',
    'W',
    'T',
    'L',
    'A',
    'H',
    'HD',
    '%'
  ];
  const dateHeaders = dates.map(d => `${d.dayNum}\n${d.dayLabel[0]}`);
  sheet.addRow([...baseHeaders, ...dateHeaders]);
  
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 9 };
  headerRow.height = 28;
  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  const statusCounts = dates.map(() => ({ W: 0, T: 0, L: 0, A: 0, H: 0, HD: 0 }));

  profiles.forEach((prof) => {
    let w = 0, l = 0, t = 0, a = 0, h = 0, hd = 0;
    const dailyStatusVals: string[] = [];

    dates.forEach((d, dIdx) => {
      const planStatus = (() => {
        const empAssignments = employees.filter(e => e.id === prof.id);
        for (const assign of empAssignments) {
          if (!assign.travelStartDate || !assign.travelEndDate) continue;
          const start = new Date(assign.travelStartDate);
          const end = new Date(assign.travelEndDate);
          const current = new Date(d.dateStr);
          if (current >= start && current <= end) {
            if (assign.status === 'Leave') return 'L';
            if (assign.status === 'Travelling') return 'T';
            if (assign.status === 'Working') {
              if (d.dateStr === assign.travelStartDate || d.dateStr === assign.travelEndDate) {
                return 'T';
              }
              return 'W';
            }
          }
        }
        return '';
      })();
      const status = attendance[`${prof.id}_${d.dateStr}`] || planStatus || '';
      dailyStatusVals.push(status);

      if (status === 'W') { w++; statusCounts[dIdx].W++; }
      else if (status === 'L') { l++; statusCounts[dIdx].L++; }
      else if (status === 'T') { t++; statusCounts[dIdx].T++; }
      else if (status === 'A') { a++; statusCounts[dIdx].A++; }
      else if (status === 'H') { h++; statusCounts[dIdx].H++; }
      else if (status === 'HD') { hd++; statusCounts[dIdx].HD++; }
    });

    const activeDays = w + t + hd * 0.5;
    const totalScheduled = w + t + l + a + hd + h;
    const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

    sheet.addRow([
      prof.id,
      prof.name,
      prof.department,
      prof.function,
      w,
      t,
      l,
      a,
      h,
      hd,
      `${rate}%`,
      ...dailyStatusVals
    ]);
  });

  // Add summary rows at the bottom
  sheet.addRow([]);

  const summaryKeys: { key: 'W' | 'T' | 'L' | 'A' | 'H' | 'HD'; label: string }[] = [
    { key: 'W', label: 'Total Working (W)' },
    { key: 'T', label: 'Total Travel (T)' },
    { key: 'L', label: 'Total Leave (L)' },
    { key: 'A', label: 'Total Absent (A)' },
    { key: 'H', label: 'Total Holiday (H)' },
    { key: 'HD', label: 'Total Half Day (HD)' }
  ];

  summaryKeys.forEach(({ key, label }) => {
    const rowValues = [
      label,
      '', // Name
      '', // Department
      '', // Function
      '', // W
      '', // T
      '', // L
      '', // A
      '', // H
      '', // HD
      '', // %
      ...statusCounts.map(c => c[key] || 0)
    ];
    const row = sheet.addRow(rowValues);
    row.font = { bold: true, size: 9 };
    row.getCell(1).alignment = { horizontal: 'left' };
    
    // Merge first 11 columns for the label to look cleaner
    sheet.mergeCells(row.number, 1, row.number, 11);
    
    for (let c = 12; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' } // Slate-100
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    }
  });

  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 6;
  sheet.getColumn(6).width = 6;
  sheet.getColumn(7).width = 6;
  sheet.getColumn(8).width = 6;
  sheet.getColumn(9).width = 6;
  sheet.getColumn(10).width = 6;
  sheet.getColumn(11).width = 8;
  
  for (let c = 12; c <= totalCols; c++) {
    sheet.getColumn(c).width = 5;
  }

  for (let r = 4; r <= profiles.length + 3; r++) {
    const row = sheet.getRow(r);
    row.height = 22;
    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: c <= 4 ? 'left' : 'center' };
      
      if (c >= 12) {
        const val = cell.value?.toString();
        if (val === 'W') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
          cell.font = { color: { argb: '1E40AF' }, bold: true, size: 9 };
        } else if (val === 'T') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } };
          cell.font = { color: { argb: '6B21A8' }, bold: true, size: 9 };
        } else if (val === 'L') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F4F4F5' } };
          cell.font = { color: { argb: '71717A' }, bold: true, size: 9 };
        } else if (val === 'A') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
          cell.font = { color: { argb: '991B1B' }, bold: true, size: 9 };
        } else if (val === 'H') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
          cell.font = { color: { argb: '065F46' }, bold: true, size: 9 };
        } else if (val === 'HD') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
          cell.font = { color: { argb: '92400E' }, bold: true, size: 9 };
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Report_${monthStr}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function importProjectsFromExcel(file: File): Promise<ProjectDetails[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        let sheet = workbook.worksheets[0];
        if (!sheet) {
          reject(new Error("No sheet found in Excel workbook"));
          return;
        }

        const projectsList: ProjectDetails[] = [];
        const headerRow = sheet.getRow(1);
        const colIndices: { [key: string]: number } = {};

        headerRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().toLowerCase().trim() || '';
          if (val.includes('project') || val === 'name' || val.includes('project name')) colIndices.name = colNum;
          else if (val.includes('budget') || val.includes('code')) colIndices.budgetCode = colNum;
          else if (val.includes('start')) colIndices.startDate = colNum;
          else if (val.includes('end')) colIndices.endDate = colNum;
        });

        const nameCol = colIndices.name || 1;
        const budgetCol = colIndices.budgetCode || 2;
        const startCol = colIndices.startDate || 3;
        const endCol = colIndices.endDate || 4;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const nameVal = row.getCell(nameCol).value?.toString().trim();
          if (!nameVal) return;

          const getVal = (col: number) => {
            const v = row.getCell(col).value;
            if (v instanceof Date) {
              return v.toISOString().split('T')[0];
            }
            return v?.toString().trim() || '';
          };

          projectsList.push({
            name: nameVal,
            budgetCode: getVal(budgetCol) || 'BC-GEN',
            startDate: getVal(startCol) || format(new Date(), 'yyyy-MM-dd'),
            endDate: getVal(endCol) || format(new Date(), 'yyyy-MM-dd')
          });
        });

        resolve(projectsList);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

export async function importEmployeesFromExcel(file: File): Promise<EmployeeProfile[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        let sheet = workbook.worksheets[0];
        if (!sheet) {
          reject(new Error("No sheet found in Excel workbook"));
          return;
        }

        const profilesList: EmployeeProfile[] = [];
        const headerRow = sheet.getRow(1);
        const colIndices: { [key: string]: number } = {};

        headerRow.eachCell((cell, colNum) => {
          const val = cell.value?.toString().toLowerCase().trim() || '';
          if (val.includes('id') || val.includes('employee id')) colIndices.id = colNum;
          else if (val.includes('name') || val.includes('employee name')) colIndices.name = colNum;
          else if (val.includes('dept') || val.includes('department')) colIndices.department = colNum;
          else if (val.includes('func') || val.includes('role') || val.includes('function')) colIndices.function = colNum;
        });

        const idCol = colIndices.id || 1;
        const nameCol = colIndices.name || 2;
        const deptCol = colIndices.department || 3;
        const funcCol = colIndices.function || 4;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const idVal = row.getCell(idCol).value?.toString().trim();
          const nameVal = row.getCell(nameCol).value?.toString().trim();
          if (!idVal || !nameVal) return;

          profilesList.push({
            id: idVal.toUpperCase(),
            name: nameVal,
            department: row.getCell(deptCol).value?.toString().trim() || 'Operations',
            function: row.getCell(funcCol).value?.toString().trim() || 'Staff'
          });
        });

        resolve(profilesList);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

export async function downloadExcelTemplate(headers: string[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Template');
  
  sheet.addRow(headers);
  
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 25;

  headers.forEach((h, idx) => {
    sheet.getColumn(idx + 1).width = Math.max(h.length + 5, 15);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportPlanningGridToExcel(
  employees: Employee[],
  manualLeaves: ManualLeave[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const planningSheet = workbook.addWorksheet('Planning Grid');
  
  const dates = getDatesForInterval(startDate, endDate);
  const timelineStartCol = 12; // Columns 1-6: details, 7-11: summary counts (W, T, L, H, A)

  const rowMonth = planningSheet.getRow(1);
  const rowWeek = planningSheet.getRow(2);
  const rowDay = planningSheet.getRow(3);
  const rowDate = planningSheet.getRow(4);

  // Write static headers
  const staticHeaders = ['Employee Name', 'Department', 'Function', 'Project', 'Travel Start', 'Travel End', 'W', 'T', 'L', 'H', 'A'];
  staticHeaders.forEach((h, idx) => {
    const cell = planningSheet.getCell(1, idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F46E5' } // Indigo
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    planningSheet.mergeCells(1, idx + 1, 4, idx + 1);
  });

  // Write timeline headers
  dates.forEach((d, idx) => {
    const colIdx = timelineStartCol + idx;
    
    // Month
    rowMonth.getCell(colIdx).value = d.monthLabel;
    
    // Week
    rowWeek.getCell(colIdx).value = `Wk ${d.weekNum}`;
    
    // Day Label
    rowDay.getCell(colIdx).value = d.dayLabel;
    
    // Date Num
    rowDate.getCell(colIdx).value = parseInt(d.dayNum, 10);
  });

  // Merge months dynamically
  let monthStart = timelineStartCol;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].monthLabel !== dates[i - 1].monthLabel) {
      if (monthStart < timelineStartCol + i - 1) {
        planningSheet.mergeCells(1, monthStart, 1, timelineStartCol + i - 1);
      }
      monthStart = timelineStartCol + i;
    }
  }

  // Merge weeks dynamically
  let weekStart = timelineStartCol;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].weekNum !== dates[i - 1].weekNum) {
      if (weekStart < timelineStartCol + i - 1) {
        planningSheet.mergeCells(2, weekStart, 2, timelineStartCol + i - 1);
      }
      weekStart = timelineStartCol + i;
    }
  }

  // Styles
  for (let r = 1; r <= 4; r++) {
    const row = planningSheet.getRow(r);
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.font = { bold: true, size: 9 };
    for (let c = timelineStartCol; c < timelineStartCol + dates.length; c++) {
      const cell = row.getCell(c);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F1F5F9' } // Slate-100
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    }
  }

  // Set widths
  for (let i = 0; i < dates.length; i++) {
    planningSheet.getColumn(timelineStartCol + i).width = 4.5;
  }
  for (let i = 1; i <= 6; i++) {
    planningSheet.getColumn(i).width = 18;
  }
  for (let i = 7; i <= 11; i++) {
    planningSheet.getColumn(i).width = 6;
  }

  // Write data rows
  employees.forEach((emp, empIdx) => {
    const rowIdx = 5 + empIdx;
    const row = planningSheet.getRow(rowIdx);
    
    row.getCell(1).value = emp.name;
    row.getCell(2).value = emp.department;
    row.getCell(3).value = emp.function;
    row.getCell(4).value = emp.project;
    row.getCell(5).value = emp.travelStartDate || emp.projectStartDate;
    row.getCell(6).value = emp.travelEndDate || emp.projectEndDate;

    // Calculate total counts for this employee
    let w = 0, t = 0, l = 0, h = 0, a = 0;
    dates.forEach(d => {
      const status: string = getCellStatus(emp, d.dateStr, manualLeaves);
      if (status === 'W') w++;
      else if (status === 'T') t++;
      else if (status === 'L') l++;
      else if (status === 'H') h++;
      else if (status === 'A') a++;
    });

    row.getCell(7).value = w;
    row.getCell(8).value = t;
    row.getCell(9).value = l;
    row.getCell(10).value = h;
    row.getCell(11).value = a;

    // Style summary counter columns
    for (let c = 7; c <= 11; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F8FAFC' } // Slate-50
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    }

    dates.forEach((d, dIdx) => {
      const colIdx = timelineStartCol + dIdx;
      const cell = row.getCell(colIdx);
      const status: string = getCellStatus(emp, d.dateStr, manualLeaves);
      cell.value = status;
      cell.alignment = { horizontal: 'center' };
      
      const fill = getStatusFill(status);
      if (fill) {
        cell.fill = fill as any;
        cell.font = { bold: true, color: { argb: getStatusFontColor(status) } };
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Planning_Grid_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
