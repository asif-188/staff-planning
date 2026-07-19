import ExcelJS from 'exceljs';
import type { Employee, LeaveRecord, EmployeeProfile, ProjectDetails, ProjectAssignment, ReviewRecord } from '../hooks/usePlanningState';
import { getDatesForInterval, resolveStatusOnDate, formatToClientDate, safeParseDate, normalizeDateString } from './timelineHelper';
import { format } from 'date-fns';

// Helper to get color code fill for Planning and Attendance cells
const getStatusFill = (status: string) => {
  switch (status) {
    case 'W':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE6F1' } }; // Light Blue
    case 'L':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } }; // Light Purple
    case 'T':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } }; // Dark Purple
    case 'S':
      return { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } }; // Light Orange
    default:
      return null;
  }
};

const getStatusFontColor = (status: string) => {
  switch (status) {
    case 'W': return '000000'; // Black text
    case 'L': return '000000'; // Black text
    case 'T': return 'FFFFFF'; // White text
    case 'S': return 'C2410C'; // Dark Orange
    default: return '000000';
  }
};

export async function exportAvailabilityReportToExcel(
  results: {
    employee: Employee;
    freeRange: { startStr: string; endStr: string; daysCount: number };
    totalFreeDays: number;
    occupiedDetails: string;
    workingDetails: string;
    leaveDetails: string;
  }[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Availability Report');

  // Title block
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  const periodText = (startDate && endDate) ? `${startDate} to ${endDate}` : 'All Time';
  titleCell.value = `Availability Finder Report (Period: ${periodText})`;
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
    'Designation',
    'Available Periods (in Range)',
    'Total Standby Days',
    'Working Details',
    'Leave Details'
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
  sheet.getColumn(7).width = 45;
  sheet.getColumn(8).width = 45;

  results.forEach(res => {
    sheet.addRow([
      res.employee.id,
      res.employee.name,
      res.employee.department,
      res.employee.designation,
      `${res.freeRange.startStr} to ${res.freeRange.endStr}`,
      `${res.totalFreeDays} Days`,
      res.workingDetails,
      res.leaveDetails
    ]);
  });

  // Highlight cells
  for (let r = 4; r <= results.length + 3; r++) {
    const row = sheet.getRow(r);
    row.getCell(5).font = { color: { argb: '166534' }, bold: true }; // Green text
    row.getCell(6).font = { color: { argb: '1E40AF' }, bold: true }; // Blue text
    row.getCell(7).font = { color: { argb: '475569' } };
    row.getCell(8).font = { color: { argb: '475569' } };
  }

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (startDate && endDate) ? `Availability_Report_${startDate}_to_${endDate}.xlsx` : 'Availability_Report_All_Time.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportLeaveReportToExcel(
  leaves: LeaveRecord[],
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leave Report');

  // Title Block
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  const periodText = (startDate && endDate) 
    ? `${formatToClientDate(startDate)} to ${formatToClientDate(endDate)}`
    : 'All Time';
  titleCell.value = `Leave Management Report (Period: ${periodText})`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E11D48' } // Rose red for Leave branding
  };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  sheet.addRow([]);

  // Column headers
  sheet.addRow([
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Project Name',
    'Project ID',
    'Leave Start Date',
    'Leave End Date',
    'Remarks'
  ]);

  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'E11D48' } // Rose red
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 25;

  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 25;
  sheet.getColumn(6).width = 15;
  sheet.getColumn(7).width = 18;
  sheet.getColumn(8).width = 18;
  sheet.getColumn(9).width = 30;

  // Filter leaves that overlap with the selected range
  const rangeStart = startDate ? normalizeDateString(startDate) : '';
  const rangeEnd = endDate ? normalizeDateString(endDate) : '';

  const activeLeaves = leaves.filter(l => {
    const lFrom = normalizeDateString(l.fromDate);
    const lTo = normalizeDateString(l.toDate);
    if (!lFrom || !lTo) return false;
    return (!rangeStart || lTo >= rangeStart) && (!rangeEnd || lFrom <= rangeEnd);
  });

  activeLeaves.forEach(l => {
    const prof = profiles.find(p => p.id === l.employeeId);
    const proj = projects.find(p => p.name === l.projectId);
    sheet.addRow([
      l.employeeId,
      l.employeeName,
      prof?.department || '-',
      prof?.designation || '-',
      l.projectId || 'None',
      proj?.budgetCode || '-',
      formatToClientDate(l.fromDate),
      formatToClientDate(l.toDate),
      l.remarks || ''
    ]);
  });

  // Write and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (startDate && endDate) ? `Leave_Report_${startDate}_to_${endDate}.xlsx` : 'Leave_Report_All_Time.xlsx';
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportDatabaseToExcel(
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  assignments: ProjectAssignment[],
  leaves: LeaveRecord[]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Master Sheet');

  const allProjects = [
    ...projects,
    { name: 'Leave', budgetCode: 'L', startDate: '', endDate: '' }
  ];

  // Columns A-D widths
  sheet.getColumn(1).width = 25; // Department
  sheet.getColumn(2).width = 15; // Employee ID
  sheet.getColumn(3).width = 30; // Name
  sheet.getColumn(4).width = 25; // Designation
  
  // Write static title headers in columns A-D
  sheet.mergeCells('A1:D1');
  const title1 = sheet.getCell('A1');
  title1.value = 'Project STAFF working schedule';
  title1.font = { bold: true, size: 12 };
  title1.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A2:D2');
  const title2 = sheet.getCell('A2');
  title2.value = 'Maitenance Dredging at kakinada Deep water Port year 2025_07/Sep/25';
  title2.font = { bold: true, size: 10, italic: true };
  title2.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: A4: 'Department', B4: 'Employee ID', C4: 'Name', D4: 'Designation'
  sheet.getCell('A4').value = 'Department';
  sheet.getCell('B4').value = 'Employee ID';
  sheet.getCell('C4').value = 'Name';
  sheet.getCell('D4').value = 'Designation';
  
  for (let c = 1; c <= 4; c++) {
    sheet.getCell(4, c).font = { bold: true };
    sheet.getCell(4, c).alignment = { vertical: 'middle' };
  }

  // Write project columns starting from Column E (Col 5)
  allProjects.forEach((proj, idx) => {
    const startCol = 5 + idx * 2;
    const endCol = 6 + idx * 2;

    sheet.getColumn(startCol).width = 15;
    sheet.getColumn(endCol).width = 15;

    // Row 1: Merged 'Budget Code'
    sheet.mergeCells(1, startCol, 1, endCol);
    const budgetLabel = sheet.getCell(1, startCol);
    budgetLabel.value = proj.name === 'Leave' ? 'Leave / Rotation' : 'Budget Code';
    budgetLabel.font = { bold: true };
    budgetLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 2: Merged Project Budget Code
    sheet.mergeCells(2, startCol, 2, endCol);
    const budgetVal = sheet.getCell(2, startCol);
    budgetVal.value = proj.budgetCode || '';
    budgetVal.font = { bold: true };
    budgetVal.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 3: Start Date and End Date
    const startCell = sheet.getCell(3, startCol);
    startCell.value = proj.name === 'Leave' ? 'Start' : formatToClientDate(proj.startDate);
    startCell.font = { bold: true };
    startCell.alignment = { horizontal: 'center' };

    const endCell = sheet.getCell(3, endCol);
    endCell.value = proj.name === 'Leave' ? 'End' : formatToClientDate(proj.endDate);
    endCell.font = { bold: true };
    endCell.alignment = { horizontal: 'center' };

    // Row 4: Merged Project Name
    sheet.mergeCells(4, startCol, 4, endCol);
    const nameCell = sheet.getCell(4, startCol);
    nameCell.value = proj.name;
    nameCell.font = { bold: true };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Sort employees by Department, then by Name
  const sortedProfiles = [...profiles].sort((a, b) => {
    const deptCompare = (a.department || '').localeCompare(b.department || '');
    if (deptCompare !== 0) return deptCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Populate Employee Rows starting at Row 5, line by line
  let currentRowIdx = 5;

  sortedProfiles.forEach((emp) => {
    const empAssignments = assignments.filter(a => a.employeeId === emp.id);
    const empLeaves = leaves.filter(l => l.employeeId === emp.id);

    if (empAssignments.length === 0 && empLeaves.length === 0) {
      // Just write one empty row for this employee
      const r = sheet.getRow(currentRowIdx);
      r.height = 20;
      r.getCell(1).value = emp.department;
      r.getCell(2).value = emp.id;
      r.getCell(3).value = emp.name;
      r.getCell(4).value = emp.designation;

      for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
        const cell = r.getCell(c);
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } }
        };
      }
      currentRowIdx++;
    } else {
      // Write one row for each project assignment
      empAssignments.forEach(assign => {
        const r = sheet.getRow(currentRowIdx);
        r.height = 20;
        r.getCell(1).value = emp.department;
        r.getCell(2).value = emp.id;
        r.getCell(3).value = emp.name;
        r.getCell(4).value = emp.designation;

        allProjects.forEach((proj, pIdx) => {
          const startCol = 5 + pIdx * 2;
          const endCol = 6 + pIdx * 2;

          if (proj.name === assign.projectName) {
            r.getCell(startCol).value = formatToClientDate(assign.travelStartDate || proj.startDate);
            r.getCell(endCol).value = formatToClientDate(assign.travelEndDate || proj.endDate);
          } else {
            r.getCell(startCol).value = '';
            r.getCell(endCol).value = '';
          }
          r.getCell(startCol).alignment = { horizontal: 'center' };
          r.getCell(endCol).alignment = { horizontal: 'center' };
        });

        for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
          const cell = r.getCell(c);
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        }
        currentRowIdx++;
      });

      // Write one row for each leave record
      empLeaves.forEach(lv => {
        const r = sheet.getRow(currentRowIdx);
        r.height = 20;
        r.getCell(1).value = emp.department;
        r.getCell(2).value = emp.id;
        r.getCell(3).value = emp.name;
        r.getCell(4).value = emp.designation;

        allProjects.forEach((proj, pIdx) => {
          const startCol = 5 + pIdx * 2;
          const endCol = 6 + pIdx * 2;

          if (proj.name === 'Leave') {
            r.getCell(startCol).value = formatToClientDate(lv.fromDate);
            r.getCell(endCol).value = formatToClientDate(lv.toDate);
          } else {
            r.getCell(startCol).value = '';
            r.getCell(endCol).value = '';
          }
          r.getCell(startCol).alignment = { horizontal: 'center' };
          r.getCell(endCol).alignment = { horizontal: 'center' };
        });

        for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
          const cell = r.getCell(c);
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        }
        currentRowIdx++;
      });
    }
  });

  // Add cell borders to all header cells (rows 1-4)
  for (let rowNum = 1; rowNum <= 4; rowNum++) {
    const headerRow = sheet.getRow(rowNum);
    for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
      const cell = headerRow.getCell(c);
      cell.border = {
        bottom: { style: 'thin', color: { argb: '94A3B8' } },
        right: { style: 'thin', color: { argb: '94A3B8' } }
      };
    }
  }

  // Freeze Columns A-D and Rows 1-4
  sheet.views = [
    { state: 'frozen', xSplit: 4, ySplit: 4 }
  ];

  // Save Workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Master_Planning_Schedule.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// 2. Export Dashboard Reports (Leave list, Standby list)
