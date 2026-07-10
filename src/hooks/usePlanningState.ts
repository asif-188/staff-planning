import { useState, useEffect } from 'react';

export interface EmployeeProfile {
  id: string; // Unique Employee ID
  name: string;
  department: string;
  function: string;
}

export interface ProjectDetails {
  name: string; // Unique Project Name
  budgetCode: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface ProjectAssignment {
  employeeId: string;
  projectName: string;
  travelStartDate: string; // YYYY-MM-DD
  travelEndDate: string;   // YYYY-MM-DD
  status: 'Working' | 'Leave' | 'Travelling';
  remarks: string;
}

// Keep the unified legacy interface for compatibility with other views
export interface Employee {
  id: string;
  name: string;
  department: string;
  function: string;
  project: string;
  budgetCode: string;
  projectStartDate: string;
  projectEndDate: string;
  travelStartDate: string;
  travelEndDate: string;
  status: 'Working' | 'Leave' | 'Travelling';
  remarks: string;
}

export interface AttendanceRecord {
  [key: string]: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD'; // key: `${employeeId}_${date}`
}

export interface ManualLeave {
  employeeId: string;
  date: string; // YYYY-MM-DD
}

const INITIAL_PROFILES: EmployeeProfile[] = [
  { id: "EMP001", name: "Mohd Asif", department: "Engineering", function: "Lead Architect" },
  { id: "EMP002", name: "Jane Doe", department: "Engineering", function: "Senior Developer" },
  { id: "EMP003", name: "Alice Smith", department: "Operations", function: "Project Manager" },
  { id: "EMP004", name: "Bob Johnson", department: "Engineering", function: "DevOps Engineer" },
  { id: "EMP005", name: "Charlie Brown", department: "Design", function: "UI/UX Designer" }
];

const INITIAL_PROJECTS: ProjectDetails[] = [
  { name: "Project Apollo", budgetCode: "BC-2026-ENG-01", startDate: "2026-05-01", endDate: "2026-06-30" },
  { name: "Project Titan", budgetCode: "BC-2026-OPS-03", startDate: "2026-05-15", endDate: "2026-08-15" },
  { name: "Project Genesis", budgetCode: "BC-2026-ENG-02", startDate: "2026-06-01", endDate: "2026-07-31" }
];

const INITIAL_ASSIGNMENTS: ProjectAssignment[] = [
  { employeeId: "EMP001", projectName: "Project Apollo", travelStartDate: "2026-05-01", travelEndDate: "2026-06-30", status: "Working", remarks: "Lead frontend architect" },
  { employeeId: "EMP002", projectName: "Project Apollo", travelStartDate: "2026-05-01", travelEndDate: "2026-06-30", status: "Working", remarks: "Database engineering" },
  { employeeId: "EMP003", projectName: "Project Titan", travelStartDate: "2026-05-15", travelEndDate: "2026-08-15", status: "Working", remarks: "Project management" },
  { employeeId: "EMP004", projectName: "Project Genesis", travelStartDate: "2026-06-01", travelEndDate: "2026-07-31", status: "Working", remarks: "Cloud deployment" },
  { employeeId: "EMP005", projectName: "Project Titan", travelStartDate: "2026-05-20", travelEndDate: "2026-07-20", status: "Travelling", remarks: "Design iterations" },
  { employeeId: "EMP001", projectName: "Project Titan", travelStartDate: "2026-07-01", travelEndDate: "2026-08-31", status: "Working", remarks: "Integration lead" }
];

export function usePlanningState() {
  const [profiles, setProfiles] = useState<EmployeeProfile[]>(() => {
    const saved = localStorage.getItem('v2_employee_profiles');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });

  const [projects, setProjects] = useState<ProjectDetails[]>(() => {
    const saved = localStorage.getItem('v2_projects_list');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [assignments, setAssignments] = useState<ProjectAssignment[]>(() => {
    const saved = localStorage.getItem('v2_assignments_list');
    return saved ? JSON.parse(saved) : INITIAL_ASSIGNMENTS;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord>(() => {
    const saved = localStorage.getItem('v2_attendance');
    return saved ? JSON.parse(saved) : {};
  });

  const [manualLeaves, setManualLeaves] = useState<ManualLeave[]>(() => {
    const saved = localStorage.getItem('v2_manual_leaves');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('v2_employee_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('v2_projects_list', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('v2_assignments_list', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    localStorage.setItem('v2_attendance', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem('v2_manual_leaves', JSON.stringify(manualLeaves));
  }, [manualLeaves]);

  // Employee Profile CRUD
  const addProfile = (p: EmployeeProfile) => {
    if (profiles.some(x => x.id === p.id)) {
      alert(`Error: Employee ID '${p.id}' already exists.`);
      return false;
    }
    setProfiles(prev => [...prev, p]);
    return true;
  };

  const editProfile = (index: number, updated: EmployeeProfile) => {
    setProfiles(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const deleteProfile = (index: number) => {
    const profile = profiles[index];
    setProfiles(prev => prev.filter((_, i) => i !== index));
    // Cascade delete assignments
    setAssignments(prev => prev.filter(a => a.employeeId !== profile.id));
  };

  // Projects CRUD
  const addProject = (p: ProjectDetails) => {
    if (projects.some(x => x.name.toLowerCase() === p.name.toLowerCase())) {
      alert(`Error: Project named '${p.name}' already exists.`);
      return false;
    }
    setProjects(prev => [...prev, p]);
    return true;
  };

  const editProject = (index: number, updated: ProjectDetails) => {
    const oldProj = projects[index];
    setProjects(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
    // Cascade update assignments if project name changes
    if (oldProj.name !== updated.name) {
      setAssignments(prev => prev.map(a => a.projectName === oldProj.name ? { ...a, projectName: updated.name } : a));
    }
  };

  const deleteProject = (index: number) => {
    const proj = projects[index];
    setProjects(prev => prev.filter((_, i) => i !== index));
    // Cascade delete assignments
    setAssignments(prev => prev.filter(a => a.projectName !== proj.name));
  };

  // Assignments CRUD
  const addAssignment = (a: ProjectAssignment) => {
    setAssignments(prev => [...prev, a]);
  };

  const editAssignment = (index: number, updated: ProjectAssignment) => {
    setAssignments(prev => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const deleteAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const bulkUpdateAssignments = (updatedList: ProjectAssignment[]) => {
    setAssignments(updatedList);
  };

  // Get Joined/Merged structure for Planning and views compatibility
  const getMergedAssignments = (): Employee[] => {
    return assignments.map(a => {
      const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', department: 'Unknown', function: 'Unknown' };
      
      let proj = { budgetCode: '', startDate: '', endDate: '' };
      if (a.projectName) {
        const foundProj = projects.find(p => p.name === a.projectName);
        if (foundProj) {
          proj = {
            budgetCode: foundProj.budgetCode,
            startDate: foundProj.startDate,
            endDate: foundProj.endDate
          };
        }
      }

      return {
        id: a.employeeId,
        name: prof.name,
        department: prof.department,
        function: prof.function,
        project: a.projectName || '',
        budgetCode: proj.budgetCode || '',
        projectStartDate: proj.startDate || '',
        projectEndDate: proj.endDate || '',
        travelStartDate: a.travelStartDate,
        travelEndDate: a.travelEndDate,
        status: a.status,
        remarks: a.remarks
      };
    });
  };

  // Set Manual Leaves
  const toggleManualLeave = (employeeId: string, date: string) => {
    setManualLeaves(prev => {
      const exists = prev.some(l => l.employeeId === employeeId && l.date === date);
      if (exists) {
        return prev.filter(l => !(l.employeeId === employeeId && l.date === date));
      } else {
        return [...prev, { employeeId, date }];
      }
    });
  };

  const addManualLeaveRange = (employeeId: string, startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const newLeaves: ManualLeave[] = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      newLeaves.push({ employeeId, date: dateStr });
    }

    setManualLeaves(prev => {
      const filtered = prev.filter(l => !(l.employeeId === employeeId && l.date >= startDateStr && l.date <= endDateStr));
      return [...filtered, ...newLeaves];
    });
  };

  // Attendance
  const setSingleAttendance = (employeeId: string, date: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => {
    setAttendance(prev => ({
      ...prev,
      [`${employeeId}_${date}`]: status
    }));
  };

  const setBulkAttendance = (employeeId: string, startDateStr: string, endDateStr: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const updates: AttendanceRecord = {};

    const idsToUpdate = employeeId === 'ALL' 
      ? profiles.map(p => p.id) 
      : [employeeId];

    idsToUpdate.forEach(id => {
      // Create a fresh Date pointer for each employee loop
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        updates[`${id}_${dateStr}`] = status;
      }
    });

    setAttendance(prev => ({
      ...prev,
      ...updates
    }));
  };

  return {
    profiles,
    projects,
    assignments,
    attendance,
    manualLeaves,
    addProfile,
    editProfile,
    deleteProfile,
    addProject,
    editProject,
    deleteProject,
    addAssignment,
    editAssignment,
    deleteAssignment,
    bulkUpdateAssignments,
    getMergedAssignments,
    toggleManualLeave,
    addManualLeaveRange,
    setSingleAttendance,
    setBulkAttendance,
  };
}
