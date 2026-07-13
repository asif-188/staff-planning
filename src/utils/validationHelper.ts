import type { EmployeeProfile, ProjectAssignment, ProjectDetails, LeaveRecord } from '../hooks/usePlanningState';
import { safeParseDate, formatToClientDate, resolveStatusOnDate } from './timelineHelper';
import ExcelJS from 'exceljs';

export interface ValidationIssue {
  id: string;
  severity: 'Error' | 'Warning';
  recordType: 'Employee' | 'Project' | 'Assignment' | 'Leave' | 'Attendance';
  employeeId?: string;
  employeeName?: string;
  projectName?: string;
  recordIndex?: number;
  message: string;
  resolution: string;
}

export function validateMasterPlanningData(
  profiles: EmployeeProfile[],
  projects: ProjectDetails[],
  assignments: ProjectAssignment[],
  leaves: LeaveRecord[],
  attendance: Record<string, string>
): {
  totalRecordsChecked: number;
  validRecordsCount: number;
  issues: ValidationIssue[];
  errorsCount: number;
  warningsCount: number;
} {
  const issues: ValidationIssue[] = [];
  let issueId = 1;
  
  const addIssue = (
    severity: 'Error' | 'Warning',
    recordType: 'Employee' | 'Project' | 'Assignment' | 'Leave' | 'Attendance',
    message: string,
    resolution: string,
    extra: Partial<Omit<ValidationIssue, 'id' | 'severity' | 'recordType' | 'message' | 'resolution'>> = {}
  ) => {
    issues.push({
      id: `issue_${issueId++}`,
      severity,
      recordType,
      message,
      resolution,
      ...extra
    });
  };

  const totalRecordsChecked = profiles.length + projects.length + assignments.length + leaves.length;

  // 1. Employee Validation
  const empIds = new Set<string>();
  const duplicateEmpIds = new Set<string>();
  
  profiles.forEach((p, idx) => {
    if (!p.id) {
      addIssue('Error', 'Employee', `Employee profile at row ${idx + 1} has a missing Employee ID.`, 'Ensure every employee has a unique Employee ID.', { recordIndex: idx });
    } else {
      if (empIds.has(p.id)) {
        duplicateEmpIds.add(p.id);
      }
      empIds.add(p.id);
    }

    if (!p.name) {
      addIssue('Error', 'Employee', `Employee profile (ID: ${p.id || 'Missing'}) has a missing Employee Name.`, 'Provide a valid name for the employee.', { recordIndex: idx, employeeId: p.id });
    }
  });

  duplicateEmpIds.forEach(id => {
    addIssue('Error', 'Employee', `Duplicate Employee ID detected: ${id}.`, 'Ensure Employee IDs are unique across all profiles.', { employeeId: id });
  });

  // 2. Project Validation
  projects.forEach((proj, idx) => {
    if (!proj.name) {
      addIssue('Error', 'Project', `Project details at row ${idx + 1} has a missing Project Name.`, 'Provide a unique Project Name.', { recordIndex: idx });
    }

    const start = safeParseDate(proj.startDate);
    const end = safeParseDate(proj.endDate);

    if (!proj.startDate || isNaN(start.getTime())) {
      addIssue('Error', 'Project', `Project "${proj.name || 'Unknown'}" has an empty or invalid Start Date.`, 'Provide a valid Project Start Date.', { recordIndex: idx, projectName: proj.name });
    }

    if (!proj.endDate || isNaN(end.getTime())) {
      addIssue('Error', 'Project', `Project "${proj.name || 'Unknown'}" has an empty or invalid End Date.`, 'Provide a valid Project End Date.', { recordIndex: idx, projectName: proj.name });
    }

    if (proj.startDate && proj.endDate && start > end) {
      addIssue('Error', 'Project', `Project "${proj.name}" End Date (${proj.endDate}) is earlier than Start Date (${proj.startDate}).`, 'Modify dates so that End Date is equal to or after Start Date.', { recordIndex: idx, projectName: proj.name });
    }

    if (!proj.budgetCode) {
      addIssue('Warning', 'Project', `Project "${proj.name}" is missing a Budget Code.`, 'Provide a valid Budget Code.', { recordIndex: idx, projectName: proj.name });
    }
  });

  // 3. Project Assignment Validation
  assignments.forEach((a, idx) => {
    if (!a.employeeId) {
      addIssue('Error', 'Assignment', `Project assignment at row ${idx + 1} has a missing Employee ID.`, 'Select an employee for the project assignment.', { recordIndex: idx });
    } else {
      const empExists = profiles.some(p => p.id === a.employeeId);
      if (!empExists) {
        addIssue('Error', 'Assignment', `Project assignment references Employee ID "${a.employeeId}", which does not exist in profiles.`, 'Add the employee profile first or correct the Employee ID.', { recordIndex: idx, employeeId: a.employeeId });
      }
    }

    if (!a.projectName || a.projectName === 'None') {
      addIssue('Error', 'Assignment', `Project assignment (Emp ID: ${a.employeeId}) has a missing Project Name.`, 'Select a valid project name.', { recordIndex: idx, employeeId: a.employeeId });
    } else {
      const projExists = projects.some(p => p.name === a.projectName);
      if (!projExists) {
        addIssue('Error', 'Assignment', `Project assignment references Project Name "${a.projectName}", which does not exist.`, 'Create the project first or select a valid project.', { recordIndex: idx, employeeId: a.employeeId, projectName: a.projectName });
      }
    }

    const start = safeParseDate(a.travelStartDate);
    const end = safeParseDate(a.travelEndDate);

    if (a.travelStartDate && isNaN(start.getTime())) {
      addIssue('Error', 'Assignment', `Assignment for Travel Start Date "${a.travelStartDate}" is invalid.`, 'Correct the start date format.', { recordIndex: idx, employeeId: a.employeeId, projectName: a.projectName });
    }

    if (a.travelEndDate && isNaN(end.getTime())) {
      addIssue('Error', 'Assignment', `Assignment for Travel End Date "${a.travelEndDate}" is invalid.`, 'Correct the end date format.', { recordIndex: idx, employeeId: a.employeeId, projectName: a.projectName });
    }

    if (a.travelStartDate && a.travelEndDate && start > end) {
      addIssue('Error', 'Assignment', `Assignment for Emp ID "${a.employeeId}" has a Travel End Date earlier than Travel Start Date.`, 'Ensure travel end date is equal to or after start date.', { recordIndex: idx, employeeId: a.employeeId, projectName: a.projectName });
    }
  });

  // Overlapping project assignments check
  profiles.forEach(prof => {
    const empAssigns = assignments.map((a, idx) => ({ a, idx })).filter(x => x.a.employeeId === prof.id);
    for (let i = 0; i < empAssigns.length; i++) {
      for (let j = i + 1; j < empAssigns.length; j++) {
        const a1 = empAssigns[i].a;
        const a2 = empAssigns[j].a;

        const p1 = projects.find(p => p.name === a1.projectName);
        const p2 = projects.find(p => p.name === a2.projectName);

        const s1 = safeParseDate(a1.travelStartDate || p1?.startDate || '');
        const e1 = safeParseDate(a1.travelEndDate || p1?.endDate || '');
        const s2 = safeParseDate(a2.travelStartDate || p2?.startDate || '');
        const e2 = safeParseDate(a2.travelEndDate || p2?.endDate || '');

        if (!isNaN(s1.getTime()) && !isNaN(e1.getTime()) && !isNaN(s2.getTime()) && !isNaN(e2.getTime())) {
          const overlap = !(e1 < s2 || s1 > e2);
          if (overlap) {
            if (a1.projectName === a2.projectName) {
              addIssue('Error', 'Assignment', `Duplicate assignments detected for employee ${prof.name} (${prof.id}) on Project "${a1.projectName}" during overlapping dates.`, 'Remove one of the duplicate assignments.', { employeeId: prof.id, employeeName: prof.name, recordIndex: empAssigns[i].idx });
            } else {
              addIssue('Warning', 'Assignment', `Employee ${prof.name} (${prof.id}) has overlapping project assignments: "${a1.projectName}" and "${a2.projectName}".`, 'Verify date allocations to ensure double allocation is intended.', { employeeId: prof.id, employeeName: prof.name, recordIndex: empAssigns[i].idx });
            }
          }
        }
      }
    }
  });

  // 4. Leave Validation
  leaves.forEach((l, idx) => {
    if (!l.employeeId) {
      addIssue('Error', 'Leave', `Leave record at row ${idx + 1} has a missing Employee ID.`, 'Select an employee for the leave record.', { recordIndex: idx });
    }

    const from = safeParseDate(l.fromDate);
    const to = safeParseDate(l.toDate);

    if (!l.fromDate || isNaN(from.getTime())) {
      addIssue('Error', 'Leave', `Leave record (Emp ID: ${l.employeeId}) has a missing or invalid From Date.`, 'Provide a valid From Date.', { recordIndex: idx, employeeId: l.employeeId });
    }

    if (!l.toDate || isNaN(to.getTime())) {
      addIssue('Error', 'Leave', `Leave record (Emp ID: ${l.employeeId}) has a missing or invalid To Date.`, 'Provide a valid To Date.', { recordIndex: idx, employeeId: l.employeeId });
    }

    if (l.fromDate && l.toDate && from > to) {
      addIssue('Error', 'Leave', `Leave record for Emp ID "${l.employeeId}" has To Date earlier than From Date.`, 'Ensure leave To Date is after or equal to From Date.', { recordIndex: idx, employeeId: l.employeeId });
    }
  });

  // Overlapping approved leaves check
  profiles.forEach(prof => {
    const empLeaves = leaves.map((l, idx) => ({ l, idx })).filter(x => x.l.employeeId === prof.id && x.l.status === 'Approved');
    for (let i = 0; i < empLeaves.length; i++) {
      for (let j = i + 1; j < empLeaves.length; j++) {
        const l1 = empLeaves[i].l;
        const l2 = empLeaves[j].l;

        const f1 = safeParseDate(l1.fromDate);
        const t1 = safeParseDate(l1.toDate);
        const f2 = safeParseDate(l2.fromDate);
        const t2 = safeParseDate(l2.toDate);

        if (!isNaN(f1.getTime()) && !isNaN(t1.getTime()) && !isNaN(f2.getTime()) && !isNaN(t2.getTime())) {
          const overlap = !(t1 < f2 || f1 > t2);
          if (overlap) {
            addIssue('Error', 'Leave', `Employee ${prof.name} (${prof.id}) has overlapping approved leave records: (${l1.fromDate} to ${l1.toDate}) and (${l2.fromDate} to ${l2.toDate}).`, 'Reject or delete one of the conflicting leave requests.', { employeeId: prof.id, employeeName: prof.name, recordIndex: empLeaves[i].idx });
          }
        }
      }
    }
  });


  // 6. Attendance records check
  Object.keys(attendance || {}).forEach(key => {
    const parts = key.split('_');
    if (parts.length === 2) {
      const empId = parts[0];
      const dateStr = parts[1];
      const manualStatus = attendance[key];

      const expectedStatus = resolveStatusOnDate(empId, dateStr, assignments, projects, leaves);
      if (manualStatus && expectedStatus && manualStatus !== expectedStatus) {
        const prof = profiles.find(p => p.id === empId);
        addIssue('Warning', 'Attendance', `Attendance status mismatch for ${prof?.name || empId} on ${formatToClientDate(dateStr)}. Manual: ${manualStatus}, System: ${expectedStatus}.`, 'Align manual attendance status or modify schedule dates.', { employeeId: empId, employeeName: prof?.name });
      }
    }
  });

  const errorsCount = issues.filter(i => i.severity === 'Error').length;
  const warningsCount = issues.filter(i => i.severity === 'Warning').length;
  const validRecordsCount = totalRecordsChecked - errorsCount;

  return {
    totalRecordsChecked,
    validRecordsCount: validRecordsCount < 0 ? 0 : validRecordsCount,
    issues,
    errorsCount,
    warningsCount
  };
}

