import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { resolveStatusOnDate } from '../utils/timelineHelper';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { format } from 'date-fns';

export interface EmployeeProfile {
  id: string; // Unique Employee ID
  name: string;
  department: string;
  designation: string;
  status?: 'Work' | 'Standby' | '';
  joiningDate?: string; // YYYY-MM-DD
}

export interface ReviewRecord {
  id: string; // doc ID format: empId_days
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  joiningDate: string;
  reviewType: '30 Days' | '90 Days' | '180 Days';
  dueDate: string; // Calculated dynamically
  reviewer: string;
  status: 'Pending' | 'Scheduled' | 'Completed' | 'Overdue';
  completionDate?: string;
  notes?: string;
  feedback?: string;
  actionItems?: string;
  attachmentName?: string;
  outlookEventCreated?: boolean;
  powerAutomateTriggered?: boolean;
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
  status: 'Work' | 'Standby' | 'Working' | 'Leave' | 'Travelling';
  remarks: string;
}

// Keep the unified legacy interface for compatibility with other views
export interface Employee {
  id: string;
  name: string;
  department: string;
  designation: string;
  project: string;
  budgetCode: string;
  projectStartDate: string;
  projectEndDate: string;
  travelStartDate: string;
  travelEndDate: string;
  status: 'Work' | 'Standby' | 'Leave' | 'Working' | 'Travelling';
  remarks: string;
}

export interface AttendanceRecord {
  [key: string]: 'W' | 'L' | 'T' | 'S'; // key: `${employeeId}_${date}`
}

export interface ManualLeave {
  employeeId: string;
  date: string; // YYYY-MM-DD
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  remarks: string;
  projectId: string; // Project ID
}

export interface RecycleBinItem {
  id: string;
  type: 'profile' | 'project' | 'assignment' | 'leave';
  originalId: string;
  data: any;
  deletedAt: string; // ISO string
}

export interface AuditLogEntry {
  id: string;
  who: string;
  when: string; // ISO string
  actionType: 'create' | 'update' | 'delete' | 'restore';
  recordType: 'profile' | 'project' | 'assignment' | 'leave';
  recordId: string;
  oldValue: any;
  newValue: any;
  description: string;
}

