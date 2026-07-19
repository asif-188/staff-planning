import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Calendar, 
  User, 
  FileText,
  UserCheck,
  Download
} from 'lucide-react';
import type { EmployeeProfile, LeaveRecord, ProjectDetails, ProjectAssignment } from '../hooks/usePlanningState';
import { formatToClientDate } from '../utils/timelineHelper';
import { exportLeaveReportToExcel } from '../utils/excelHelper';

interface LeaveManagementViewProps {
  profiles: EmployeeProfile[];
  leaves: LeaveRecord[];
  projects: ProjectDetails[];
  assignments: ProjectAssignment[];
  addLeave: (l: Omit<LeaveRecord, 'id'>) => Promise<void>;
  editLeave: (id: string, l: Omit<LeaveRecord, 'id'>) => Promise<void>;
  deleteLeave: (id: string) => Promise<void>;
}

export default function LeaveManagementView({
  profiles,
  leaves,
  projects,
  assignments,
  addLeave,
  editLeave,
  deleteLeave
}: LeaveManagementViewProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // Modals & Forms
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formFromDate, setFormFromDate] = useState('');
  const [formToDate, setFormToDate] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formProjectId, setFormProjectId] = useState('None');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Searchable profile select dropdown state
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [isEmpSelectOpen, setIsEmpSelectOpen] = useState(false);

  // Inline date range overlap error
  const [dateError, setDateError] = useState('');

  // Real-time overlap check to block frozen dates
  useEffect(() => {
    if (!formEmployeeId || !formFromDate || !formToDate) {
      setDateError('');
      return;
    }

    const overlappingRecord = leaves.find(l => {
      if (editingId && l.id === editingId) return false;
      return l.employeeId === formEmployeeId &&
             !(formToDate < l.fromDate || formFromDate > l.toDate);
    });

    if (overlappingRecord) {
      setDateError(`❌ Date range overlaps with existing leave: ${formatToClientDate(overlappingRecord.fromDate)} to ${formatToClientDate(overlappingRecord.toDate)} (Frozen).`);
      return;
    }

    const overlappingAssignment = assignments.find(a => {
      if (a.employeeId !== formEmployeeId || a.projectName === 'None') return false;
      const aStart = a.travelStartDate;
      const aEnd = a.travelEndDate;
      return !(formToDate < aStart || formFromDate > aEnd);
    });

    if (overlappingAssignment) {
      setDateError(`❌ Date range overlaps with project assignment on "${overlappingAssignment.projectName}" (${formatToClientDate(overlappingAssignment.travelStartDate)} to ${formatToClientDate(overlappingAssignment.travelEndDate)}).`);
    } else {
      setDateError('');
    }
  }, [formEmployeeId, formFromDate, formToDate, leaves, assignments, editingId]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate statistics
  const totalCount = leaves.length;
  const activeTodayCount = leaves.filter(l => todayStr >= l.fromDate && todayStr <= l.toDate).length;

  // Filtered leave records
  const filteredLeaves = leaves.filter(l => {
    const prof = profiles.find(p => p.id === l.employeeId);
    
    // Check overlap with the date range filter
    const lFrom = l.fromDate;
    const lTo = l.toDate;
    const isOverlap = (!startDateStr || lTo >= startDateStr) && (!endDateStr || lFrom <= endDateStr);
    if (!isOverlap) return false;

    // Search filter
    const q = searchQuery.toLowerCase().trim();
    const proj = projects.find(p => p.name === l.projectId);
    const matchesProjOrCode = l.projectId && (
      l.projectId.toLowerCase().includes(q) ||
      (proj?.budgetCode || '').toLowerCase().includes(q)
    );
    const matchQuery = !q || 
      l.employeeId.toLowerCase().includes(q) ||
      l.employeeName.toLowerCase().includes(q) ||
      (prof?.department || '').toLowerCase().includes(q) ||
      matchesProjOrCode ||
      l.remarks.toLowerCase().includes(q);

    // Department filter
    const matchDept = !deptFilter || (prof && prof.department === deptFilter);

    return matchQuery && matchDept;
  });

  // Unique departments for filter
  const departments = Array.from(new Set(profiles.map(p => p.department)));

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formEmployeeId) {
      alert('Please select an employee.');
      return;
    }

    const employee = profiles.find(p => p.id === formEmployeeId);
    if (!employee) {
      alert('Selected employee profile not found.');
      return;
    }

    if (formFromDate > formToDate) {
      alert('Leave start date cannot be after leave end date.');
      return;
    }

    if (dateError) {
      alert(dateError);
      return;
    }

    const leaveData = {
      employeeId: formEmployeeId,
      employeeName: employee.name,
      fromDate: formFromDate,
      toDate: formToDate,
      remarks: formRemarks,
      projectId: formProjectId
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await editLeave(editingId, leaveData);
      } else {
        await addLeave(leaveData);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save leave record:', err);
      alert('Error: Failed to save leave record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormEmployeeId('');
    setFormFromDate('');
    setFormToDate('');
    setFormRemarks('');
    setFormProjectId('None');
    setEmpSearchQuery('');
    setIsEmpSelectOpen(false);
    setIsSubmitting(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (l: LeaveRecord) => {
    setEditingId(l.id);
    setFormEmployeeId(l.employeeId);
    setFormFromDate(l.fromDate);
    setFormToDate(l.toDate);
    setFormRemarks(l.remarks);
    setFormProjectId(l.projectId || 'None');
    
    const prof = profiles.find(p => p.id === l.employeeId);
    setEmpSearchQuery(prof ? `${prof.name} (${prof.id})` : l.employeeId);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this leave record?')) {
      try {
        await deleteLeave(id);
      } catch (err) {
        console.error('Failed to delete leave record:', err);
        alert('Error: Failed to delete leave record.');
      }
    }
  };


  // Filter profiles list based on searchable selector query
  const filteredProfilesForSelect = profiles.filter(p => {
    const q = empSearchQuery.toLowerCase().trim();
    return !q || 
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-brand-500" />
            Leave Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Create, approve, and track employee leave requests. Standby statuses update automatically based on leaves.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 active:scale-95 transition-all text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-brand-500/20 w-fit"
        >
          <Plus className="w-5 h-5" />
          Create Leave
        </button>
      </div>      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Card 1: Total */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-brand-500/5 dark:bg-brand-500/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-50 dark:bg-brand-950/20 text-brand-500 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Applications</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{totalCount}</h3>
            </div>
          </div>
        </div>

        {/* Card 2: Active Today */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Active Leaves Today</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{activeTodayCount}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Employee, ID, Remarks..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Department */}
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Date range filter */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 uppercase text-[9px]">From:</span>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="bg-transparent focus:outline-none text-xs font-semibold"
              />
            </div>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-1">
              <span className="text-slate-400 uppercase text-[9px]">To:</span>
              <input
                type="date"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                className="bg-transparent focus:outline-none text-xs font-semibold"
              />
            </div>
          </div>

          {(startDateStr || endDateStr) && (
            <button
              type="button"
              onClick={() => {
                setStartDateStr('');
                setEndDateStr('');
              }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
              title="Clear date range filters"
            >
              Clear Date
            </button>
          )}

          <button
            onClick={() => exportLeaveReportToExcel(filteredLeaves, profiles, projects, startDateStr, endDateStr)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white rounded-xl shadow-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Leave Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase">
                <th className="py-3 px-6">Employee ID</th>
                <th className="py-3 px-6">Employee Name</th>
                <th className="py-3 px-6">Project ID</th>
                <th className="py-3 px-6">Leave Start Date</th>
                <th className="py-3 px-6">Leave End Date</th>
                <th className="py-3 px-6">Remarks</th>
                <th className="py-3 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-700 dark:text-slate-300">{l.employeeId}</td>
                    <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-white">{l.employeeName}</td>
                    <td className="py-3.5 px-6 font-medium text-slate-750 dark:text-slate-250">{l.projectId || 'None'}</td>
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatToClientDate(l.fromDate)}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {formatToClientDate(l.toDate)}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 truncate max-w-[200px]" title={l.remarks}>
                      {l.remarks || '-'}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(l)}
                          title="Edit"
                          className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(l.id)}
                          title="Delete"
                          className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 rounded-lg border border-rose-200 dark:border-rose-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No leave records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />

          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-6 h-6 text-brand-500" />
                {editingId ? 'Edit Leave Record' : 'Create Leave Record'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Searchable Select Employee */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Employee Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type name or ID to search..."
                      value={empSearchQuery}
                      onChange={e => {
                        setEmpSearchQuery(e.target.value);
                        setIsEmpSelectOpen(true);
                      }}
                      onFocus={() => setIsEmpSelectOpen(true)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  {/* Dropdown Options */}
                  {isEmpSelectOpen && (
                    <div className="absolute left-0 right-0 top-[76px] z-50 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredProfilesForSelect.length > 0 ? (
                        filteredProfilesForSelect.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setFormEmployeeId(p.id);
                              setEmpSearchQuery(`${p.name} (${p.id})`);
                              setIsEmpSelectOpen(false);

                              // Auto-detect currently assigned project
                              const empAss = assignments.filter(a => a.employeeId === p.id);
                              if (empAss.length > 0) {
                                const todayStr = new Date().toISOString().split('T')[0];
                                const active = empAss.find(a => {
                                  const foundP = projects.find(proj => proj.name === a.projectName);
                                  const sStr = a.travelStartDate || foundP?.startDate || '';
                                  const eStr = a.travelEndDate || foundP?.endDate || '';
                                  return todayStr >= sStr && todayStr <= eStr;
                                }) || empAss[0];
                                setFormProjectId(active.projectName);
                              } else {
                                setFormProjectId('None');
                              }
                            }}
                            className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center"
                          >
                            <span>{p.name}</span>
                            <span className="font-mono text-xs opacity-60">{p.id}</span>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 italic">No employees found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Already Booked Leave Badges (Frozen Dates) */}
                {(() => {
                  const empLeaves = leaves.filter(l => l.employeeId === formEmployeeId && l.id !== editingId);
                  if (empLeaves.length === 0) return null;
                  return (
                    <div className="space-y-1 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/40">
                      <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Booked Leave Dates (Frozen)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {empLeaves.map(el => (
                          <span key={el.id} className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-lg">
                            🚫 {formatToClientDate(el.fromDate)} to {formatToClientDate(el.toDate)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Project ID Selection Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Project ID</label>
                  <select
                      value={formProjectId}
                      onChange={e => setFormProjectId(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none cursor-pointer text-sm font-semibold"
                    >
                      <option value="None">None (No active assignment)</option>
                      {projects.map(p => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leave Start Date</label>
                    <input
                      type="date"
                      required
                      value={formFromDate}
                      onChange={e => setFormFromDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leave End Date</label>
                    <input
                      type="date"
                      required
                      value={formToDate}
                      onChange={e => setFormToDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* Inline overlap warning */}
                {dateError && (
                  <div className="p-3 bg-red-50/40 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/30 text-xs font-semibold text-red-600 dark:text-red-400 rounded-xl animate-pulse">
                    {dateError}
                  </div>
                )}

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Remarks</label>
                  <textarea
                    rows={3}
                    value={formRemarks}
                    onChange={e => setFormRemarks(e.target.value)}
                    placeholder="Enter context, emergency contact, or reasoning..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !!dateError}
                    className={`px-5 py-2 text-sm font-semibold rounded-xl shadow-lg transition-all active:scale-95 ${
                      (isSubmitting || !!dateError)
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed shadow-none opacity-60'
                        : 'bg-brand-500 hover:bg-brand-600 text-white shadow-brand-500/20 cursor-pointer'
                    }`}
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