export async function exportValidationReportToExcel(issues: ValidationIssue[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Validation Report');

  sheet.columns = [
    { header: 'Issue ID', key: 'id', width: 12 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'Record Type', key: 'recordType', width: 15 },
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'Employee Name', key: 'employeeName', width: 25 },
    { header: 'Project Name', key: 'projectName', width: 25 },
    { header: 'Row Index', key: 'recordIndex', width: 12 },
    { header: 'Issue Description', key: 'message', width: 45 },
    { header: 'Suggested Resolution', key: 'resolution', width: 45 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' }
  };
  sheet.getRow(1).height = 25;
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  issues.forEach(i => {
    const row = sheet.addRow({
      id: i.id,
      severity: i.severity,
      recordType: i.recordType,
      employeeId: i.employeeId || '-',
      employeeName: i.employeeName || '-',
      projectName: i.projectName || '-',
      recordIndex: i.recordIndex !== undefined ? i.recordIndex + 1 : '-',
      message: i.message,
      resolution: i.resolution
    });

    const severityCell = row.getCell(2);
    if (i.severity === 'Error') {
      severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      severityCell.font = { color: { argb: '991B1B' }, bold: true };
    } else {
      severityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      severityCell.font = { color: { argb: '92400E' }, bold: true };
    }

    row.getCell(8).alignment = { wrapText: true };
    row.getCell(9).alignment = { wrapText: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Validation_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}