export async function exportDashboardToExcel(
  onLeave: any[],
  standbyList: any[],
  _zeroBalance: any[], // kept for backward signature compatibility, unused
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();

  // Tab 1: Staff on Leave
  const leaveSheet = workbook.addWorksheet('Employees on Leave');
  leaveSheet.columns = [
    { header: 'Employee ID', key: 'id', width: 15 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Project', key: 'project', width: 25 },
    { header: 'Leave Period', key: 'leavePeriod', width: 30 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];
  leaveSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  leaveSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F43F5E' } }; // Rose

  onLeave.forEach(item => {
    leaveSheet.addRow({
      id: item.id,
      name: item.name,
      designation: item.designation || '',
      project: item.project,
      leavePeriod: item.leavePeriod,
      remarks: item.remarks
    });
  });

  // Tab 2: Standby Employees
  const standbySheet = workbook.addWorksheet('Standby Employees');
  standbySheet.columns = [
    { header: 'Employee ID', key: 'id', width: 15 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Last Project', key: 'lastProject', width: 25 },
    { header: 'Standby Period', key: 'standbyPeriod', width: 25 },
    { header: 'Standby Days Count', key: 'standbyDaysCount', width: 20 }
  ];
  standbySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  standbySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F97316' } }; // Orange

  standbyList.forEach(item => {
    standbySheet.addRow({
      id: item.id,
      name: item.name,
      designation: item.designation || '',
      lastProject: item.lastProject,
      standbyPeriod: item.standbyPeriod,
      standbyDaysCount: item.standbyDaysCount
    });
  });

  // Save File
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Dashboard_Analytics_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// 3. Export Planning Grid (With grouping and travel mapped to W)
export async function exportPlanningGridToExcel(
  assignments: ProjectAssignment[],
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  leaves: LeaveRecord[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();

  // ==================== SHEET 1: Planning Grid ====================
  const planningSheet = workbook.addWorksheet('Planning Grid');
  const dates = getDatesForInterval(startDate, endDate);
  
  // Set column widths
  planningSheet.getColumn(1).width = 28; // Employee Name (A)
  planningSheet.getColumn(2).width = 22; // Designation / Function (B)
  planningSheet.getColumn(3).width = 25; // Remarks (C)
  for (let i = 0; i < dates.length; i++) {
    planningSheet.getColumn(4 + i).width = 4.5; // Timeline dates start at Column 4 (D)
  }

  let nextRow = 1;

  // Render project-by-project blocks
  projects.forEach((project, projIdx) => {
    // Find assignments matching this project
    const projAssignments = assignments.filter(a => a.projectName === project.name);
    if (projAssignments.length === 0) return; // Skip projects with no assignments

    if (projIdx > 0 || nextRow > 1) {
      nextRow += 2; // Insert 2 blank rows between blocks
    }

    // Write BUDGET - Project Name header
    const r1 = planningSheet.getRow(nextRow);
    r1.getCell(1).value = 'BUDGET - Project Name';
    r1.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' } }; // White font
    r1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Premium Navy Blue
    r1.getCell(2).value = project.name;
    r1.getCell(2).font = { bold: true };
    r1.getCell(3).value = project.budgetCode || '';
    r1.getCell(3).font = { bold: true };

    // Write Budget Code
    const r2 = planningSheet.getRow(nextRow + 1);
    r2.getCell(2).value = project.budgetCode || '';
    r2.getCell(2).font = { bold: true };
    r2.getCell(2).alignment = { horizontal: 'center' };

    // Write Row 4: Name, Designation, Remarks
    const r4 = planningSheet.getRow(nextRow + 3);
    r4.getCell(1).value = 'Name';
    r4.getCell(1).font = { bold: true };
    r4.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(2).value = 'Designation';
    r4.getCell(2).font = { bold: true };
    r4.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(3).value = 'Remarks';
    r4.getCell(3).font = { bold: true };
    r4.getCell(3).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    // Set Column C labels for timeline headers
    planningSheet.getRow(nextRow + 2).getCell(3).value = 'Days';
    planningSheet.getRow(nextRow + 2).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 2).getCell(3).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow + 1).getCell(3).value = 'Week';
    planningSheet.getRow(nextRow + 1).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 1).getCell(3).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow).getCell(3).value = 'Date';
    planningSheet.getRow(nextRow).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow).getCell(3).alignment = { horizontal: 'center' };

    // Set Project Start and End in columns A and B of Row 3 (nextRow + 2)
    const r3 = planningSheet.getRow(nextRow + 2);
    
    r3.getCell(1).value = `Project Start - ${formatToClientDate(project.startDate)}`;
    r3.getCell(1).font = { bold: true, size: 10 };
    r3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '92D050' } }; // Excel Lime Green
    r3.getCell(1).border = {
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } }
    };

    r3.getCell(2).value = `Project End - ${formatToClientDate(project.endDate)}`;
    r3.getCell(2).font = { bold: true, size: 10 };
    r3.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '92D050' } }; // Excel Lime Green
    r3.getCell(2).border = {
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } }
    };

    // Day numbers header (Row 3 of this block)
    dates.forEach((d, idx) => {
      const colIdx = 4 + idx;
      const dayCell = r3.getCell(colIdx);
      dayCell.value = parseInt(d.dayNum, 10);
      dayCell.alignment = { horizontal: 'center' };
      dayCell.font = { size: 9, bold: true };
      
      if (d.isWeekend) {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } }; // light green weekend
      } else {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
      dayCell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      // Border style for empty Row 4 timeline cells
      const cell4 = r4.getCell(colIdx);
      cell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cell4.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    });

    // Merge and write Week start dates in Row 1 & Week Numbers in Row 2
    let currentWeekNum = -1;
    let weekStartCol = -1;
    dates.forEach((d, idx) => {
      const colIdx = 4 + idx;
      if (d.weekNum !== currentWeekNum) {
        if (weekStartCol !== -1) {
          planningSheet.mergeCells(nextRow, weekStartCol, nextRow, colIdx - 1);
          planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, colIdx - 1);
        }
        currentWeekNum = d.weekNum;
        weekStartCol = colIdx;
        planningSheet.getRow(nextRow).getCell(colIdx).value = formatToClientDate(d.dateStr);
        planningSheet.getRow(nextRow + 1).getCell(colIdx).value = d.weekNum;
      }
    });
    if (weekStartCol !== -1) {
      planningSheet.mergeCells(nextRow, weekStartCol, nextRow, 4 + dates.length - 1);
      planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, 4 + dates.length - 1);
    }

    // Set styling for Row 1 & Row 2 timeline cells
    for (let c = 4; c < 4 + dates.length; c++) {
      const cellRow1 = planningSheet.getRow(nextRow).getCell(c);
      const cellRow2 = planningSheet.getRow(nextRow + 1).getCell(c);

      cellRow1.font = { bold: true, size: 9 };
      cellRow1.alignment = { horizontal: 'center' };
      cellRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow1.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      cellRow2.font = { bold: true, size: 9 };
      cellRow2.alignment = { horizontal: 'center' };
      cellRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow2.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    }

    // Group the project assignments by department
    const employeesInProject: {
      id: string;
      name: string;
      designation: string;
      department: string;
    }[] = [];

    const uniqueEmpsInProj = new Set<string>();
    projAssignments.forEach(a => {
      if (!uniqueEmpsInProj.has(a.employeeId)) {
        uniqueEmpsInProj.add(a.employeeId);
        const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', designation: 'Unknown', department: 'Unknown' };
        employeesInProject.push({
          id: a.employeeId,
          name: prof.name,
          designation: prof.designation,
          department: prof.department
        });
      }
    });

    const depts = Array.from(new Set(employeesInProject.map(e => e.department)));
    nextRow += 4;

    depts.forEach(deptName => {
      // Write Department Section Row
      const deptRow = planningSheet.getRow(nextRow);
      deptRow.getCell(1).value = deptName;
      deptRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
      
      deptRow.height = 20;
      for (let col = 1; col < 4 + dates.length; col++) {
        const cell = deptRow.getCell(col);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Dark Blue
      }
      planningSheet.mergeCells(nextRow, 1, nextRow, 4 + dates.length - 1);
      nextRow++;

      // Write Employees rows
      const deptEmployees = employeesInProject.filter(e => e.department === deptName);
      deptEmployees.forEach(emp => {
        const empRow = planningSheet.getRow(nextRow);
        empRow.getCell(1).value = emp.name;
        empRow.getCell(2).value = emp.designation;

        const assign = assignments.find(a => a.employeeId === emp.id && a.projectName === project.name);
        empRow.getCell(3).value = assign?.remarks || '';

        dates.forEach((d, dIdx) => {
          const colIdx = 4 + dIdx;
          const cell = empRow.getCell(colIdx);
          
          let cellStatus = '';
          const globalStatus = resolveStatusOnDate(emp.id, d.dateStr, assignments, projects, leaves, profiles);
          
          if (globalStatus === 'L') {
            cellStatus = 'L';
          } else {
            // Only output assignment status (W or T) if assigned to this project on this date
            const hasAssign = assignments.some(a => 
              a.employeeId === emp.id && 
              a.projectName === project.name &&
              (!a.travelStartDate || d.dateStr >= a.travelStartDate) &&
              (!a.travelEndDate || d.dateStr <= a.travelEndDate)
            );
            if (hasAssign) {
              cellStatus = globalStatus === 'T' ? 'T' : 'W';
            }
          }

          cell.value = cellStatus;
          cell.alignment = { horizontal: 'center' };
          
          const fill = getStatusFill(cellStatus);
          if (fill) {
            cell.fill = fill as any;
            cell.font = { bold: true, color: { argb: getStatusFontColor(cellStatus) } };
          }
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
            right: { style: 'thin', color: { argb: 'E2E8F0' } }
          };
        });
        nextRow++;
      });
    });
  });

  // Render Standby block at the bottom
  const standbyOnlyEmployees = profiles.filter(p => {
    return !assignments.some(a => a.employeeId === p.id);
  });

  if (standbyOnlyEmployees.length > 0) {
    if (nextRow > 1) {
      nextRow += 2;
    }

    const r1 = planningSheet.getRow(nextRow);
    r1.getCell(1).value = 'STANDBY / UNALLOCATED STAFF';
    r1.getCell(1).font = { bold: true, color: { argb: 'EF4444' } }; // Red font

    const r4 = planningSheet.getRow(nextRow + 3);
    r4.getCell(1).value = 'Name';
    r4.getCell(1).font = { bold: true };
    r4.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(2).value = 'Designation';
    r4.getCell(2).font = { bold: true };
    r4.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(3).value = 'Remarks';
    r4.getCell(3).font = { bold: true };
    r4.getCell(3).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    // Set Column C labels for timeline headers in standby block
    planningSheet.getRow(nextRow + 2).getCell(3).value = 'Days';
    planningSheet.getRow(nextRow + 2).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 2).getCell(3).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow + 1).getCell(3).value = 'Week';
    planningSheet.getRow(nextRow + 1).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 1).getCell(3).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow).getCell(3).value = 'Date';
    planningSheet.getRow(nextRow).getCell(3).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow).getCell(3).alignment = { horizontal: 'center' };

    dates.forEach((d, idx) => {
      const colIdx = 4 + idx;
      const dayCell = planningSheet.getRow(nextRow + 2).getCell(colIdx);
      dayCell.value = parseInt(d.dayNum, 10);
      dayCell.alignment = { horizontal: 'center' };
      dayCell.font = { size: 9, bold: true };
      
      if (d.isWeekend) {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      } else {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
      dayCell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      if (colIdx > 6) {
        const cell4 = r4.getCell(colIdx);
        cell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        cell4.border = {
          bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } }
        };
      }
    });

    let currentWeekNum = -1;
    let weekStartCol = -1;
    dates.forEach((d, idx) => {
      const colIdx = 4 + idx;
      if (d.weekNum !== currentWeekNum) {
        if (weekStartCol !== -1) {
          planningSheet.mergeCells(nextRow, weekStartCol, nextRow, colIdx - 1);
          planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, colIdx - 1);
        }
        currentWeekNum = d.weekNum;
        weekStartCol = colIdx;
        planningSheet.getRow(nextRow).getCell(colIdx).value = formatToClientDate(d.dateStr);
        planningSheet.getRow(nextRow + 1).getCell(colIdx).value = d.weekNum;
      }
    });
    if (weekStartCol !== -1) {
      planningSheet.mergeCells(nextRow, weekStartCol, nextRow, 4 + dates.length - 1);
      planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, 4 + dates.length - 1);
    }

    for (let c = 4; c < 4 + dates.length; c++) {
      const cellRow1 = planningSheet.getRow(nextRow).getCell(c);
      const cellRow2 = planningSheet.getRow(nextRow + 1).getCell(c);

      cellRow1.font = { bold: true, size: 9 };
      cellRow1.alignment = { horizontal: 'center' };
      cellRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow1.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      cellRow2.font = { bold: true, size: 9 };
      cellRow2.alignment = { horizontal: 'center' };
      cellRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow2.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    }

    nextRow += 4;

    standbyOnlyEmployees.forEach(emp => {
      const empRow = planningSheet.getRow(nextRow);
      empRow.getCell(1).value = emp.name;
      empRow.getCell(2).value = emp.designation;
      empRow.getCell(3).value = 'Standby';

      dates.forEach((d, dIdx) => {
        const colIdx = 4 + dIdx;
        const cell = empRow.getCell(colIdx);
        const status = resolveStatusOnDate(emp.id, d.dateStr, assignments, projects, leaves, profiles);

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
      nextRow++;
    });
  }

  planningSheet.views = [
    { state: 'frozen', xSplit: 3, ySplit: 0 }
  ];


  // ==================== SHEET 2: Planning Summary ====================
  const detailsSheet = workbook.addWorksheet('Planning Summary');
  detailsSheet.columns = [
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Project Code', key: 'projectCode', width: 15 },
    { header: 'Allocated Start Date', key: 'projStart', width: 22 },
    { header: 'Allocated End Date', key: 'projEnd', width: 22 },
    { header: 'Leave Start Date', key: 'leaveStart', width: 18 },
    { header: 'Leave End Date', key: 'leaveEnd', width: 18 }
  ];

  detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' } // Navy blue
  };
  detailsSheet.getRow(1).height = 25;
  detailsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  assignments.forEach(a => {
    const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', department: 'Unknown', designation: 'Unknown' };
    const proj = projects.find(p => p.name === a.projectName);
    
    // Find leaves for this employee on this project
    const empProjLeaves = leaves.filter(l => 
      l.employeeId === a.employeeId && 
      l.projectId === a.projectName
    );

    // 1. Try to find an exactly overlapping leave
    let assocLeave = empProjLeaves.find(l => 
      !(l.toDate < a.travelStartDate || l.fromDate > a.travelEndDate)
    );

    // 2. If no overlapping leave, find if this assignment is the closest one to any of the employee's project leaves
    if (!assocLeave) {
      const nonOverlappingLeaves = empProjLeaves.filter(l => {
        const overlapsAny = assignments.some(otherA => 
          otherA.employeeId === l.employeeId &&
          !(l.toDate < otherA.travelStartDate || l.fromDate > otherA.travelEndDate)
        );
        return !overlapsAny;
      });

      const matchingLeave = nonOverlappingLeaves.find(l => {
        const lDate = safeParseDate(l.fromDate);
        if (isNaN(lDate.getTime())) return false;

        const candidateAssignments = assignments.filter(otherA => 
          otherA.employeeId === a.employeeId && 
          otherA.projectName === a.projectName
        );

        if (candidateAssignments.length === 0) return false;

        let closestA = candidateAssignments[0];
        let minDiff = Infinity;

        candidateAssignments.forEach(otherA => {
          const aStart = safeParseDate(otherA.travelStartDate);
          if (isNaN(aStart.getTime())) return;
          const diff = Math.abs(lDate.getTime() - aStart.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestA = otherA;
          }
        });

        return closestA.travelStartDate === a.travelStartDate && closestA.travelEndDate === a.travelEndDate;
      });

      if (matchingLeave) {
        assocLeave = matchingLeave;
      }
    }

    const newRow = detailsSheet.addRow({
      name: prof.name,
      department: prof.department,
      designation: prof.designation,
      projectName: a.projectName,
      projectCode: proj?.budgetCode || '-',
      projStart: formatToClientDate(a.travelStartDate || ''),
      projEnd: formatToClientDate(a.travelEndDate || ''),
      leaveStart: assocLeave ? formatToClientDate(assocLeave.fromDate) : '',
      leaveEnd: assocLeave ? formatToClientDate(assocLeave.toDate) : ''
    });

    // Center date values
    for (let c = 5; c <= 9; c++) {
      newRow.getCell(c).alignment = { horizontal: 'center' };
    }
  });

  // Save Workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Planning_Grid_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// 4. Export Attendance Grid (With custom interval and only W, L, T, S)