export function usePlanningState() {
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [projects, setProjects] = useState<ProjectDetails[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord>({});
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);

  const logChange = async (
    actionType: 'create' | 'update' | 'delete' | 'restore',
    recordType: 'profile' | 'project' | 'assignment' | 'leave',
    recordId: string,
    oldValue: any,
    newValue: any,
    description: string
  ) => {
    const activeUser = localStorage.getItem('v2_active_operator_name') || 'HR Administrator';
    const logDoc = doc(collection(db, 'staff_audit_logs'));
    await setDoc(logDoc, {
      who: activeUser,
      when: new Date().toISOString(),
      actionType,
      recordType,
      recordId,
      oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
      description
    });
  };

  // Recycle Bin 30-day retention prune
  useEffect(() => {
    if (recycleBin.length === 0) return;
    const pruneExpiredItems = async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const batch = writeBatch(db);
      let count = 0;
      recycleBin.forEach(item => {
        if (item.deletedAt) {
          const deletedDate = new Date(item.deletedAt);
          if (deletedDate < thirtyDaysAgo) {
            batch.delete(doc(db, 'staff_recycle_bin', item.id));
            count++;
          }
        }
      });
      if (count > 0) {
        await batch.commit();
        console.log(`Auto Audit: Pruned ${count} recycle bin records older than 30 days.`);
      }
    };
    pruneExpiredItems();
  }, [recycleBin]);

  // Subscriptions to Firestore Collections
  useEffect(() => {
    const unsubscribeProfiles = onSnapshot(collection(db, 'staff_profiles'), (snapshot) => {
      const list: EmployeeProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const designation = data.designation || data.function || '';
        list.push({
          id: doc.id,
          name: data.name || '',
          department: data.department || '',
          designation,
          status: data.status || '',
          joiningDate: data.joiningDate || ''
        });
      });
      setProfiles(list);
    });

    const unsubscribeProjects = onSnapshot(collection(db, 'staff_projects'), (snapshot) => {
      const list: ProjectDetails[] = [];
      snapshot.forEach((doc) => {
        list.push({ name: doc.id, ...doc.data() } as ProjectDetails);
      });
      setProjects(list);
    });

    const unsubscribeAssignments = onSnapshot(collection(db, 'staff_assignments'), (snapshot) => {
      const list: ProjectAssignment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as any);
      });
      setAssignments(list);
    });

    const unsubscribeAttendance = onSnapshot(collection(db, 'staff_attendance'), (snapshot) => {
      const record: AttendanceRecord = {};
      snapshot.forEach((doc) => {
        record[doc.id] = doc.data().status;
      });
      setAttendance(record);
    });

    const unsubscribeLeaves = onSnapshot(collection(db, 'staff_leaves'), (snapshot) => {
      const list: LeaveRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as LeaveRecord);
      });
      setLeaves(list);
    });

    const unsubscribeRecycleBin = onSnapshot(collection(db, 'staff_recycle_bin'), (snapshot) => {
      const list: RecycleBinItem[] = [];
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as RecycleBinItem;
        if (item.type === 'profile' && item.data) {
          item.data.designation = item.data.designation || item.data.function || '';
        }
        list.push(item);
      });
      setRecycleBin(list);
    });

    const unsubscribeAuditLogs = onSnapshot(collection(db, 'staff_audit_logs'), (snapshot) => {
      const list: AuditLogEntry[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as AuditLogEntry);
      });
      list.sort((a, b) => b.when.localeCompare(a.when));
      setAuditLogs(list);
    });

    const unsubscribeReviews = onSnapshot(collection(db, 'new_joinee_reviews'), (snapshot) => {
      const list: ReviewRecord[] = [];
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      snapshot.forEach((doc) => {
        const data = doc.data();
        let status = data.status || 'Pending';
        if (status !== 'Completed' && data.dueDate && data.dueDate < todayStr) {
          status = 'Overdue';
        }
        list.push({
          id: doc.id,
          employeeId: data.employeeId || '',
          employeeName: data.employeeName || '',
          department: data.department || '',
          designation: data.designation || '',
          joiningDate: data.joiningDate || '',
          reviewType: data.reviewType || '30 Days',
          dueDate: data.dueDate || '',
          reviewer: data.reviewer || '',
          status,
          completionDate: data.completionDate,
          notes: data.notes,
          feedback: data.feedback,
          actionItems: data.actionItems,
          attachmentName: data.attachmentName,
          outlookEventCreated: !!data.outlookEventCreated,
          powerAutomateTriggered: !!data.powerAutomateTriggered
        });
      });
      setReviews(list);
    });

    return () => {
      unsubscribeProfiles();
      unsubscribeProjects();
      unsubscribeAssignments();
      unsubscribeAttendance();
      unsubscribeLeaves();
      unsubscribeRecycleBin();
      unsubscribeAuditLogs();
      unsubscribeReviews();
    };
  }, []);

  // Employee Profile CRUD
  const addProfile = async (p: EmployeeProfile) => {
    if (profiles.some(x => x.id === p.id)) {
      alert(`Error: Employee ID '${p.id}' already exists.`);
      return false;
    }
    await setDoc(doc(db, 'staff_profiles', p.id), {
      name: p.name,
      department: p.department,
      designation: p.designation,
      status: p.status || '',
      joiningDate: p.joiningDate || ''
    });
    await logChange('create', 'profile', p.id, null, p, `Created employee profile: ${p.name} (${p.id})`);
    return true;
  };

  const editProfile = async (_index: number, updated: EmployeeProfile) => {
    const oldVal = profiles.find(x => x.id === updated.id);
    await setDoc(doc(db, 'staff_profiles', updated.id), {
      name: updated.name,
      department: updated.department,
      designation: updated.designation,
      status: updated.status || '',
      joiningDate: updated.joiningDate || ''
    });
    await logChange('update', 'profile', updated.id, oldVal, updated, `Updated employee profile: ${updated.name} (${updated.id})`);
  };

  const deleteProfile = async (index: number) => {
    const profile = profiles[index];
    const batch = writeBatch(db);
    
    // Save profile to Recycle Bin
    const profileRecycleDoc = doc(collection(db, 'staff_recycle_bin'));
    batch.set(profileRecycleDoc, {
      type: 'profile',
      originalId: profile.id,
      data: {
        name: profile.name,
        department: profile.department,
        designation: profile.designation
      },
      deletedAt: new Date().toISOString()
    });

    // Delete profile doc
    batch.delete(doc(db, 'staff_profiles', profile.id));
    
    // Cascade delete reviews
    const relatedReviews = reviews.filter(r => r.employeeId === profile.id);
    relatedReviews.forEach(r => {
      batch.delete(doc(db, 'new_joinee_reviews', r.id));
    });
    
    // Cascade delete & recycle assignments
    const relatedAssignments = assignments.filter(a => a.employeeId === profile.id);
    relatedAssignments.forEach(a => {
      if ((a as any).id) {
        const docId = (a as any).id;
        const assignRecycleDoc = doc(collection(db, 'staff_recycle_bin'));
        batch.set(assignRecycleDoc, {
          type: 'assignment',
          originalId: docId,
          data: {
            employeeId: a.employeeId,
            projectName: a.projectName,
            travelStartDate: a.travelStartDate,
            travelEndDate: a.travelEndDate,
            status: a.status,
            remarks: a.remarks
          },
          deletedAt: new Date().toISOString()
        });
        batch.delete(doc(db, 'staff_assignments', docId));
      }
    });

    await batch.commit();
    await logChange('delete', 'profile', profile.id, profile, null, `Deleted employee profile: ${profile.name} (${profile.id})`);
  };

  // Auto-sync reviews when profiles change
  useEffect(() => {
    if (profiles.length === 0) return;
    
    const syncAllReviews = async () => {
      const batch = writeBatch(db);
      let needsCommit = false;

      profiles.forEach(p => {
        if (!p.joiningDate) return;

        const reviewDays = [30, 90, 180];
        const labels: Record<number, '30 Days' | '90 Days' | '180 Days'> = {
          30: '30 Days',
          90: '90 Days',
          180: '180 Days'
        };

        reviewDays.forEach(days => {
          const reviewId = `${p.id}_${days}`;
          const existing = reviews.find(r => r.id === reviewId);
          
          let dueDateStr = '';
          try {
            const d = new Date(p.joiningDate!);
            d.setDate(d.getDate() + days);
            dueDateStr = format(d, 'yyyy-MM-dd');
          } catch {
            return;
          }

          if (!existing) {
            needsCommit = true;
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const isOverdue = dueDateStr < todayStr;
            batch.set(doc(db, 'new_joinee_reviews', reviewId), {
              id: reviewId,
              employeeId: p.id,
              employeeName: p.name,
              department: p.department,
              designation: p.designation,
              joiningDate: p.joiningDate,
              reviewType: labels[days],
              dueDate: dueDateStr,
              reviewer: '',
              status: isOverdue ? 'Overdue' : 'Pending',
              outlookEventCreated: false,
              powerAutomateTriggered: false
            });
          } else {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const isOverdue = dueDateStr < todayStr;
            
            const isDifferent = 
              existing.employeeName !== p.name ||
              existing.department !== p.department ||
              existing.designation !== p.designation ||
              existing.joiningDate !== p.joiningDate ||
              existing.dueDate !== dueDateStr;

            if (isDifferent) {
              needsCommit = true;
              batch.set(doc(db, 'new_joinee_reviews', reviewId), {
                employeeName: p.name,
                department: p.department,
                designation: p.designation,
                joiningDate: p.joiningDate,
                dueDate: dueDateStr,
                status: existing.status === 'Completed' ? 'Completed' : (isOverdue ? 'Overdue' : existing.status)
              }, { merge: true });
            }
          }
        });
      });

      if (needsCommit) {
        try {
          await batch.commit();
        } catch (err) {
          console.error("Error auto-syncing reviews:", err);
        }
      }
    };

    syncAllReviews();
  }, [profiles, reviews]);

  const scheduleReview = async (reviewId: string, reviewer: string) => {
    const ref = doc(db, 'new_joinee_reviews', reviewId);
    await setDoc(ref, {
      reviewer,
      status: 'Scheduled',
      outlookEventCreated: true
    }, { merge: true });
  };

  const triggerPowerAutomate = async (reviewId: string) => {
    const ref = doc(db, 'new_joinee_reviews', reviewId);
    await setDoc(ref, {
      powerAutomateTriggered: true
    }, { merge: true });
  };

  const submitMOM = async (
    reviewId: string, 
    mom: { 
      notes: string; 
      feedback: string; 
      actionItems: string; 
      attachmentName?: string; 
      completionDate: string; 
    }
  ) => {
    const ref = doc(db, 'new_joinee_reviews', reviewId);
    await setDoc(ref, {
      ...mom,
      status: 'Completed'
    }, { merge: true });
  };

  // Projects CRUD
  const addProject = async (p: ProjectDetails) => {
    if (projects.some(x => x.name.toLowerCase() === p.name.toLowerCase())) {
      alert(`Error: Project named '${p.name}' already exists.`);
      return false;
    }
    await setDoc(doc(db, 'staff_projects', p.name), {
      budgetCode: p.budgetCode,
      startDate: p.startDate,
      endDate: p.endDate
    });
    await logChange('create', 'project', p.name, null, p, `Created project: ${p.name} (Budget: ${p.budgetCode})`);
    return true;
  };

  const editProject = async (index: number, updated: ProjectDetails) => {
    const oldProj = projects[index];
    const batch = writeBatch(db);

    if (oldProj.name !== updated.name) {
      // Name changed: delete old doc and create new one
      batch.delete(doc(db, 'staff_projects', oldProj.name));
      batch.set(doc(db, 'staff_projects', updated.name), {
        budgetCode: updated.budgetCode,
        startDate: updated.startDate,
        endDate: updated.endDate
      });

      // Cascade update assignments
      const relatedAssignments = assignments.filter(a => a.projectName === oldProj.name);
      relatedAssignments.forEach(a => {
        if ((a as any).id) {
          batch.update(doc(db, 'staff_assignments', (a as any).id), { projectName: updated.name });
        }
      });
    } else {
      batch.set(doc(db, 'staff_projects', updated.name), {
        budgetCode: updated.budgetCode,
        startDate: updated.startDate,
        endDate: updated.endDate
      });
    }

    await batch.commit();
    await logChange('update', 'project', updated.name, oldProj, updated, `Updated project: ${updated.name}`);
  };

  const deleteProject = async (index: number) => {
    const proj = projects[index];
    const batch = writeBatch(db);

    // Save project to Recycle Bin
    const projectRecycleDoc = doc(collection(db, 'staff_recycle_bin'));
    batch.set(projectRecycleDoc, {
      type: 'project',
      originalId: proj.name,
      data: {
        budgetCode: proj.budgetCode,
        startDate: proj.startDate,
        endDate: proj.endDate
      },
      deletedAt: new Date().toISOString()
    });

    // Delete project doc
    batch.delete(doc(db, 'staff_projects', proj.name));

    // Cascade delete & recycle assignments
    const relatedAssignments = assignments.filter(a => a.projectName === proj.name);
    relatedAssignments.forEach(a => {
      if ((a as any).id) {
        const docId = (a as any).id;
        const assignRecycleDoc = doc(collection(db, 'staff_recycle_bin'));
        batch.set(assignRecycleDoc, {
          type: 'assignment',
          originalId: docId,
          data: {
            employeeId: a.employeeId,
            projectName: a.projectName,
            travelStartDate: a.travelStartDate,
            travelEndDate: a.travelEndDate,
            status: a.status,
            remarks: a.remarks
          },
          deletedAt: new Date().toISOString()
        });
        batch.delete(doc(db, 'staff_assignments', docId));
      }
    });

    await batch.commit();
    await logChange('delete', 'project', proj.name, proj, null, `Deleted project: ${proj.name}`);
  };

  // Assignments CRUD
  const addAssignment = async (a: ProjectAssignment) => {
    const docRef = doc(collection(db, 'staff_assignments'));
    await setDoc(docRef, a);
    const empName = profiles.find(p => p.id === a.employeeId)?.name || 'Unknown';
    
    // Explicitly update employee's profile status in the Master Sheet to the selected assignment status
    const targetStatus = a.status === 'Standby' ? 'Standby' : 'Work';
    await setDoc(doc(db, 'staff_profiles', a.employeeId), {
      status: targetStatus
    }, { merge: true });

    await logChange('create', 'assignment', docRef.id, null, a, `Created assignment for employee ${empName} (${a.employeeId}) on project ${a.projectName}`);
  };

  const editAssignment = async (index: number, updated: ProjectAssignment) => {
    const oldAssignment = assignments[index];
    if (oldAssignment && (oldAssignment as any).id) {
      const docId = (oldAssignment as any).id;
      await setDoc(doc(db, 'staff_assignments', docId), updated);
      const empName = profiles.find(p => p.id === updated.employeeId)?.name || 'Unknown';
      
      // Explicitly update employee's profile status in the Master Sheet to the selected assignment status
      const targetStatus = updated.status === 'Standby' ? 'Standby' : 'Work';
      await setDoc(doc(db, 'staff_profiles', updated.employeeId), {
        status: targetStatus
      }, { merge: true });

      await logChange('update', 'assignment', docId, oldAssignment, updated, `Updated assignment for employee ${empName} (${updated.employeeId}) on project ${updated.projectName}`);
    }
  };

  const deleteAssignment = async (index: number) => {
    const oldAssignment = assignments[index];
    if (oldAssignment && (oldAssignment as any).id) {
      const docId = (oldAssignment as any).id;
      const batch = writeBatch(db);

      // Save to Recycle Bin
      const assignRecycleDoc = doc(collection(db, 'staff_recycle_bin'));
      batch.set(assignRecycleDoc, {
        type: 'assignment',
        originalId: docId,
        data: {
          employeeId: oldAssignment.employeeId,
          projectName: oldAssignment.projectName,
          travelStartDate: oldAssignment.travelStartDate,
          travelEndDate: oldAssignment.travelEndDate,
          status: oldAssignment.status,
          remarks: oldAssignment.remarks
        },
        deletedAt: new Date().toISOString()
      });

      batch.delete(doc(db, 'staff_assignments', docId));
      await batch.commit();
      const empName = profiles.find(p => p.id === oldAssignment.employeeId)?.name || 'Unknown';
      await logChange('delete', 'assignment', docId, oldAssignment, null, `Deleted assignment for employee ${empName} (${oldAssignment.employeeId}) on project ${oldAssignment.projectName}`);
    }
  };

  const bulkUpdateAssignments = async (updatedList: ProjectAssignment[]) => {
    const batch = writeBatch(db);
    
    // Delete all current assignments
    assignments.forEach(a => {
      if ((a as any).id) {
        batch.delete(doc(db, 'staff_assignments', (a as any).id));
      }
    });

    // Write all updated assignments
    updatedList.forEach(a => {
      const docRef = doc(collection(db, 'staff_assignments'));
      batch.set(docRef, a);
    });

    await batch.commit();
  };

  // Get Joined/Merged structure for Planning and views compatibility
  const getMergedAssignments = (): Employee[] => {
    return assignments.map(a => {
      const prof = profiles.find(p => p.id === a.employeeId) || { name: 'Unknown', department: 'Unknown', designation: 'Unknown' };
      
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
        designation: prof.designation,
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



  // Leave Management CRUD
  const addLeave = async (l: Omit<LeaveRecord, 'id'>) => {
    const docRef = doc(collection(db, 'staff_leaves'));
    await setDoc(docRef, { ...l });
    await logChange('create', 'leave', docRef.id, null, l, `Created leave request for ${l.employeeName} (${l.fromDate} to ${l.toDate})`);
  };

  const editLeave = async (id: string, l: Omit<LeaveRecord, 'id'>) => {
    const oldVal = leaves.find(x => x.id === id);
    await setDoc(doc(db, 'staff_leaves', id), { ...l });
    await logChange('update', 'leave', id, oldVal, l, `Updated leave details for ${l.employeeName}`);
  };

  const deleteLeave = async (id: string) => {
    const oldVal = leaves.find(x => x.id === id);
    if (oldVal) {
      const batch = writeBatch(db);
      const recycleDoc = doc(collection(db, 'staff_recycle_bin'));
      batch.set(recycleDoc, {
        type: 'leave',
        originalId: id,
        data: {
          employeeId: oldVal.employeeId,
          employeeName: oldVal.employeeName,
          fromDate: oldVal.fromDate,
          toDate: oldVal.toDate,
          remarks: oldVal.remarks,
          projectId: oldVal.projectId || ''
        },
        deletedAt: new Date().toISOString()
      });
      batch.delete(doc(db, 'staff_leaves', id));
      await batch.commit();
      await logChange('delete', 'leave', id, oldVal, null, `Deleted leave record for ${oldVal.employeeName}`);
    }
  };

  // Attendance
  const setSingleAttendance = async (employeeId: string, date: string, status: 'W' | 'L' | 'T' | 'S') => {
    await setDoc(doc(db, 'staff_attendance', `${employeeId}_${date}`), { status });
  };

  const setBulkAttendance = async (employeeId: string, startDateStr: string, endDateStr: string, status: 'W' | 'L' | 'T' | 'S') => {
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
        batch.set(doc(db, 'staff_attendance', docId), { status });
      }
    });

    await batch.commit();
  };

  const autoAlignMismatches = async () => {
    const batch = writeBatch(db);
    let count = 0;
    Object.keys(attendance || {}).forEach(key => {
      const parts = key.split('_');
      if (parts.length === 2) {
        const empId = parts[0];
        const dateStr = parts[1];
        const manualStatus = attendance[key];
        const expectedStatus = resolveStatusOnDate(empId, dateStr, assignments, projects, leaves);
        if (manualStatus && expectedStatus && manualStatus !== expectedStatus) {
          batch.set(doc(db, 'staff_attendance', key), { status: expectedStatus });
          count++;
        }
      }
    });
    if (count > 0) {
      await batch.commit();
    }
    return count;
  };

  const resetDatabase = async () => {
    const batch = writeBatch(db);
    
    profiles.forEach(p => {
      batch.delete(doc(db, 'staff_profiles', p.id));
    });

    projects.forEach(p => {
      batch.delete(doc(db, 'staff_projects', p.name));
    });

    assignments.forEach(a => {
      if ((a as any).id) {
        batch.delete(doc(db, 'staff_assignments', (a as any).id));
      }
    });



    leaves.forEach(l => {
      batch.delete(doc(db, 'staff_leaves', l.id));
    });

    Object.keys(attendance).forEach(key => {
      batch.delete(doc(db, 'staff_attendance', key));
    });

    await batch.commit();
  };

  const seedDatabase = async () => {
    // Clear database first
    await resetDatabase();

    const batch = writeBatch(db);

    // Add sample employee profiles
    const sampleProfiles = [
      { id: 'EMP001', name: 'John Doe', department: 'Engineering', designation: 'Frontend Developer', status: 'Work' as const },
      { id: 'EMP002', name: 'Jane Smith', department: 'Product', designation: 'Product Manager', status: 'Work' as const },
      { id: 'EMP003', name: 'Alice Johnson', department: 'Engineering', designation: 'DevOps Engineer', status: 'Work' as const },
      { id: 'EMP004', name: 'Bob Brown', department: 'Design', designation: 'UI/UX Designer', status: 'Standby' as const },
      { id: 'EMP005', name: 'Charlie Green', department: 'QA', designation: 'QA Lead', status: 'Standby' as const }
    ];

    sampleProfiles.forEach(p => {
      batch.set(doc(db, 'staff_profiles', p.id), {
        name: p.name,
        department: p.department,
        designation: p.designation,
        status: p.status
      });
    });

    // Add sample projects starting from today
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    const threeMonthsFromNow = new Date(today);
    threeMonthsFromNow.setMonth(today.getMonth() + 3);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const sampleProjects = [
      { name: 'Project Phoenix', budgetCode: 'BC-PHX-101', startDate: formatDate(today), endDate: formatDate(threeMonthsFromNow) },
      { name: 'Project Apollo', budgetCode: 'BC-APL-202', startDate: formatDate(today), endDate: formatDate(oneMonthFromNow) },
      { name: 'Project Gemini', budgetCode: 'BC-GEM-303', startDate: formatDate(today), endDate: formatDate(threeMonthsFromNow) }
    ];

    sampleProjects.forEach(p => {
      batch.set(doc(db, 'staff_projects', p.name), {
        budgetCode: p.budgetCode,
        startDate: p.startDate,
        endDate: p.endDate
      });
    });

    // Add sample assignments
    const sampleAssignments = [
      {
        employeeId: 'EMP001',
        projectName: 'Project Phoenix',
        travelStartDate: formatDate(today),
        travelEndDate: formatDate(oneMonthFromNow),
        status: 'Work' as const,
        remarks: 'Frontend implementation and styling'
      },
      {
        employeeId: 'EMP002',
        projectName: 'Project Apollo',
        travelStartDate: formatDate(today),
        travelEndDate: formatDate(oneMonthFromNow),
        status: 'Work' as const,
        remarks: 'Travelling for product launch and onboarding'
      },
      {
        employeeId: 'EMP003',
        projectName: 'Project Gemini',
        travelStartDate: formatDate(today),
        travelEndDate: formatDate(threeMonthsFromNow),
        status: 'Work' as const,
        remarks: 'DevOps and cloud infrastructure setup'
      }
    ];

    sampleAssignments.forEach(a => {
      const docRef = doc(collection(db, 'staff_assignments'));
      batch.set(docRef, {
        employeeId: a.employeeId,
        projectName: a.projectName,
        travelStartDate: a.travelStartDate,
        travelEndDate: a.travelEndDate,
        status: a.status,
        remarks: a.remarks
      });
    });

    // Add sample leave records
    const sampleLeaves = [
      {
        employeeId: 'EMP001',
        employeeName: 'John Doe',
        fromDate: formatDate(new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000)),
        toDate: formatDate(new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000)),
        projectId: 'Project Phoenix',
        remarks: 'Visiting family'
      },
      {
        employeeId: 'EMP004',
        employeeName: 'Bob Brown',
        fromDate: formatDate(today),
        toDate: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
        projectId: 'None',
        remarks: 'Medical recovery'
      },
      {
        employeeId: 'EMP005',
        employeeName: 'Charlie Green',
        fromDate: formatDate(new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)),
        toDate: formatDate(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)),
        projectId: 'Project Phoenix',
        remarks: 'Personal errands'
      }
    ];

    sampleLeaves.forEach(l => {
      const docRef = doc(collection(db, 'staff_leaves'));
      batch.set(docRef, l);
    });

    await batch.commit();
  };

  const restoreRecycleItem = async (itemId: string) => {
    const item = recycleBin.find(x => x.id === itemId);
    if (!item) return;

    const batch = writeBatch(db);

    if (item.type === 'profile') {
      batch.set(doc(db, 'staff_profiles', item.originalId), item.data);
    } else if (item.type === 'project') {
      batch.set(doc(db, 'staff_projects', item.originalId), item.data);
    } else if (item.type === 'assignment') {
      batch.set(doc(db, 'staff_assignments', item.originalId), item.data);
    } else if (item.type === 'leave') {
      batch.set(doc(db, 'staff_leaves', item.originalId), item.data);
    }

    batch.delete(doc(db, 'staff_recycle_bin', itemId));
    await batch.commit();
    await logChange('restore', item.type as any, item.originalId, null, item.data, `Restored deleted ${item.type} from Recycle Bin`);
  };

  const deleteRecycleItemPermanently = async (itemId: string) => {
    await deleteDoc(doc(db, 'staff_recycle_bin', itemId));
  };

  const revertChange = async (log: AuditLogEntry) => {
    const collectionMap: Record<string, string> = {
      profile: 'staff_profiles',
      project: 'staff_projects',
      assignment: 'staff_assignments',
      leave: 'staff_leaves'
    };
    const collectionName = collectionMap[log.recordType];
    if (!collectionName) return;

    const batch = writeBatch(db);

    if (log.actionType === 'create') {
      // Revert create => Delete doc
      batch.delete(doc(db, collectionName, log.recordId));
      await batch.commit();
      await logChange('delete', log.recordType, log.recordId, log.newValue, null, `Rolled back creation of ${log.recordType}: deleted record.`);
    } else if (log.actionType === 'delete') {
      // Revert delete => Restore oldValue
      batch.set(doc(db, collectionName, log.recordId), log.oldValue);
      await batch.commit();
      await logChange('restore', log.recordType, log.recordId, null, log.oldValue, `Rolled back deletion of ${log.recordType}: restored record.`);
    } else if (log.actionType === 'update') {
      // Revert update => Revert to oldValue
      batch.set(doc(db, collectionName, log.recordId), log.oldValue);
      await batch.commit();
      await logChange('update', log.recordType, log.recordId, log.newValue, log.oldValue, `Rolled back update of ${log.recordType} to previous state.`);
    } else if (log.actionType === 'restore') {
      // Revert restore => Delete doc
      batch.delete(doc(db, collectionName, log.recordId));
      await batch.commit();
      await logChange('delete', log.recordType, log.recordId, log.newValue, null, `Rolled back restoration of ${log.recordType}: deleted record.`);
    }
  };

  return {
    profiles,
    projects,
    assignments,
    attendance,
    leaves,
    recycleBin,
    auditLogs,
    reviews,
    addProfile,
    editProfile,
    deleteProfile,
    addLeave,
    editLeave,
    deleteLeave,
    addProject,
    editProject,
    deleteProject,
    addAssignment,
    editAssignment,
    deleteAssignment,
    bulkUpdateAssignments,
    getMergedAssignments,
    setSingleAttendance,
    setBulkAttendance,
    resetDatabase,
    seedDatabase,
    restoreRecycleItem,
    deleteRecycleItemPermanently,
    revertChange,
    autoAlignMismatches,
    scheduleReview,
    triggerPowerAutomate,
    submitMOM,
  };
}
