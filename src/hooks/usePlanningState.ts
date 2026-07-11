import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';

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
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [projects, setProjects] = useState<ProjectDetails[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [manualLeaves, setManualLeaves] = useState<ManualLeave[]>([]);

  // Subscriptions to Firestore Collections with auto-seeding if empty
  useEffect(() => {
    const unsubscribeProfiles = onSnapshot(collection(db, 'profiles'), async (snapshot) => {
      const list: EmployeeProfile[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as EmployeeProfile);
      });
      if (snapshot.empty) {
        for (const p of INITIAL_PROFILES) {
          await setDoc(doc(db, 'profiles', p.id), {
            name: p.name,
            department: p.department,
            function: p.function
          });
        }
      } else {
        setProfiles(list);
      }
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'projects'), async (snapshot) => {
      const list: ProjectDetails[] = [];
      snapshot.forEach((doc) => {
        list.push({ name: doc.id, ...doc.data() } as ProjectDetails);
      });
      if (snapshot.empty) {
        for (const p of INITIAL_PROJECTS) {
          await setDoc(doc(db, 'projects', p.name), {
            budgetCode: p.budgetCode,
            startDate: p.startDate,
            endDate: p.endDate
          });
        }
      } else {
        setProjects(list);
      }
    });

    const unsubscribeAssignments = onSnapshot(collection(db, 'assignments'), async (snapshot) => {
      const list: ProjectAssignment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as any);
      });
      if (snapshot.empty) {
        for (const a of INITIAL_ASSIGNMENTS) {
          const docRef = doc(collection(db, 'assignments'));
          await setDoc(docRef, a);
        }
      } else {
        setAssignments(list);
      }
    });

    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const record: AttendanceRecord = {};
      snapshot.forEach((doc) => {
        record[doc.id] = doc.data().status;
      });
      setAttendance(record);
    });

    const unsubscribeLeaves = onSnapshot(collection(db, 'manualLeaves'), (snapshot) => {
      const list: ManualLeave[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as ManualLeave);
      });
      setManualLeaves(list);
    });

    return () => {
      unsubscribeProfiles();
      unsubscribeProjects();
      unsubscribeAssignments();
      unsubscribeAttendance();
      unsubscribeLeaves();
    };
  }, []);

  // Employee Profile CRUD
  const addProfile = (p: EmployeeProfile) => {
    if (profiles.some(x => x.id === p.id)) {
      alert(`Error: Employee ID '${p.id}' already exists.`);
      return false;
    }
    setDoc(doc(db, 'profiles', p.id), {
      name: p.name,
      department: p.department,
      function: p.function
    });
    return true;
  };

  const editProfile = async (_index: number, updated: EmployeeProfile) => {
    await setDoc(doc(db, 'profiles', updated.id), {
      name: updated.name,
      department: updated.department,
      function: updated.function
    });
  };

  const deleteProfile = async (index: number) => {
    const profile = profiles[index];
    const batch = writeBatch(db);
    
    // Delete profile doc
    batch.delete(doc(db, 'profiles', profile.id));
    
    // Cascade delete assignments
    const relatedAssignments = assignments.filter(a => a.employeeId === profile.id);
    relatedAssignments.forEach(a => {
      if ((a as any).id) {
        batch.delete(doc(db, 'assignments', (a as any).id));
      }
    });

    await batch.commit();
  };

  // Projects CRUD
  const addProject = (p: ProjectDetails) => {
    if (projects.some(x => x.name.toLowerCase() === p.name.toLowerCase())) {
      alert(`Error: Project named '${p.name}' already exists.`);
      return false;
    }
    setDoc(doc(db, 'projects', p.name), {
      budgetCode: p.budgetCode,
      startDate: p.startDate,
      endDate: p.endDate
    });
    return true;
  };

  const editProject = async (index: number, updated: ProjectDetails) => {
    const oldProj = projects[index];
    const batch = writeBatch(db);

    if (oldProj.name !== updated.name) {
      // Name changed: delete old doc and create new one
      batch.delete(doc(db, 'projects', oldProj.name));
      batch.set(doc(db, 'projects', updated.name), {
        budgetCode: updated.budgetCode,
        startDate: updated.startDate,
        endDate: updated.endDate
      });

      // Cascade update assignments
      const relatedAssignments = assignments.filter(a => a.projectName === oldProj.name);
      relatedAssignments.forEach(a => {
        if ((a as any).id) {
          batch.update(doc(db, 'assignments', (a as any).id), { projectName: updated.name });
        }
      });
    } else {
      batch.set(doc(db, 'projects', updated.name), {
        budgetCode: updated.budgetCode,
        startDate: updated.startDate,
        endDate: updated.endDate
      });
    }

    await batch.commit();
  };

  const deleteProject = async (index: number) => {
    const proj = projects[index];
    const batch = writeBatch(db);

    // Delete project doc
    batch.delete(doc(db, 'projects', proj.name));

    // Cascade delete assignments
    const relatedAssignments = assignments.filter(a => a.projectName === proj.name);
    relatedAssignments.forEach(a => {
      if ((a as any).id) {
        batch.delete(doc(db, 'assignments', (a as any).id));
      }
    });

    await batch.commit();
  };

  // Assignments CRUD
  const addAssignment = async (a: ProjectAssignment) => {
    const docRef = doc(collection(db, 'assignments'));
    await setDoc(docRef, a);
  };

  const editAssignment = async (index: number, updated: ProjectAssignment) => {
    const oldAssignment = assignments[index];
    if (oldAssignment && (oldAssignment as any).id) {
      const docId = (oldAssignment as any).id;
      await setDoc(doc(db, 'assignments', docId), updated);
    }
  };

  const deleteAssignment = async (index: number) => {
    const oldAssignment = assignments[index];
    if (oldAssignment && (oldAssignment as any).id) {
      const docId = (oldAssignment as any).id;
      await deleteDoc(doc(db, 'assignments', docId));
    }
  };

  const bulkUpdateAssignments = async (updatedList: ProjectAssignment[]) => {
    const batch = writeBatch(db);
    
    // Delete all current assignments
    assignments.forEach(a => {
      if ((a as any).id) {
        batch.delete(doc(db, 'assignments', (a as any).id));
      }
    });

    // Write all updated assignments
    updatedList.forEach(a => {
      const docRef = doc(collection(db, 'assignments'));
      batch.set(docRef, a);
    });

    await batch.commit();
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
  const toggleManualLeave = async (employeeId: string, date: string) => {
    const docId = `${employeeId}_${date}`;
    const exists = manualLeaves.some(l => l.employeeId === employeeId && l.date === date);
    if (exists) {
      await deleteDoc(doc(db, 'manualLeaves', docId));
    } else {
      await setDoc(doc(db, 'manualLeaves', docId), { employeeId, date });
    }
  };

  const addManualLeaveRange = async (employeeId: string, startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const batch = writeBatch(db);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const docId = `${employeeId}_${dateStr}`;
      batch.set(doc(db, 'manualLeaves', docId), { employeeId, date: dateStr });
    }

    await batch.commit();
  };

  // Attendance
  const setSingleAttendance = async (employeeId: string, date: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => {
    await setDoc(doc(db, 'attendance', `${employeeId}_${date}`), { status });
  };

  const setBulkAttendance = async (employeeId: string, startDateStr: string, endDateStr: string, status: 'W' | 'L' | 'T' | 'A' | 'H' | 'HD') => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const batch = writeBatch(db);

    const idsToUpdate = employeeId === 'ALL' 
      ? profiles.map(p => p.id) 
      : [employeeId];

    idsToUpdate.forEach(id => {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const docId = `${id}_${dateStr}`;
        batch.set(doc(db, 'attendance', docId), { status });
      }
    });

    await batch.commit();
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