export async function exportAttendanceToExcel(
  assignments: ProjectAssignment[],
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  leaves: LeaveRecord[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');

  const dates = getDatesForInterval(startDate, endDate);
  const totalCols = 11 + dates.length; // 6 info columns (including Project Name and Code), 5 summary columns (W, L, T, S, %)



  // Row 1 & Row 2: Title Header (Merge A1 to K2)
  sheet.mergeCells('A1:K2');
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 20;
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = sheet.getRow(r).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Premium Navy Blue
    }
  }
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Attendance Report (Period: ${formatToClientDate(startDate)} to ${formatToClientDate(endDate)})`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Group dates by month for merging headers in Row 1 & 2 of the timeline
  let currentMonthStr = '';
  let monthStartCol = -1;
  dates.forEach((d, idx) => {
    const colIdx = 12 + idx; // Timeline starts at column 12 (L)
    if (d.monthLabel !== currentMonthStr) {
      if (monthStartCol !== -1) {
        sheet.mergeCells(1, monthStartCol, 2, colIdx - 1);
        const cell = sheet.getCell(1, monthStartCol);
        cell.value = currentMonthStr;
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        for (let r = 1; r <= 2; r++) {
          for (let c = monthStartCol; c <= colIdx - 1; c++) {
            sheet.getCell(r, c).fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: '2563EB' } 
            };
            sheet.getCell(r, c).border = {
              bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
              right: { style: 'thin', color: { argb: 'FFFFFF' } }
            };
          }
        }
      }
      currentMonthStr = d.monthLabel;
      monthStartCol = colIdx;
    }
  });

  if (monthStartCol !== -1) {
    const lastColIdx = 11 + dates.length;
    sheet.mergeCells(1, monthStartCol, 2, lastColIdx);
    const cell = sheet.getCell(1, monthStartCol);
    cell.value = currentMonthStr;
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    for (let r = 1; r <= 2; r++) {
      for (let c = monthStartCol; c <= lastColIdx; c++) {
        sheet.getCell(r, c).fill = { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: '2563EB' } 
        };
        sheet.getCell(r, c).border = {
          bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFF' } }
        };
      }
    }
  }

  const baseHeaders = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Project Name',
    'Project Code',
    'W',
    'L',
    'T',
    'S',
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

  const statusCounts = dates.map(() => ({ W: 0, T: 0, L: 0, S: 0 }));

  profiles.forEach((prof) => {
    let w = 0, l = 0, t = 0, s = 0;
    const dailyStatusVals: string[] = [];

    dates.forEach((d, dIdx) => {
      const status = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles) || '';
      dailyStatusVals.push(status);

      if (status === 'W') { w++; statusCounts[dIdx].W++; }
      else if (status === 'L') { l++; statusCounts[dIdx].L++; }
      else if (status === 'T') { t++; statusCounts[dIdx].T++; }
      else if (status === 'S') { s++; statusCounts[dIdx].S++; }
    });

    const activeDays = w + t;
    const totalScheduled = w + t + l + s;
    const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

    const empAssignments = assignments.filter(a => a.employeeId === prof.id);
    const activeAss = empAssignments.find(a => {
      const foundProj = projects.find(p => p.name === a.projectName);
      const sStr = a.travelStartDate || foundProj?.startDate || '';
      const eStr = a.travelEndDate || foundProj?.endDate || '';
      return !(eStr < startDate || sStr > endDate);
    }) || empAssignments[0];
    const activeAssName = activeAss?.projectName || 'Unassigned';
    const foundProj = activeAss ? projects.find(p => p.name === activeAss.projectName) : null;
    const activeAssCode = foundProj?.budgetCode || '-';

    sheet.addRow([
      prof.id,
      prof.name,
      prof.department,
      prof.designation,
      activeAssName,
      activeAssCode,
      w,
      l,
      t,
      s,
      `${rate}%`,
      ...dailyStatusVals
    ]);
  });

  // Add summary rows at the bottom
  sheet.addRow([]);

  const summaryKeys: { key: 'W' | 'T' | 'L' | 'S'; label: string }[] = [
    { key: 'W', label: 'Total Working (W)' },
    { key: 'L', label: 'Total Leave (L)' },
    { key: 'T', label: 'Total Travel (T)' },
    { key: 'S', label: 'Total Standby (S)' }
  ];

  summaryKeys.forEach(({ key, label }) => {
    const rowValues = [
      label,
      '', // Name
      '', // Department
      '', // Designation
      '', // Project Name
      '', // Project Code
      '', // W
      '', // L
      '', // T
      '', // S
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
  sheet.getColumn(5).width = 25; // Project Name
  sheet.getColumn(6).width = 15; // Project Code
  sheet.getColumn(7).width = 6;  // W
  sheet.getColumn(8).width = 6;  // L
  sheet.getColumn(9).width = 6;  // T
  sheet.getColumn(10).width = 6; // S
  sheet.getColumn(11).width = 8; // %
  
  for (let c = 12; c <= totalCols; c++) {
    sheet.getColumn(c).width = 5;
  }

  for (let r = 4; r <= profiles.length + 3; r++) {
    const row = sheet.getRow(r);
    row.height = 22;
    const prof = profiles[r - 4];

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: c <= 6 ? 'left' : 'center' };
      
      if (c >= 12) {
        const val = cell.value?.toString();
        if (val === 'W') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE6F1' } };
          cell.font = { color: { argb: '000000' }, bold: true, size: 9 };
        } else if (val === 'T') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } };
          cell.font = { color: { argb: 'FFFFFF' }, bold: true, size: 9 };
        } else if (val === 'L') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } };
          cell.font = { color: { argb: '000000' }, bold: true, size: 9 };
          
          if (prof) {
            const dateObj = dates[c - 12];
            const lRecord = leaves.find(l => 
              l.employeeId === prof.id &&
              dateObj.dateStr >= l.fromDate &&
              dateObj.dateStr <= l.toDate
            );
            if (lRecord) {
              cell.note = `Project ID: ${lRecord.projectId || 'None'}\nRemarks: ${lRecord.remarks || 'None'}`;
            }
          }
        } else if (val === 'S') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } };
          cell.font = { color: { argb: 'C2410C' }, bold: true, size: 9 };
        }
      }
    }
  }

  // ==================== SHEET 2: Leave Details ====================
  const leaveSheet = workbook.addWorksheet('Leave Details');
  leaveSheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Employee Name', key: 'employeeName', width: 25 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Project Code', key: 'projectCode', width: 15 },
    { header: 'Leave Start Date', key: 'fromDate', width: 18 },
    { header: 'Leave End Date', key: 'toDate', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];

  leaveSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  leaveSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  leaveSheet.getRow(1).height = 25;
  leaveSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  // Filter leaves that overlap with the selected range
  const rangeStart = safeParseDate(startDate);
  const rangeEnd = safeParseDate(endDate);

  const activeLeaves = leaves.filter(l => {
    const lFrom = safeParseDate(l.fromDate);
    const lTo = safeParseDate(l.toDate);
    if (isNaN(lFrom.getTime()) || isNaN(lTo.getTime())) return false;
    return !(lTo < rangeStart || lFrom > rangeEnd);
  });

  activeLeaves.forEach(l => {
    const prof = profiles.find(p => p.id === l.employeeId);
    const proj = projects.find(p => p.name === l.projectId);
    leaveSheet.addRow({
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      designation: prof?.designation || '-',
      projectName: l.projectId || 'None',
      projectCode: proj?.budgetCode || '-',
      fromDate: formatToClientDate(l.fromDate),
      toDate: formatToClientDate(l.toDate),
      remarks: l.remarks || ''
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// 5. Excel JS Import Parsers (Project Database)
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

// 6. Excel JS Import Parsers (Employees Database)
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
          else if (val.includes('func') || val.includes('role') || val.includes('function') || val.includes('designation')) colIndices.designation = colNum;
          else if (val.includes('status')) colIndices.status = colNum;
        });

        const idCol = colIndices.id || 1;
        const nameCol = colIndices.name || 2;
        const deptCol = colIndices.department || 3;
        const funcCol = colIndices.designation || 4;
        const statusCol = colIndices.status || 5;

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header

          const idVal = row.getCell(idCol).value?.toString().trim();
          const nameVal = row.getCell(nameCol).value?.toString().trim();
          if (!idVal || !nameVal) return;

          let statusVal = colIndices.status ? row.getCell(statusCol).value?.toString().trim() : 'Work';
          let parsedStatus: 'Work' | 'Standby' = 'Work';
          if (statusVal) {
            const clean = statusVal.toLowerCase();
            if (clean.includes('standby') || clean === 's') {
              parsedStatus = 'Standby';
            }
          }

          profilesList.push({
            id: idVal.toUpperCase(),
            name: nameVal,
            department: row.getCell(deptCol).value?.toString().trim() || 'Operations',
            designation: row.getCell(funcCol).value?.toString().trim() || 'Staff',
            status: parsedStatus
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

// 7. Download template file
export async function downloadExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Template');
  const headers = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Project',
    'Budget Code',
    'Project Start Date',
    'Project End Date',
    'Start Date',
    'End Date',
    'Status',
    'Remarks'
  ];
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
  a.download = `Staff_Planning_Import_Template.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Legacy importFromExcel parser
export async function importFromExcel(file: File): Promise<Employee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        let sheet = workbook.worksheets.find(w => w.name.toLowerCase().includes('master') || w.name.toLowerCase().includes('assignment'));
        if (!sheet) {
          sheet = workbook.worksheets[0];
        }

        if (!sheet) {
          reject(new Error("No sheet found in Excel workbook"));
          return;
        }

        const employees: Employee[] = [];
        const headerRow = sheet.getRow(1);
        const colIndices: { [key: string]: number } = {};
        
        headerRow.eachCell((cell, colNumber) => {
          const value = cell.value?.toString().toLowerCase().trim() || '';
          if (value.includes('id') || value.includes('employee id')) colIndices.id = colNumber;
          else if (value.includes('name')) colIndices.name = colNumber;
          else if (value.includes('dept') || value.includes('department')) colIndices.department = colNumber;
          else if (value.includes('func') || value.includes('role') || value.includes('function') || value.includes('designation')) colIndices.designation = colNumber;
          else if (value.includes('project') && !value.includes('start') && !value.includes('end')) colIndices.project = colNumber;
          else if (value.includes('budget')) colIndices.budgetCode = colNumber;
          else if (value.includes('project') && value.includes('start')) colIndices.projectStartDate = colNumber;
          else if (value.includes('project') && value.includes('end')) colIndices.projectEndDate = colNumber;
          else if (value.includes('start')) colIndices.travelStartDate = colNumber;
          else if (value.includes('end')) colIndices.travelEndDate = colNumber;
          else if (value.includes('status')) colIndices.status = colNumber;
          else if (value.includes('remark')) colIndices.remarks = colNumber;
        });

        const idCol = colIndices.id || 1;
        const nameCol = colIndices.name || 2;
        const deptCol = colIndices.department || 3;
        const funcCol = colIndices.designation || 4;
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
          if (!idVal || !nameVal) return;

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
              const d = safeParseDate(val);
              if (isNaN(d.getTime())) return val;
              return format(d, 'yyyy-MM-dd');
            } catch {
              return val;
            }
          };

          const projStart = parseDate(getVal(startCol));
          const projEnd = parseDate(getVal(endCol));
          const travelStart = parseDate(getVal(travelStartCol)) || projStart;
          const travelEnd = parseDate(getVal(travelEndCol)) || projEnd;
          
          let statusVal = getVal(statusCol);
          let parsedStatus: 'Work' | 'Standby' = 'Work';
          if (statusVal) {
            const clean = statusVal.toLowerCase();
            if (clean.includes('standby') || clean === 's') {
              parsedStatus = 'Standby';
            }
          }

          employees.push({
            id: idVal,
            name: nameVal,
            department: getVal(deptCol) || 'Operations',
            designation: getVal(funcCol) || 'Staff',
            project: getVal(projCol) || 'Internal',
            budgetCode: getVal(budgetCol) || 'BC-GENERAL',
            projectStartDate: projStart || format(new Date(), 'yyyy-MM-dd'),
            projectEndDate: projEnd || format(new Date(), 'yyyy-MM-dd'),
            travelStartDate: travelStart,
            travelEndDate: travelEnd,
            status: parsedStatus,
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

export async function exportToExcel(
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  assignments: ProjectAssignment[],
  leaves: LeaveRecord[],
  currentMonth: string // YYYY-MM
) {
  const workbook = new ExcelJS.Workbook();
  const dates = getDatesForInterval(`${currentMonth}-01`, `${currentMonth}-31`); // Fallback helper

  // Tab 1: Staff Assignments
  const assignSheet = workbook.addWorksheet('Staff Assignments');
  assignSheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Start Date', key: 'travelStartDate', width: 18 },
    { header: 'End Date', key: 'travelEndDate', width: 18 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];
  assignSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  assignSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };

  assignments.forEach(a => {
    assignSheet.addRow({
      employeeId: a.employeeId,
      projectName: a.projectName,
      travelStartDate: formatToClientDate(a.travelStartDate),
      travelEndDate: formatToClientDate(a.travelEndDate),
      status: a.status,
      remarks: a.remarks
    });
  });

  // Tab 2: Planning Grid
  const planningSheet = workbook.addWorksheet('Planning Grid');
  const timelineStartCol = 10;
  const rowMonth = planningSheet.getRow(1);
  const rowWeek = planningSheet.getRow(2);
  const rowDay = planningSheet.getRow(3);
  const rowDate = planningSheet.getRow(4);

  const staticHeaders = ['Employee Name', 'Department', 'Designation', 'Project', 'Proj Start', 'Proj End', 'W', 'L', 'S'];
  staticHeaders.forEach((h, idx) => {
    const cell = planningSheet.getCell(1, idx + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    planningSheet.mergeCells(1, idx + 1, 4, idx + 1);
  });

  dates.forEach((d, idx) => {
    const colIdx = timelineStartCol + idx;
    rowMonth.getCell(colIdx).value = d.monthLabel;
    rowWeek.getCell(colIdx).value = `Wk ${d.weekNum}`;
    rowDay.getCell(colIdx).value = d.dayLabel;
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
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    }
  }

  for (let i = 0; i < dates.length; i++) {
    planningSheet.getColumn(timelineStartCol + i).width = 4.5;
  }
  for (let i = 1; i <= 6; i++) {
    planningSheet.getColumn(i).width = 18;
  }
  for (let i = 7; i <= 9; i++) {
    planningSheet.getColumn(i).width = 6;
  }

  // Group rows
  const groupedRows: {
    id: string;
    name: string;
    department: string;
    designation: string;
    project: string;
    projectStartDate: string;
    projectEndDate: string;
  }[] = [];

  const uniqueKeys = new Set<string>();
  assignments.forEach(a => {
    const key = `${a.employeeId}_${a.projectName}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', department: 'Unknown', designation: 'Unknown' };
      const proj = projects.find(p => p.name === a.projectName);
      const matchAssigns = assignments.filter(x => x.employeeId === a.employeeId && x.projectName === a.projectName);
      const startDates = matchAssigns.map(x => x.travelStartDate || proj?.startDate || '').filter(Boolean);
      const endDates = matchAssigns.map(x => x.travelEndDate || proj?.endDate || '').filter(Boolean);
      
      const minStart = startDates.length > 0 ? startDates.reduce((min, d) => d < min ? d : min, startDates[0]) : '';
      const maxEnd = endDates.length > 0 ? endDates.reduce((max, d) => d > max ? d : max, endDates[0]) : '';

      groupedRows.push({
        id: a.employeeId,
        name: prof.name,
        department: prof.department,
        designation: prof.designation,
        project: a.projectName,
        projectStartDate: minStart,
        projectEndDate: maxEnd
      });
    }
  });

  groupedRows.forEach((row, idx) => {
    const rowIdx = 5 + idx;
    const excelRow = planningSheet.getRow(rowIdx);
    excelRow.getCell(1).value = row.name;
    excelRow.getCell(2).value = row.department;
    excelRow.getCell(3).value = row.designation;
    excelRow.getCell(4).value = row.project;
    excelRow.getCell(5).value = formatToClientDate(row.projectStartDate);
    excelRow.getCell(6).value = formatToClientDate(row.projectEndDate);

    let w = 0, l = 0, s = 0;
    dates.forEach(d => {
      let status = resolveStatusOnDate(row.id, d.dateStr, assignments, projects, leaves, profiles);
      if (status === 'T') status = 'W';
      if (status === 'W') w++;
      else if (status === 'L') l++;
      else if (status === 'S') s++;
    });

    excelRow.getCell(7).value = w;
    excelRow.getCell(8).value = l;
    excelRow.getCell(9).value = s;

    for (let c = 7; c <= 9; c++) {
      const cell = excelRow.getCell(c);
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
    }

    dates.forEach((d, dIdx) => {
      const colIdx = timelineStartCol + dIdx;
      const cell = excelRow.getCell(colIdx);
      const status = resolveStatusOnDate(row.id, d.dateStr, assignments, projects, leaves, profiles);

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

  // Tab 3: Attendance Sheet
  const attSheet = workbook.addWorksheet('Attendance Sheet');
  const attStaticCols = ['Employee Name', 'Department', 'Designation', 'Project'];
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

  let attMonthStart = 5;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || dates[i].monthLabel !== dates[i - 1].monthLabel) {
      if (attMonthStart < 5 + i - 1) {
        attSheet.mergeCells(1, attMonthStart, 1, 5 + i - 1);
      }
      attMonthStart = 5 + i;
    }
  }

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

  profiles.forEach((prof, empIdx) => {
    const rowIdx = 4 + empIdx;
    const row = attSheet.getRow(rowIdx);
    row.getCell(1).value = prof.name;
    row.getCell(2).value = prof.department;
    row.getCell(3).value = prof.designation;

    const empAssignments = assignments.filter(a => a.employeeId === prof.id);
    const activeAss = empAssignments.find(a => {
      const foundProj = projects.find(p => p.name === a.projectName);
      const sStr = a.travelStartDate || foundProj?.startDate || '';
      const eStr = a.travelEndDate || foundProj?.endDate || '';
      const mid = dates[Math.floor(dates.length / 2)]?.dateStr || '';
      return mid >= sStr && mid <= eStr;
    }) || empAssignments[0];
    row.getCell(4).value = activeAss?.projectName || 'Unassigned';

    dates.forEach((d, dIdx) => {
      const colIdx = 5 + dIdx;
      const cell = row.getCell(colIdx);
      const attStatus = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles) || '';
      
      cell.value = attStatus;
      cell.alignment = { horizontal: 'center' };
      const fill = getStatusFill(attStatus);
      if (fill) {
        cell.fill = fill as any;
        cell.font = { bold: true, color: { argb: getStatusFontColor(attStatus) }, size: 9 };
      }
    });
  });

  // Tab 4: Summary Report
  const summarySheet = workbook.addWorksheet('Summary Report');
  summarySheet.columns = [
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Working Days', key: 'working', width: 15 },
    { header: 'Leave Days', key: 'leave', width: 15 },
    { header: 'Travel Days', key: 'travel', width: 15 },
    { header: 'Standby Days', key: 'standby', width: 15 },
    { header: 'Attendance %', key: 'attendanceRate', width: 18 }
  ];

  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };

  profiles.forEach(prof => {
    let working = 0, leave = 0, travel = 0, standby = 0;
    dates.forEach(d => {
      const status = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles);
      if (status === 'W') working++;
      else if (status === 'L') leave++;
      else if (status === 'T') travel++;
      else if (status === 'S') standby++;
    });

    const activeDays = working + travel;
    const totalScheduled = working + travel + leave + standby;
    const rate = totalScheduled > 0 ? (activeDays / totalScheduled) * 100 : 100;

    summarySheet.addRow({
      name: prof.name,
      department: prof.department,
      designation: prof.designation,
      working,
      leave,
      travel,
      standby,
      attendanceRate: `${rate.toFixed(1)}%`
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Staff_Planning_Report_${currentMonth}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportConsolidatedReportToExcel(
  assignments: ProjectAssignment[],
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  leaves: LeaveRecord[],
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const dates = getDatesForInterval(startDate, endDate);

  // ==================== TAB 1: Master Sheet ====================
  const masterSheet = workbook.addWorksheet('Master Sheet');
  masterSheet.getColumn(1).width = 25; // Department
  masterSheet.getColumn(2).width = 15; // Employee ID
  masterSheet.getColumn(3).width = 30; // Name
  masterSheet.getColumn(4).width = 25; // Designation
  
  masterSheet.mergeCells('A1:D1');
  const mTitle1 = masterSheet.getCell('A1');
  mTitle1.value = 'Project STAFF working schedule';
  mTitle1.font = { bold: true, size: 12 };
  mTitle1.alignment = { horizontal: 'center', vertical: 'middle' };

  masterSheet.mergeCells('A2:D2');
  const mTitle2 = masterSheet.getCell('A2');
  mTitle2.value = 'Maitenance Dredging at kakinada Deep water Port year 2025_07/Sep/25';
  mTitle2.font = { bold: true, size: 10, italic: true };
  mTitle2.alignment = { horizontal: 'center', vertical: 'middle' };

  masterSheet.getCell('A4').value = 'Department';
  masterSheet.getCell('B4').value = 'Employee ID';
  masterSheet.getCell('C4').value = 'Name';
  masterSheet.getCell('D4').value = 'Designation';
  for (let c = 1; c <= 4; c++) {
    masterSheet.getCell(4, c).font = { bold: true };
    masterSheet.getCell(4, c).alignment = { vertical: 'middle' };
  }

  const allProjects = [
    ...projects,
    { name: 'Leave', budgetCode: 'L', startDate: '', endDate: '' }
  ];

  allProjects.forEach((proj, idx) => {
    const startCol = 5 + idx * 2;
    const endCol = 6 + idx * 2;
    masterSheet.getColumn(startCol).width = 15;
    masterSheet.getColumn(endCol).width = 15;

    masterSheet.mergeCells(1, startCol, 1, endCol);
    const budgetLabel = masterSheet.getCell(1, startCol);
    budgetLabel.value = proj.name === 'Leave' ? 'Leave / Rotation' : 'Budget Code';
    budgetLabel.font = { bold: true };
    budgetLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    masterSheet.mergeCells(2, startCol, 2, endCol);
    const budgetVal = masterSheet.getCell(2, startCol);
    budgetVal.value = proj.budgetCode || '';
    budgetVal.font = { bold: true };
    budgetVal.alignment = { horizontal: 'center', vertical: 'middle' };

    const startCell = masterSheet.getCell(3, startCol);
    startCell.value = proj.name === 'Leave' ? 'Start' : formatToClientDate(proj.startDate);
    startCell.font = { bold: true };
    startCell.alignment = { horizontal: 'center' };

    const endCell = masterSheet.getCell(3, endCol);
    endCell.value = proj.name === 'Leave' ? 'End' : formatToClientDate(proj.endDate);
    endCell.font = { bold: true };
    endCell.alignment = { horizontal: 'center' };

    masterSheet.mergeCells(4, startCol, 4, endCol);
    const nameCell = masterSheet.getCell(4, startCol);
    nameCell.value = proj.name;
    nameCell.font = { bold: true };
    nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const sortedProfiles = [...profiles].sort((a, b) => {
    const deptCompare = (a.department || '').localeCompare(b.department || '');
    if (deptCompare !== 0) return deptCompare;
    return (a.name || '').localeCompare(b.name || '');
  });

  let currentRowIdx = 5;

  sortedProfiles.forEach((emp) => {
    const empAssignments = assignments.filter(a => a.employeeId === emp.id);
    const empLeaves = leaves.filter(l => l.employeeId === emp.id);

    if (empAssignments.length === 0 && empLeaves.length === 0) {
      const r = masterSheet.getRow(currentRowIdx);
      r.height = 20;
      r.getCell(1).value = emp.department;
      r.getCell(2).value = emp.id;
      r.getCell(3).value = emp.name;
      r.getCell(4).value = emp.designation;

      for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
        const cell = r.getCell(c);
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } }
        };
      }
      currentRowIdx++;
    } else {
      empAssignments.forEach(assign => {
        const r = masterSheet.getRow(currentRowIdx);
        r.height = 20;
        r.getCell(1).value = emp.department;
        r.getCell(2).value = emp.id;
        r.getCell(3).value = emp.name;
        r.getCell(4).value = emp.designation;

        allProjects.forEach((proj, pIdx) => {
          const startCol = 5 + pIdx * 2;
          const endCol = 6 + pIdx * 2;

          if (proj.name === assign.projectName) {
            r.getCell(startCol).value = formatToClientDate(assign.travelStartDate || proj.startDate);
            r.getCell(endCol).value = formatToClientDate(assign.travelEndDate || proj.endDate);
          } else {
            r.getCell(startCol).value = '';
            r.getCell(endCol).value = '';
          }
          r.getCell(startCol).alignment = { horizontal: 'center' };
          r.getCell(endCol).alignment = { horizontal: 'center' };
        });

        for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
          const cell = r.getCell(c);
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        }
        currentRowIdx++;
      });

      empLeaves.forEach(lv => {
        const r = masterSheet.getRow(currentRowIdx);
        r.height = 20;
        r.getCell(1).value = emp.department;
        r.getCell(2).value = emp.id;
        r.getCell(3).value = emp.name;
        r.getCell(4).value = emp.designation;

        allProjects.forEach((proj, pIdx) => {
          const startCol = 5 + pIdx * 2;
          const endCol = 6 + pIdx * 2;

          if (proj.name === 'Leave') {
            r.getCell(startCol).value = formatToClientDate(lv.fromDate);
            r.getCell(endCol).value = formatToClientDate(lv.toDate);
          } else {
            r.getCell(startCol).value = '';
            r.getCell(endCol).value = '';
          }
          r.getCell(startCol).alignment = { horizontal: 'center' };
          r.getCell(endCol).alignment = { horizontal: 'center' };
        });

        for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
          const cell = r.getCell(c);
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
          };
        }
        currentRowIdx++;
      });
    }
  });

  for (let rowNum = 1; rowNum <= 4; rowNum++) {
    const headerRow = masterSheet.getRow(rowNum);
    for (let c = 1; c <= 4 + allProjects.length * 2; c++) {
      const cell = headerRow.getCell(c);
      cell.border = {
        bottom: { style: 'thin', color: { argb: '94A3B8' } },
        right: { style: 'thin', color: { argb: '94A3B8' } }
      };
    }
  }

  masterSheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 4 }];

  // ==================== TAB 2: Planning Grid ====================
  const planningSheet = workbook.addWorksheet('Planning Grid');
  planningSheet.getColumn(1).width = 28; // Employee Name (A)
  planningSheet.getColumn(2).width = 22; // Designation (B)
  planningSheet.getColumn(3).width = 25; // Remarks (C)
  planningSheet.getColumn(4).width = 8;  // Timeline label padding (D)
  for (let i = 0; i < dates.length; i++) {
    planningSheet.getColumn(5 + i).width = 4.5; // Timeline starts from Column 5 (E)
  }

  let nextRow = 1;
  projects.forEach((project, projIdx) => {
    const projAssignments = assignments.filter(a => a.projectName === project.name);
    if (projAssignments.length === 0) return;

    if (projIdx > 0 || nextRow > 1) {
      nextRow += 2;
    }

    const r1 = planningSheet.getRow(nextRow);
    planningSheet.mergeCells(nextRow, 1, nextRow, 2);
    const budgetLabelCell = r1.getCell(1);
    budgetLabelCell.value = 'BUDGET - Project Name';
    budgetLabelCell.font = { bold: true, color: { argb: 'FFFFFF' } }; // White font
    budgetLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Premium Navy Blue
    budgetLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Fill background of cell B so the merged block is styled correctly
    r1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    
    r1.getCell(3).value = project.name;
    r1.getCell(3).font = { bold: true };
    r1.getCell(3).alignment = { vertical: 'middle' };

    const r2 = planningSheet.getRow(nextRow + 1);
    r2.getCell(3).value = project.budgetCode || '';
    r2.getCell(3).font = { bold: true };
    r2.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    const r4 = planningSheet.getRow(nextRow + 3);
    r4.getCell(1).value = 'Name';
    r4.getCell(1).font = { bold: true };
    r4.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(2).value = 'Designation';
    r4.getCell(2).font = { bold: true };
    r4.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(3).value = 'Remarks';
    r4.getCell(3).font = { bold: true };
    r4.getCell(3).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    // Set Column D labels for timeline headers
    planningSheet.getRow(nextRow + 2).getCell(4).value = 'Days';
    planningSheet.getRow(nextRow + 2).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 2).getCell(4).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow + 1).getCell(4).value = 'Week';
    planningSheet.getRow(nextRow + 1).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 1).getCell(4).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow).getCell(4).value = 'Date';
    planningSheet.getRow(nextRow).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow).getCell(4).alignment = { horizontal: 'center' };

    // Set Project Start and End in columns A and B of Row 3 (nextRow + 2)
    const r3 = planningSheet.getRow(nextRow + 2);
    
    r3.getCell(1).value = `Project Start - ${formatToClientDate(project.startDate)}`;
    r3.getCell(1).font = { bold: true, size: 10 };
    r3.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '92D050' } }; // Excel Lime Green
    r3.getCell(1).border = {
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } }
    };

    r3.getCell(2).value = `Project End - ${formatToClientDate(project.endDate)}`;
    r3.getCell(2).font = { bold: true, size: 10 };
    r3.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '92D050' } }; // Excel Lime Green
    r3.getCell(2).border = {
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } }
    };

    dates.forEach((d, idx) => {
      const colIdx = 5 + idx;
      const dayCell = r3.getCell(colIdx);
      dayCell.value = parseInt(d.dayNum, 10);
      dayCell.alignment = { horizontal: 'center' };
      dayCell.font = { size: 9, bold: true };
      
      if (d.isWeekend) {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      } else {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
      dayCell.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };

      const cell4 = r4.getCell(colIdx);
      cell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cell4.border = {
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    });

    let currentWeekNum = -1;
    let weekStartCol = -1;
    dates.forEach((d, idx) => {
      const colIdx = 5 + idx;
      if (d.weekNum !== currentWeekNum) {
        if (weekStartCol !== -1) {
          planningSheet.mergeCells(nextRow, weekStartCol, nextRow, colIdx - 1);
          planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, colIdx - 1);
        }
        currentWeekNum = d.weekNum;
        weekStartCol = colIdx;
        planningSheet.getRow(nextRow).getCell(colIdx).value = formatToClientDate(d.dateStr);
        planningSheet.getRow(nextRow + 1).getCell(colIdx).value = d.weekNum;
      }
    });
    if (weekStartCol !== -1) {
      planningSheet.mergeCells(nextRow, weekStartCol, nextRow, 5 + dates.length - 1);
      planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, 5 + dates.length - 1);
    }

    for (let c = 5; c < 5 + dates.length; c++) {
      const cellRow1 = planningSheet.getRow(nextRow).getCell(c);
      const cellRow2 = planningSheet.getRow(nextRow + 1).getCell(c);
      cellRow1.font = { bold: true, size: 9 };
      cellRow1.alignment = { horizontal: 'center' };
      cellRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow1.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

      cellRow2.font = { bold: true, size: 9 };
      cellRow2.alignment = { horizontal: 'center' };
      cellRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow2.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    }

    const employeesInProject: { id: string; name: string; designation: string; department: string; }[] = [];
    const uniqueEmpsInProj = new Set<string>();
    projAssignments.forEach(a => {
      if (!uniqueEmpsInProj.has(a.employeeId)) {
        uniqueEmpsInProj.add(a.employeeId);
        const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', designation: 'Unknown', department: 'Unknown' };
        employeesInProject.push({ id: a.employeeId, name: prof.name, designation: prof.designation, department: prof.department });
      }
    });

    const groupedByDept: Record<string, typeof employeesInProject> = {};
    employeesInProject.forEach(emp => {
      if (!groupedByDept[emp.department]) groupedByDept[emp.department] = [];
      groupedByDept[emp.department].push(emp);
    });

    nextRow += 4;
    Object.keys(groupedByDept).sort().forEach(dept => {
      const deptRow = planningSheet.getRow(nextRow);
      deptRow.height = 22;
      const totalGridCols = 4 + dates.length; // 4 summary columns + timeline dates
      for (let c = 1; c <= totalGridCols; c++) {
        const cell = deptRow.getCell(c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Premium Navy Blue
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.border = {
          bottom: { style: 'thin', color: { argb: '1E3A8A' } },
          right: { style: 'thin', color: { argb: '1E3A8A' } }
        };
      }
      deptRow.getCell(1).value = dept;
      deptRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      nextRow++;

      groupedByDept[dept].forEach(emp => {
        const empRow = planningSheet.getRow(nextRow);
        empRow.getCell(1).value = emp.name;
        empRow.getCell(2).value = emp.designation;

        const assign = assignments.find(a => a.employeeId === emp.id && a.projectName === project.name);
        const budgetCodeStr = project.budgetCode || '';
        const assignRemarks = assign?.remarks || '';
        const combinedRemarks = [budgetCodeStr, assignRemarks].filter(Boolean).join(' - ');
        empRow.getCell(3).value = combinedRemarks;

        dates.forEach((d, dIdx) => {
          const colIdx = 5 + dIdx;
          const cell = empRow.getCell(colIdx);
          let status = resolveStatusOnDate(emp.id, d.dateStr, assignments, projects, leaves, profiles);

          cell.value = status;
          cell.alignment = { horizontal: 'center' };
          const fill = getStatusFill(status);
          if (fill) {
            cell.fill = fill as any;
            cell.font = { bold: true, color: { argb: getStatusFontColor(status) } };
          }
          cell.border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
        });
        nextRow++;
      });
    });
  });

  const assignedEmpIds = new Set(assignments.map(a => a.employeeId));
  const standbyOnlyEmployees = profiles.filter(p => !assignedEmpIds.has(p.id));
  if (standbyOnlyEmployees.length > 0) {
    if (nextRow > 1) nextRow += 2;

    const r1 = planningSheet.getRow(nextRow);
    r1.getCell(1).value = 'STANDBY / UNALLOCATED STAFF';
    r1.getCell(1).font = { bold: true, color: { argb: 'F97316' } };

    const r4 = planningSheet.getRow(nextRow + 3);
    r4.getCell(1).value = 'Name';
    r4.getCell(1).font = { bold: true };
    r4.getCell(1).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(2).value = 'Designation';
    r4.getCell(2).font = { bold: true };
    r4.getCell(2).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    r4.getCell(3).value = 'Remarks';
    r4.getCell(3).font = { bold: true };
    r4.getCell(3).border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

    // Set Column D labels for timeline headers in standby block
    planningSheet.getRow(nextRow + 2).getCell(4).value = 'Days';
    planningSheet.getRow(nextRow + 2).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 2).getCell(4).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow + 1).getCell(4).value = 'Week';
    planningSheet.getRow(nextRow + 1).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow + 1).getCell(4).alignment = { horizontal: 'center' };

    planningSheet.getRow(nextRow).getCell(4).value = 'Date';
    planningSheet.getRow(nextRow).getCell(4).font = { bold: true, size: 9 };
    planningSheet.getRow(nextRow).getCell(4).alignment = { horizontal: 'center' };

    dates.forEach((d, idx) => {
      const colIdx = 5 + idx;
      const dayCell = planningSheet.getRow(nextRow + 2).getCell(colIdx);
      dayCell.value = parseInt(d.dayNum, 10);
      dayCell.alignment = { horizontal: 'center' };
      dayCell.font = { size: 9, bold: true };
      
      if (d.isWeekend) {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D1FAE5' } };
      } else {
        dayCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
      dayCell.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

      const cell4 = r4.getCell(colIdx);
      cell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cell4.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    });

    let currentWeekNum = -1;
    let weekStartCol = -1;
    dates.forEach((d, idx) => {
      const colIdx = 5 + idx;
      if (d.weekNum !== currentWeekNum) {
        if (weekStartCol !== -1) {
          planningSheet.mergeCells(nextRow, weekStartCol, nextRow, colIdx - 1);
          planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, colIdx - 1);
        }
        currentWeekNum = d.weekNum;
        weekStartCol = colIdx;
        planningSheet.getRow(nextRow).getCell(colIdx).value = formatToClientDate(d.dateStr);
        planningSheet.getRow(nextRow + 1).getCell(colIdx).value = d.weekNum;
      }
    });
    if (weekStartCol !== -1) {
      planningSheet.mergeCells(nextRow, weekStartCol, nextRow, 5 + dates.length - 1);
      planningSheet.mergeCells(nextRow + 1, weekStartCol, nextRow + 1, 5 + dates.length - 1);
    }

    for (let c = 5; c < 5 + dates.length; c++) {
      const cellRow1 = planningSheet.getRow(nextRow).getCell(c);
      const cellRow2 = planningSheet.getRow(nextRow + 1).getCell(c);
      cellRow1.font = { bold: true, size: 9 };
      cellRow1.alignment = { horizontal: 'center' };
      cellRow1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow1.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };

      cellRow2.font = { bold: true, size: 9 };
      cellRow2.alignment = { horizontal: 'center' };
      cellRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cellRow2.border = { bottom: { style: 'thin', color: { argb: 'CBD5E1' } }, right: { style: 'thin', color: { argb: 'CBD5E1' } } };
    }

    nextRow += 4;
    standbyOnlyEmployees.forEach(emp => {
      const empRow = planningSheet.getRow(nextRow);
      empRow.getCell(1).value = emp.name;
      empRow.getCell(2).value = emp.designation;
      empRow.getCell(3).value = 'Standby';

      dates.forEach((d, dIdx) => {
        const colIdx = 5 + dIdx;
        const cell = empRow.getCell(colIdx);
        const status = resolveStatusOnDate(emp.id, d.dateStr, assignments, projects, leaves, profiles);

        cell.value = status;
        cell.alignment = { horizontal: 'center' };
        const fill = getStatusFill(status);
        if (fill) {
          cell.fill = fill as any;
          cell.font = { bold: true, color: { argb: getStatusFontColor(status) } };
        }
        cell.border = { bottom: { style: 'thin', color: { argb: 'E2E8F0' } }, right: { style: 'thin', color: { argb: 'E2E8F0' } } };
      });
      nextRow++;
    });
  }
  planningSheet.views = [{ state: 'frozen', xSplit: 4, ySplit: 0 }];

  // ==================== TAB 3: Planning Summary ====================
  const summarySheet = workbook.addWorksheet('Planning Summary');
  summarySheet.columns = [
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Project Code', key: 'projectCode', width: 15 },
    { header: 'Allocated Start Date', key: 'projStart', width: 22 },
    { header: 'Allocated End Date', key: 'projEnd', width: 22 },
    { header: 'Leave Start Date', key: 'leaveStart', width: 18 },
    { header: 'Leave End Date', key: 'leaveEnd', width: 18 }
  ];

  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
  summarySheet.getRow(1).height = 25;
  summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  assignments.forEach(a => {
    const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', department: 'Unknown', designation: 'Unknown' };
    const proj = projects.find(p => p.name === a.projectName);
    
    // Find leaves for this employee on this project
    const empProjLeaves = leaves.filter(l => 
      l.employeeId === a.employeeId && 
      l.projectId === a.projectName
    );

    // 1. Try to find an exactly overlapping leave
    let assocLeave = empProjLeaves.find(l => 
      !(l.toDate < a.travelStartDate || l.fromDate > a.travelEndDate)
    );

    // 2. If no overlapping leave, find if this assignment is the closest one to any of the employee's project leaves
    if (!assocLeave) {
      const nonOverlappingLeaves = empProjLeaves.filter(l => {
        const overlapsAny = assignments.some(otherA => 
          otherA.employeeId === l.employeeId &&
          !(l.toDate < otherA.travelStartDate || l.fromDate > otherA.travelEndDate)
        );
        return !overlapsAny;
      });

      const matchingLeave = nonOverlappingLeaves.find(l => {
        const lDate = safeParseDate(l.fromDate);
        if (isNaN(lDate.getTime())) return false;

        const candidateAssignments = assignments.filter(otherA => 
          otherA.employeeId === a.employeeId && 
          otherA.projectName === a.projectName
        );

        if (candidateAssignments.length === 0) return false;

        let closestA = candidateAssignments[0];
        let minDiff = Infinity;

        candidateAssignments.forEach(otherA => {
          const aStart = safeParseDate(otherA.travelStartDate);
          if (isNaN(aStart.getTime())) return;
          const diff = Math.abs(lDate.getTime() - aStart.getTime());
          if (diff < minDiff) {
            minDiff = diff;
            closestA = otherA;
          }
        });

        return closestA.travelStartDate === a.travelStartDate && closestA.travelEndDate === a.travelEndDate;
      });

      if (matchingLeave) {
        assocLeave = matchingLeave;
      }
    }

    const newRow = summarySheet.addRow({
      name: prof.name,
      department: prof.department,
      designation: prof.designation,
      projectName: a.projectName,
      projectCode: proj?.budgetCode || '-',
      projStart: formatToClientDate(a.travelStartDate || ''),
      projEnd: formatToClientDate(a.travelEndDate || ''),
      leaveStart: assocLeave ? formatToClientDate(assocLeave.fromDate) : '',
      leaveEnd: assocLeave ? formatToClientDate(assocLeave.toDate) : ''
    });

    // Center values
    for (let c = 5; c <= 9; c++) {
      newRow.getCell(c).alignment = { horizontal: 'center' };
    }
  });

  // ==================== TAB 4: Attendance Grid ====================
  const attGridSheet = workbook.addWorksheet('Attendance Grid');
  const attBaseHeaders = ['Employee ID', 'Employee Name', 'Department', 'Designation', 'Project Name', 'Project Code', 'W', 'L', 'T', 'S', '%'];
  const attDateHeaders = dates.map(d => `${d.dayNum}\n${d.dayLabel[0]}`);


  
  attGridSheet.getRow(3).values = [...attBaseHeaders, ...attDateHeaders];
  attGridSheet.getRow(3).font = { bold: true, color: { argb: 'FFFFFF' }, size: 9 };
  attGridSheet.getRow(3).height = 28;

  // Row 1 & Row 2: Title Header (Merge A1 to K2)
  attGridSheet.mergeCells('A1:K2');
  attGridSheet.getRow(1).height = 25;
  attGridSheet.getRow(2).height = 20;
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = attGridSheet.getCell(r, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } }; // Premium Navy Blue
    }
  }
  const titleCell = attGridSheet.getCell('A1');
  titleCell.value = `STAFF PLANNING ATTENDANCE MATRIX (Period: ${formatToClientDate(startDate)} to ${formatToClientDate(endDate)})`;
  titleCell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 14 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Group dates by month for merging headers in Row 1 & 2 of the timeline
  let currentMonthStr = '';
  let monthStartCol = -1;
  dates.forEach((d, idx) => {
    const colIdx = 12 + idx; // Timeline starts at column 12 (L)
    if (d.monthLabel !== currentMonthStr) {
      if (monthStartCol !== -1) {
        attGridSheet.mergeCells(1, monthStartCol, 2, colIdx - 1);
        const cell = attGridSheet.getCell(1, monthStartCol);
        cell.value = currentMonthStr;
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        
        for (let r = 1; r <= 2; r++) {
          for (let c = monthStartCol; c <= colIdx - 1; c++) {
            attGridSheet.getCell(r, c).fill = { 
              type: 'pattern', 
              pattern: 'solid', 
              fgColor: { argb: '2563EB' } 
            };
            attGridSheet.getCell(r, c).border = {
              bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
              right: { style: 'thin', color: { argb: 'FFFFFF' } }
            };
          }
        }
      }
      currentMonthStr = d.monthLabel;
      monthStartCol = colIdx;
    }
  });

  if (monthStartCol !== -1) {
    const lastColIdx = 11 + dates.length;
    attGridSheet.mergeCells(1, monthStartCol, 2, lastColIdx);
    const cell = attGridSheet.getCell(1, monthStartCol);
    cell.value = currentMonthStr;
    cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    for (let r = 1; r <= 2; r++) {
      for (let c = monthStartCol; c <= lastColIdx; c++) {
        attGridSheet.getCell(r, c).fill = { 
          type: 'pattern', 
          pattern: 'solid', 
          fgColor: { argb: '2563EB' } 
        };
        attGridSheet.getCell(r, c).border = {
          bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFF' } }
        };
      }
    }
  }

  for (let c = 1; c <= 11 + dates.length; c++) {
    const cell = attGridSheet.getRow(3).getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }

  const attStatusCounts = dates.map(() => ({ W: 0, T: 0, L: 0, S: 0 }));
  profiles.forEach((prof) => {
    let w = 0, l = 0, t = 0, s = 0;
    const dailyStatusVals: string[] = [];

    dates.forEach((d, dIdx) => {
      const status = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves, profiles) || '';
      dailyStatusVals.push(status);
      if (status === 'W') { w++; attStatusCounts[dIdx].W++; }
      else if (status === 'L') { l++; attStatusCounts[dIdx].L++; }
      else if (status === 'T') { t++; attStatusCounts[dIdx].T++; }
      else if (status === 'S') { s++; attStatusCounts[dIdx].S++; }
    });

    const activeDays = w + t;
    const totalScheduled = w + t + l + s;
    const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

    const empAssignments = assignments.filter(a => a.employeeId === prof.id);
    const activeAss = empAssignments.find(a => {
      const foundProj = projects.find(p => p.name === a.projectName);
      const sStr = a.travelStartDate || foundProj?.startDate || '';
      const eStr = a.travelEndDate || foundProj?.endDate || '';
      return !(eStr < startDate || sStr > endDate);
    }) || empAssignments[0];
    const activeAssName = activeAss?.projectName || 'Unassigned';
    const foundProj = activeAss ? projects.find(p => p.name === activeAss.projectName) : null;
    const activeAssCode = foundProj?.budgetCode || '-';

    attGridSheet.addRow([
      prof.id,
      prof.name,
      prof.department,
      prof.designation,
      activeAssName,
      activeAssCode,
      w,
      l,
      t,
      s,
      `${rate}%`,
      ...dailyStatusVals
    ]);
  });

  const attSummaryKeys: { key: 'W' | 'T' | 'L' | 'S'; label: string }[] = [
    { key: 'W', label: 'Total Working (W)' },
    { key: 'L', label: 'Total Leave (L)' },
    { key: 'T', label: 'Total Travel (T)' },
    { key: 'S', label: 'Total Standby (S)' }
  ];

  attSummaryKeys.forEach(({ key, label }) => {
    const rowValues = [
      label, '', '', '', '', '', '', '', '', '', '',
      ...attStatusCounts.map(c => c[key] || 0)
    ];
    const row = attGridSheet.addRow(rowValues);
    row.font = { bold: true, size: 9 };
    row.getCell(1).alignment = { horizontal: 'left' };
    attGridSheet.mergeCells(row.number, 1, row.number, 11);
  });

  attGridSheet.getColumn(1).width = 15;
  attGridSheet.getColumn(2).width = 25;
  attGridSheet.getColumn(3).width = 20;
  attGridSheet.getColumn(4).width = 20;
  attGridSheet.getColumn(5).width = 25; // Project Name
  attGridSheet.getColumn(6).width = 15; // Project Code
  attGridSheet.getColumn(7).width = 6;  // W
  attGridSheet.getColumn(8).width = 6;  // L
  attGridSheet.getColumn(9).width = 6;  // T
  attGridSheet.getColumn(10).width = 6; // S
  attGridSheet.getColumn(11).width = 8; // %
  for (let c = 12; c <= 11 + dates.length; c++) {
    attGridSheet.getColumn(c).width = 5;
  }

  // Apply colors to Attendance Grid cells
  for (let r = 4; r <= profiles.length + 3; r++) {
    const row = attGridSheet.getRow(r);
    row.height = 22;
    const prof = profiles[r - 4];

    for (let c = 1; c <= 11 + dates.length; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: c <= 6 ? 'left' : 'center' };
      
      if (c >= 12) {
        const val = cell.value?.toString();
        if (val === 'W') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCE6F1' } };
          cell.font = { color: { argb: '000000' }, bold: true, size: 9 };
        } else if (val === 'T') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7C3AED' } };
          cell.font = { color: { argb: 'FFFFFF' }, bold: true, size: 9 };
        } else if (val === 'L') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F3E8FF' } };
          cell.font = { color: { argb: '000000' }, bold: true, size: 9 };
          
          if (prof) {
            const dateObj = dates[c - 12];
            const lRecord = leaves.find(l => 
              l.employeeId === prof.id &&
              dateObj.dateStr >= l.fromDate &&
              dateObj.dateStr <= l.toDate
            );
            if (lRecord) {
              cell.note = `Project ID: ${lRecord.projectId || 'None'}\nRemarks: ${lRecord.remarks || 'None'}`;
            }
          }
        } else if (val === 'S') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } };
          cell.font = { color: { argb: 'C2410C' }, bold: true, size: 9 };
        }
      }
    }
  }

  // ==================== TAB 5: Leave Details ====================
  const leaveDetailsSheet = workbook.addWorksheet('Leave Details');
  leaveDetailsSheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Employee Name', key: 'employeeName', width: 25 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Project Code', key: 'projectCode', width: 15 },
    { header: 'Leave Start Date', key: 'fromDate', width: 18 },
    { header: 'Leave End Date', key: 'toDate', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];

  leaveDetailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  leaveDetailsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } };
  leaveDetailsSheet.getRow(1).height = 25;
  leaveDetailsSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  const lStart = safeParseDate(startDate);
  const lEnd = safeParseDate(endDate);
  const activeL = leaves.filter(l => {
    const lFrom = safeParseDate(l.fromDate);
    const lTo = safeParseDate(l.toDate);
    if (isNaN(lFrom.getTime()) || isNaN(lTo.getTime())) return false;
    return !(lTo < lStart || lFrom > lEnd);
  });

  activeL.forEach(l => {
    const prof = profiles.find(p => p.id === l.employeeId);
    const proj = projects.find(p => p.name === l.projectId);
    leaveDetailsSheet.addRow({
      employeeId: l.employeeId,
      employeeName: l.employeeName,
      designation: prof?.designation || '-',
      projectName: l.projectId || 'None',
      projectCode: proj?.budgetCode || '-',
      fromDate: formatToClientDate(l.fromDate),
      toDate: formatToClientDate(l.toDate),
      remarks: l.remarks || ''
    });
  });

  // Save Consolidated File
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Consolidated_Staff_Planning_Report_${startDate}_to_${endDate}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportAuditLogToExcel(logs: any[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Change Audit Logs');

  sheet.columns = [
    { header: 'ID', key: 'id', width: 25 },
    { header: 'Operator (Who)', key: 'who', width: 20 },
    { header: 'Timestamp (When)', key: 'when', width: 25 },
    { header: 'Action', key: 'actionType', width: 15 },
    { header: 'Record Type', key: 'recordType', width: 15 },
    { header: 'Record ID', key: 'recordId', width: 15 },
    { header: 'Description', key: 'description', width: 45 },
    { header: 'Old Value (JSON)', key: 'oldValue', width: 35 },
    { header: 'New Value (JSON)', key: 'newValue', width: 35 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }
  };

  logs.forEach(log => {
    sheet.addRow({
      id: log.id,
      who: log.who,
      when: log.when,
      actionType: log.actionType.toUpperCase(),
      recordType: log.recordType.toUpperCase(),
      recordId: log.recordId,
      description: log.description,
      oldValue: log.oldValue ? JSON.stringify(log.oldValue) : '',
      newValue: log.newValue ? JSON.stringify(log.newValue) : ''
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HR_Staff_Planner_Audit_Logs_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function exportNewJoineeReviewsToExcel(reviews: ReviewRecord[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('New Joinee Reviews');

  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Employee Name', key: 'employeeName', width: 25 },
    { header: 'Department', key: 'department', width: 20 },
    { header: 'Designation', key: 'designation', width: 20 },
    { header: 'Joining Date', key: 'joiningDate', width: 15 },
    { header: 'Review Type', key: 'reviewType', width: 15 },
    { header: 'Due Date', key: 'dueDate', width: 15 },
    { header: 'Reviewer', key: 'reviewer', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Completion Date', key: 'completionDate', width: 18 },
    { header: 'Notes (MOM)', key: 'notes', width: 40 },
    { header: 'Feedback', key: 'feedback', width: 40 },
    { header: 'Action Items', key: 'actionItems', width: 40 },
    { header: 'Attachment', key: 'attachmentName', width: 25 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '4F46E5' } // Indigo
  };
  sheet.getRow(1).height = 25;
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

  reviews.forEach(r => {
    sheet.addRow({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      department: r.department,
      designation: r.designation,
      joiningDate: formatToClientDate(r.joiningDate),
      reviewType: r.reviewType,
      dueDate: formatToClientDate(r.dueDate),
      reviewer: r.reviewer || '-',
      status: r.status,
      completionDate: r.completionDate ? formatToClientDate(r.completionDate) : '-',
      notes: r.notes || '-',
      feedback: r.feedback || '-',
      actionItems: r.actionItems || '-',
      attachmentName: r.attachmentName || '-'
    });
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 20;
    for (let i = 1; i <= 14; i++) {
      const cell = row.getCell(i);
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `New_Joinee_Reviews_${new Date().toISOString().split('T')[0]}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
