import { useState, useRef, useEffect } from 'react';
import type { EmployeeProfile, ProjectDetails, ProjectAssignment, LeaveRecord } from '../hooks/usePlanningState';
import { 
  importFromExcel, 
  exportDatabaseToExcel, 
  importProjectsFromExcel, 
  importEmployeesFromExcel, 
  downloadExcelTemplate,
  exportConsolidatedReportToExcel
} from '../utils/excelHelper';
import { format } from 'date-fns';
import { normalizeDateString, resolveStatusOnDate, formatToClientDate } from '../utils/timelineHelper';
import { exportValidationReportToExcel, type ValidationIssue } from '../utils/validationHelper';
import { 
  Plus, 
  Trash2, 
  Edit, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  X,
  Briefcase,
  Users,
  Link2,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface MasterSheetViewProps {
  attendance: any;
  leaves: LeaveRecord[];
  // Normalized API
  profiles: EmployeeProfile[];
  projects: ProjectDetails[];
  assignments: ProjectAssignment[];
  addProfile: (p: EmployeeProfile) => Promise<boolean> | boolean;
  editProfile: (idx: number, p: EmployeeProfile) => void;
  deleteProfile: (idx: number) => void;
  addProject: (p: ProjectDetails) => Promise<boolean> | boolean;
  editProject: (idx: number, p: ProjectDetails) => void;
  deleteProject: (idx: number) => void;
  addAssignment: (a: ProjectAssignment) => void;
  editAssignment: (idx: number, a: ProjectAssignment) => void;
  deleteAssignment: (idx: number) => void;

  // Lifted state and setters for navigation/filtering
  activeSubTab: 'assignments' | 'employees' | 'projects';
  setActiveSubTab: (tab: 'assignments' | 'employees' | 'projects') => void;
  search: string;
  setSearch: (search: string) => void;
  deptFilter: string;
  setDeptFilter: (dept: string) => void;
  projectFilter: string;
  setProjectFilter: (proj: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  activeTodayOnly: boolean;
  setActiveTodayOnly: (active: boolean) => void;
  validationSummary: {
    totalRecordsChecked: number;
    validRecordsCount: number;
    issues: ValidationIssue[];
    errorsCount: number;
    warningsCount: number;
  };
  hasValidationErrors: boolean;
  autoAlignMismatches: () => Promise<number>;
}

export default function MasterSheetView({
  attendance,
  leaves,
  profiles,
  projects,
  assignments,
  addProfile,
  editProfile,
  deleteProfile,
  addProject,
  editProject,
  deleteProject,
  addAssignment,
  editAssignment,
  deleteAssignment,

  activeSubTab,
  setActiveSubTab,
  search,
  setSearch,
  deptFilter,
  setDeptFilter,
  projectFilter,
  setProjectFilter,
  statusFilter,
  setStatusFilter,
  activeTodayOnly,
  setActiveTodayOnly,
  validationSummary,
  hasValidationErrors,
  autoAlignMismatches
}: MasterSheetViewProps) {
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Validation UI panel state
  const [showValidationPanel, setShowValidationPanel] = useState(false);

  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}-01`;
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    const d = new Date();
    const yr = d.getFullYear();
    const nextMonthDate = new Date(yr, d.getMonth() + 2, 0);
    const nextYr = nextMonthDate.getFullYear();
    const nextMo = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
    const nextLastDay = String(nextMonthDate.getDate()).padStart(2, '0');
    return `${nextYr}-${nextMo}-${nextLastDay}`;
  });

  // Export modal range states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('2026-05-01');
  const [exportEndDate, setExportEndDate] = useState('2026-06-30');

  // Sync export dates with filter dates
  useEffect(() => {
    setExportStartDate(startDateStr);
  }, [startDateStr]);

  useEffect(() => {
    setExportEndDate(endDateStr);
  }, [endDateStr]);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [profileForm, setProfileForm] = useState<EmployeeProfile>({ id: '', name: '', department: 'Engineering', designation: '' });
  const [projectForm, setProjectForm] = useState<ProjectDetails>({ name: '', budgetCode: '', startDate: '', endDate: '' });
  const [assignForm, setAssignForm] = useState<ProjectAssignment>({
    employeeId: '',
    projectName: '',
    travelStartDate: '',
    travelEndDate: '',
    status: 'Working',
    remarks: ''
  });



  // Searchable select states
  const [empSearch, setEmpSearch] = useState('');
  const [isEmpOpen, setIsEmpOpen] = useState(false);
  const [activeEmpIdx, setActiveEmpIdx] = useState(0);
  const [projSearch, setProjSearch] = useState('');
  const [isProjOpen, setIsProjOpen] = useState(false);
  const [activeProjIdx, setActiveProjIdx] = useState(0);

  const uniqueDepts = Array.from(new Set(profiles.map(p => p.department)));
  const uniqueProjects = Array.from(new Set(projects.map(p => p.name)));
  
  // Custom dropdown status filter options for employees today status
  const statuses = ['Working', 'Leave', 'Travelling', 'Standby'];

  // Searchable filters with automatic show-all on focus (exact match override)
  const isEmpExactMatch = profiles.some(p => `${p.id} - ${p.name}` === empSearch);
  const filteredProfiles = profiles.filter(p => {
    if (isEmpExactMatch) return true;
    if (!empSearch) return true;
    return (
      p.name.toLowerCase().includes(empSearch.toLowerCase()) || 
      p.id.toLowerCase().includes(empSearch.toLowerCase()) ||
      p.department.toLowerCase().includes(empSearch.toLowerCase())
    );
  });

  const isProjExactMatch = projects.some(p => p.name === projSearch);
  const filteredProjects = projects.filter(p => {
    if (isProjExactMatch) return true;
    if (!projSearch) return true;
    return (
      p.name.toLowerCase().includes(projSearch.toLowerCase()) ||
      p.budgetCode.toLowerCase().includes(projSearch.toLowerCase())
    );
  });

  // Keyboard navigation arrow keys handlers
  const handleEmpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEmpOpen) {
      if (e.key === 'ArrowDown') {
        setIsEmpOpen(true);
        setActiveEmpIdx(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveEmpIdx(prev => (prev + 1) % Math.max(filteredProfiles.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveEmpIdx(prev => (prev - 1 + filteredProfiles.length) % Math.max(filteredProfiles.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredProfiles[activeEmpIdx];
      if (selected) {
        setAssignForm(prev => ({ ...prev, employeeId: selected.id }));
        setEmpSearch(`${selected.id} - ${selected.name}`);
        setIsEmpOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsEmpOpen(false);
    }
  };

  const handleProjKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isProjOpen) {
      if (e.key === 'ArrowDown') {
        setIsProjOpen(true);
        setActiveProjIdx(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveProjIdx(prev => (prev + 1) % Math.max(filteredProjects.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveProjIdx(prev => (prev - 1 + filteredProjects.length) % Math.max(filteredProjects.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredProjects[activeProjIdx];
      if (selected) {
        setAssignForm(prev => ({
          ...prev,
          projectName: selected.name,
          travelStartDate: selected.startDate,
          travelEndDate: selected.endDate
        }));
        setProjSearch(selected.name);
        setIsProjOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsProjOpen(false);
    }
  };

  // Handle modals opening
  const handleOpenAdd = () => {
    setEditingIndex(null);
    if (activeSubTab === 'employees') {
      setProfileForm({ id: '', name: '', department: 'Engineering', designation: '' });
    } else if (activeSubTab === 'projects') {
      setProjectForm({ name: '', budgetCode: '', startDate: '', endDate: '' });
    } else {
      const defaultEmp = profiles[0];
      const defaultProj = projects[0];
      setAssignForm({
        employeeId: defaultEmp?.id || '',
        projectName: defaultProj?.name || '',
        travelStartDate: defaultProj?.startDate || '',
        travelEndDate: defaultProj?.endDate || '',
        status: 'Working',
        remarks: ''
      });
      setEmpSearch(defaultEmp ? `${defaultEmp.id} - ${defaultEmp.name}` : '');
      setProjSearch(defaultProj?.name || '');
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (idx: number) => {
    setEditingIndex(idx);
    if (activeSubTab === 'employees') {
      setProfileForm(profiles[idx]);
    } else if (activeSubTab === 'projects') {
      setProjectForm(projects[idx]);
    } else {
      const assign = assignments[idx];
      setAssignForm(assign);
      const emp = profiles.find(p => p.id === assign.employeeId);
      setEmpSearch(emp ? `${emp.id} - ${emp.name}` : assign.employeeId);
      setProjSearch(assign.projectName);
    }
    setIsModalOpen(true);
  };

  // Submissions
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSubTab === 'employees') {
      if (!profileForm.id || !profileForm.name) return;
      if (editingIndex !== null) {
        editProfile(editingIndex, profileForm);
      } else {
        const success = addProfile(profileForm);
        if (!success) return;
      }
    } else if (activeSubTab === 'projects') {
      if (!projectForm.name || !projectForm.startDate || !projectForm.endDate) return;
      const normalizedProj = {
        ...projectForm,
        startDate: normalizeDateString(projectForm.startDate),
        endDate: normalizeDateString(projectForm.endDate)
      };
      if (editingIndex !== null) {
        editProject(editingIndex, normalizedProj);
      } else {
        const success = addProject(normalizedProj);
        if (!success) return;
      }
    } else {
      if (!assignForm.employeeId) return;
      if (!assignForm.projectName) return;
      
      const targetProj = projects.find(p => p.name === assignForm.projectName);
      const rawStart = assignForm.travelStartDate || targetProj?.startDate || '';
      const rawEnd = assignForm.travelEndDate || targetProj?.endDate || '';
      
      const newStart = normalizeDateString(rawStart);
      const newEnd = normalizeDateString(rawEnd);
      
      if (!newStart || !newEnd) {
        alert('Please specify valid start and end dates.');
        return;
      }
      
      if (newStart > newEnd) {
        alert('Travel start date cannot be after travel end date.');
        return;
      }

      // Check for overlapping assignments for the same employee
      const hasOverlap = assignments.some((a, idx) => {
        if (editingIndex !== null && idx === editingIndex) return false;
        if (a.employeeId !== assignForm.employeeId) return false;
        
        const aStart = normalizeDateString(a.travelStartDate || '');
        const aEnd = normalizeDateString(a.travelEndDate || '');
        
        return newStart <= aEnd && newEnd >= aStart;
      });

      if (hasOverlap) {
        alert('❌ Error: This employee already has a project allocation during these dates. Overlapping allocations are not allowed.');
        return;
      }

      const completeData = {
        ...assignForm,
        projectName: assignForm.projectName,
        travelStartDate: newStart,
        travelEndDate: newEnd
      };

      if (editingIndex !== null) {
        editAssignment(editingIndex, completeData);
      } else {
        addAssignment(completeData);
      }
    }
    setIsModalOpen(false);
  };

  // Excel handlers
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (activeSubTab === 'employees') {
        const imported = await importEmployeesFromExcel(file);
        if (confirm(`Do you want to import ${imported.length} Employee Profiles directly into the Employees Database?`)) {
          let added = 0;
          for (const emp of imported) {
            if (!profiles.some(p => p.id === emp.id)) {
              addProfile(emp);
              added++;
            }
          }
          alert(`Successfully imported ${added} new employee profiles!`);
        }
      } else if (activeSubTab === 'projects') {
        const imported = await importProjectsFromExcel(file);
        if (confirm(`Do you want to import ${imported.length} Projects directly into the Projects Database?`)) {
          let added = 0;
          for (const proj of imported) {
            if (!projects.some(p => p.name.toLowerCase() === proj.name.toLowerCase())) {
              addProject(proj);
              added++;
            }
          }
          alert(`Successfully imported ${added} new projects!`);
        }
      } else {
        // Assignments Tab Import
        const imported = await importFromExcel(file);
        if (confirm(`Do you want to import and normalize ${imported.length} rows of assignments?`)) {
          const newAssignments: ProjectAssignment[] = [];

          for (let i = 0; i < imported.length; i++) {
            const emp = imported[i];
            const start = emp.travelStartDate || emp.projectStartDate;
            const end = emp.travelEndDate || emp.projectEndDate;
            
            newAssignments.push({
              employeeId: emp.id,
              projectName: emp.project,
              travelStartDate: start,
              travelEndDate: end,
              status: emp.status,
              remarks: emp.remarks
            });
          }

          // Import into Firestore
          let addedAss = 0;
          for (let i = 0; i < newAssignments.length; i++) {
            await addAssignment(newAssignments[i]);
            addedAss++;
          }
          alert(`Successfully imported ${addedAss} staff assignments!`);
        }
      }
    } catch (err: any) {
      alert(`Import error: ${err.message || err}`);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleExportClick = () => {
    if (hasValidationErrors) {
      alert("❌ Export blocked: Please resolve outstanding data quality errors before exporting.");
      return;
    }
    if (validationSummary.warningsCount > 0) {
      const confirmProceed = confirm(
        `⚠️ There are ${validationSummary.warningsCount} active warning(s) in your data. Do you want to proceed with database backup export?`
      );
      if (!confirmProceed) return;
    }
    exportDatabaseToExcel(profiles, projects, assignments);
  };

  const handleExportConsolidated = () => {
    if (hasValidationErrors) {
      alert("❌ Export blocked: Please resolve outstanding data quality errors before exporting.");
      return;
    }
    setIsExportModalOpen(true);
  };

  const performConsolidatedExport = () => {
    if (validationSummary.warningsCount > 0) {
      const confirmProceed = confirm(
        `⚠️ There are ${validationSummary.warningsCount} active warning(s) in your data. Do you want to proceed with generating the consolidated Excel workbook?`
      );
      if (!confirmProceed) return;
    }
    setIsExportModalOpen(false);
    exportConsolidatedReportToExcel(
      assignments,
      profiles,
      projects,
      leaves,
      exportStartDate,
      exportEndDate
    );
  };

  const handleFixIssue = (issue: ValidationIssue) => {
    if (issue.recordType === 'Employee') {
      setActiveSubTab('employees');
      setSearch(issue.employeeId || issue.employeeName || '');
    } else if (issue.recordType === 'Project') {
      setActiveSubTab('projects');
      setSearch(issue.projectName || '');
    } else if (issue.recordType === 'Assignment') {
      setActiveSubTab('assignments');
      setSearch(issue.employeeId || '');
    } else if (issue.recordType === 'Leave') {
      setActiveSubTab('assignments');
      setSearch(issue.employeeId || '');
    }
  };

  // Status mapping for Employees
  const getTodayStatus = (prof: EmployeeProfile) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Explicit attendance override
    const att = attendance[`${prof.id}_${todayStr}`];
    if (att) return att;

    // 2. Resolve based on assignments, projects and manual leaves
    return resolveStatusOnDate(prof.id, todayStr, assignments, projects, leaves);
  };

  const getFilteredEmployees = () => {
    return profiles.map((p, idx) => ({ data: p, index: idx })).filter(({ data }) => {
      const empAssigns = assignments.filter(a => a.employeeId === data.id);
      const matchesProjectOrCode = empAssigns.some(a => {
        const proj = projects.find(p => p.name === a.projectName);
        return a.projectName.toLowerCase().includes(search.toLowerCase()) ||
               (proj?.budgetCode || '').toLowerCase().includes(search.toLowerCase());
      });

      const matchesSearch = !search || 
        data.name.toLowerCase().includes(search.toLowerCase()) ||
        data.id.toLowerCase().includes(search.toLowerCase()) ||
        data.designation.toLowerCase().includes(search.toLowerCase()) ||
        data.department.toLowerCase().includes(search.toLowerCase()) ||
        matchesProjectOrCode;
      
      const matchesDept = !deptFilter || data.department === deptFilter;

      let matchesStatus = true;
      if (statusFilter) {
        const todayStatus = getTodayStatus(data);
        if (statusFilter === 'Working') {
          matchesStatus = todayStatus === 'W';
        } else if (statusFilter === 'Travelling') {
          matchesStatus = todayStatus === 'T';
        } else if (statusFilter === 'Leave') {
          matchesStatus = todayStatus === 'L';
        } else if (statusFilter === 'Standby') {
          matchesStatus = todayStatus === 'S';
        }
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  };

  const getFilteredAssignments = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return assignments.map((a, idx) => ({ data: a, index: idx })).filter(({ data }) => {
      const prof = profiles.find(p => p.id === data.employeeId);
      const name = prof?.name || '';
      const dept = prof?.department || '';
      const proj = projects.find(p => p.name === data.projectName);
      const projCode = proj?.budgetCode || '';

      const matchesSearch = !search ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        data.employeeId.toLowerCase().includes(search.toLowerCase()) ||
        data.projectName.toLowerCase().includes(search.toLowerCase()) ||
        dept.toLowerCase().includes(search.toLowerCase()) ||
        projCode.toLowerCase().includes(search.toLowerCase()) ||
        data.remarks.toLowerCase().includes(search.toLowerCase());

      const matchesDept = !deptFilter || dept === deptFilter;
      const matchesProject = !projectFilter || data.projectName === projectFilter;
      
      let matchesStatus = true;
      if (statusFilter) {
        if (statusFilter === 'Working') {
          matchesStatus = data.status === 'Working';
        } else if (statusFilter === 'Leave') {
          matchesStatus = data.status === 'Leave';
        } else if (statusFilter === 'Travelling') {
          matchesStatus = data.status === 'Travelling';
        } else {
          matchesStatus = false;
        }
      }

      let matchesToday = true;
      if (activeTodayOnly) {
        const targetProj = projects.find(p => p.name === data.projectName);
        const start = data.travelStartDate || targetProj?.startDate;
        const end = data.travelEndDate || targetProj?.endDate;
        if (start && end) {
          matchesToday = todayStr >= start && todayStr <= end;
        } else {
          matchesToday = false;
        }
      }

      // Filter by custom date range overlap
      const targetProj = projects.find(p => p.name === data.projectName);
      const start = data.travelStartDate || targetProj?.startDate;
      const end = data.travelEndDate || targetProj?.endDate;
      let matchesDateRange = true;
      if (start && end) {
        matchesDateRange = !(end < startDateStr || start > endDateStr);
      }

      return matchesSearch && matchesDept && matchesProject && matchesStatus && matchesToday && matchesDateRange;
    });
  };

  const filteredEmployeesList = getFilteredEmployees();
  
  // Transform mapped array to Employee for compatibility
  const filteredAssigns = getFilteredAssignments().map(x => {
    const prof = profiles.find(p => p.id === x.data.employeeId);
    const projDetails = projects.find(p => p.name === x.data.projectName);
    return {
      index: x.index,
      data: {
        id: x.data.employeeId,
        name: prof?.name || 'Unknown',
        department: prof?.department || 'Unknown',
        designation: prof?.designation || 'Unknown',
        project: x.data.projectName,
        projectStartDate: projDetails?.startDate || '',
        projectEndDate: projDetails?.endDate || '',
        travelStartDate: x.data.travelStartDate,
        travelEndDate: x.data.travelEndDate,
        status: x.data.status,
        remarks: x.data.remarks
      }
    };
  });

  const getFilteredProjects = () => {
    return projects.map((p, idx) => ({ data: p, index: idx })).filter(({ data }) => {
      const projAssigns = assignments.filter(a => a.projectName === data.name);
      const matchesEmployeeOrDept = projAssigns.some(a => {
        const prof = profiles.find(p => p.id === a.employeeId);
        return (prof?.name || '').toLowerCase().includes(search.toLowerCase()) ||
               a.employeeId.toLowerCase().includes(search.toLowerCase()) ||
               (prof?.department || '').toLowerCase().includes(search.toLowerCase());
      });

      const matchesSearch = !search ||
        data.name.toLowerCase().includes(search.toLowerCase()) ||
        data.budgetCode.toLowerCase().includes(search.toLowerCase()) ||
        matchesEmployeeOrDept;

      return matchesSearch;
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Working':
      case 'Work':
      case 'W': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400';
      case 'Travelling':
      case 'Travel':
      case 'T': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400';
      case 'Leave':
      case 'L': return 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400';
      case 'Standby':
      case 'S': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header with Stats */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Master Sheet</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Unified management of Staff Project Allocations, Profiles, and Master Database configurations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Template template */}
          <button 
            onClick={downloadExcelTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Template
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleExcelImport} 
            className="hidden" 
            accept=".xlsx, .xls"
          />
          <button
            onClick={triggerUploadClick}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Excel
          </button>

          <button 
            onClick={() => setShowValidationPanel(!showValidationPanel)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer ${
              hasValidationErrors 
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : validationSummary.warningsCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            Validate Data 🔍 
            {hasValidationErrors && <span className="ml-1 px-1.5 py-0.5 text-[9px] bg-red-800 text-white rounded-full">{validationSummary.errorsCount}</span>}
          </button>

          <button
            disabled={hasValidationErrors}
            onClick={handleExportConsolidated}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-md ${
              hasValidationErrors
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-teal-600 hover:bg-teal-700 text-white cursor-pointer'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Consolidated Excel
          </button>

          <button
            disabled={hasValidationErrors}
            onClick={handleExportClick}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all shadow-md ${
              hasValidationErrors
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Database
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {activeSubTab === 'employees' ? 'Add Profile' : (activeSubTab === 'projects' ? 'Add Project' : 'New Assignment')}
          </button>
        </div>
      </div>

      {/* Validation Summary Panel */}
      {showValidationPanel && (
        <div className="glass-panel p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-800 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Roster & Planning Data Quality Check</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">Automatic verification of employee IDs, project ranges, overlaps, and attendance consistency.</p>
            </div>
            
            <div className="flex items-center gap-2">
              {validationSummary.issues.some(issue => 
                issue.recordType === 'Attendance' && 
                issue.message.includes('Attendance status mismatch')
              ) && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to automatically align all manual attendance records to match their expected system statuses? This will resolve all mismatch warnings.")) {
                      try {
                        const count = await autoAlignMismatches();
                        alert(`Success: Successfully aligned ${count} mismatched attendance record(s).`);
                      } catch (err) {
                        console.error("Failed to auto-align mismatches:", err);
                        alert("Error: Failed to auto-align attendance records.");
                      }
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-md transition-all cursor-pointer mr-1 animate-pulse"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-Align Mismatches ⚡
                </button>
              )}
              <button
                onClick={() => exportValidationReportToExcel(validationSummary.issues)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-455 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Validation Excel Report
              </button>
              <button 
                onClick={() => setShowValidationPanel(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* KPI grid counts */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800/40 text-center">
              <div className="text-xs font-semibold text-slate-400">Total Checked</div>
              <div className="text-xl font-extrabold text-slate-700 dark:text-slate-200 mt-1">
                🔍 {validationSummary.totalRecordsChecked}
              </div>
            </div>
            <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Valid Records</div>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                ✅ {validationSummary.validRecordsCount}
              </div>
            </div>
            <div className="p-3 bg-amber-50/40 dark:bg-amber-950/10 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center">
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">Active Warnings</div>
              <div className="text-xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
                ⚠️ {validationSummary.warningsCount}
              </div>
            </div>
            <div className="p-3 bg-red-50/40 dark:bg-red-950/10 rounded-xl border border-red-100 dark:border-red-900/30 text-center">
              <div className="text-xs font-semibold text-red-600 dark:text-red-400">Critical Errors</div>
              <div className="text-xl font-extrabold text-red-700 dark:text-red-300 mt-1">
                ❌ {validationSummary.errorsCount}
              </div>
            </div>
          </div>

          {/* Validation report list of issues */}
          <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
            {validationSummary.issues.length === 0 ? (
              <div className="p-4 bg-emerald-50/20 border border-emerald-200 dark:border-emerald-950/30 rounded-xl text-center text-sm font-semibold text-emerald-600 dark:text-emerald-450">
                ✅ All database integrity tests passed successfully! No errors or warnings found.
              </div>
            ) : (
              validationSummary.issues.map(issue => {
                const isError = issue.severity === 'Error';
                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      handleFixIssue(issue);
                      setShowValidationPanel(false);
                    }}
                    className={`flex items-start justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                      isError
                        ? 'bg-red-50/30 hover:bg-red-50/50 dark:bg-red-950/5 dark:hover:bg-red-950/10 border-red-200/50 dark:border-red-900/30'
                        : 'bg-amber-50/30 hover:bg-amber-50/50 dark:bg-amber-950/5 dark:hover:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30'
                    }`}
                  >
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isError
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{issue.recordType}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                        {issue.message}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        💡 Suggested Fix: {issue.resolution}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-brand-600 hover:text-brand-700 shrink-0 self-center hover:underline">
                      Fix Record &rarr;
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Database Tabs switcher */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl shadow-inner self-start w-fit">
        <button
          onClick={() => { setActiveSubTab('assignments'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'assignments' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <Link2 className="w-3.5 h-3.5" />
          Project Assignments ({assignments.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('employees'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'employees' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Employees Database ({profiles.length})
        </button>
        <button
          onClick={() => { setActiveSubTab('projects'); setSearch(''); }}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeSubTab === 'projects' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Projects Database ({projects.length})
        </button>
      </div>

      {/* Filters Card */}
      <div className="glass-panel p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full lg:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={
                activeSubTab === 'assignments' ? "Search assignments..." :
                activeSubTab === 'employees' ? "Search employees..." : "Search projects..."
              }
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors"
            />
          </div>

          {/* Date Range Selector */}
          {activeSubTab === 'assignments' && (
            <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-transparent text-xs font-semibold">
              <span className="text-slate-400 uppercase text-[9px] tracking-wider font-bold">Range:</span>
              <input
                type="date"
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="bg-transparent border-none p-0 focus:ring-0 text-slate-700 dark:text-slate-350 cursor-pointer w-24 text-[11px]"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                className="bg-transparent border-none p-0 focus:ring-0 text-slate-700 dark:text-slate-350 cursor-pointer w-24 text-[11px]"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Filters:</span>
          </div>
          
          {(activeSubTab === 'assignments' || activeSubTab === 'employees') && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-xs py-2 px-3 focus:outline-none cursor-pointer"
            >
              <option value="">All Departments</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {activeSubTab === 'assignments' && (
            <>
              <select
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-xs py-2 px-3 focus:outline-none cursor-pointer"
              >
                <option value="">All Projects</option>
                {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-xs py-2 px-3 focus:outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                {['Working', 'Leave', 'Travelling'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer bg-slate-100 dark:bg-slate-900 py-2 px-3 rounded-xl border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={activeTodayOnly}
                  onChange={e => setActiveTodayOnly(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                />
                Active Today Only
              </label>
            </>
          )}

          {activeSubTab === 'employees' && (
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-xs py-2 px-3 focus:outline-none cursor-pointer"
            >
              <option value="">All Statuses Today</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Main Grid Table */}
      <div className="glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          {activeSubTab === 'assignments' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-4 px-6">Emp ID</th>
                  <th className="py-4 px-6">Employee Name</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Designation</th>
                  <th className="py-4 px-6">Project</th>
                  <th className="py-4 px-6">Start Date</th>
                  <th className="py-4 px-6">End Date</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredAssigns.length > 0 ? (
                  filteredAssigns.map(({ data, index }) => (
                    <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-medium text-slate-600 dark:text-slate-400">{data.id}</td>
                      <td className="py-3.5 px-6 font-semibold text-slate-800 dark:text-white">{data.name}</td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{data.department}</td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{data.designation}</td>
                      <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">{data.project}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{formatToClientDate(data.travelStartDate)}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{formatToClientDate(data.travelEndDate)}</td>
                      <td className="py-3.5 px-6">
                        {(() => {
                          const todayStr = format(new Date(), 'yyyy-MM-dd');
                          const status = resolveStatusOnDate(data.id, todayStr, assignments, projects, leaves);
                          const label = status === 'W' ? 'Work' : status === 'T' ? 'Travel' : status === 'L' ? 'Leave' : status === 'S' ? 'Standby' : 'None';
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(label)}`}>
                              {label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(index)} className="p-1 hover:text-brand-500 text-slate-400 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Remove project assignment?")) deleteAssignment(index); }} className="p-1 hover:text-red-500 text-slate-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">No project assignments linked.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === 'employees' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-4 px-6">Employee ID</th>
                  <th className="py-4 px-6">Employee Name</th>
                  <th className="py-4 px-6">Department</th>
                  <th className="py-4 px-6">Designation</th>
                  <th className="py-4 px-6">Status Today</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredEmployeesList.length > 0 ? (
                  filteredEmployeesList.map(({ data: p, index }) => (
                    <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-700 dark:text-slate-300">{p.id}</td>
                      <td className="py-3.5 px-6 font-semibold text-slate-800 dark:text-white">{p.name}</td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{p.department}</td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{p.designation}</td>
                      <td className="py-3.5 px-6">
                        {(() => {
                          const todayStatus = getTodayStatus(p);
                          switch (todayStatus) {
                            case 'W': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">Working</span>;
                            case 'T': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400">Travelling</span>;
                            case 'L': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">On Leave</span>;
                            case 'S': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400">Standby</span>;
                            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800/60 dark:text-slate-400">-</span>;
                          }
                        })()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(index)} className="p-1 hover:text-brand-500 text-slate-400 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Delete employee profile? Doing so will remove all active project assignments for this employee.")) deleteProfile(index); }} className="p-1 hover:text-red-500 text-slate-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">No employee profiles defined or match filters. Add one above.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeSubTab === 'projects' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-4 px-6">Project Name</th>
                  <th className="py-4 px-6">Budget Code</th>
                  <th className="py-4 px-6">Start Date</th>
                  <th className="py-4 px-6">End Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {getFilteredProjects().length > 0 ? (
                  getFilteredProjects().map(({ data: p, index }) => (
                    <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-6 font-semibold text-slate-800 dark:text-white">{p.name}</td>
                      <td className="py-3.5 px-6 font-mono font-medium text-slate-600 dark:text-slate-400">{p.budgetCode || '-'}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{formatToClientDate(p.startDate)}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{formatToClientDate(p.endDate)}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(index)} className="p-1 hover:text-brand-500 text-slate-400 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Delete project? Doing so will remove all assignments linked to this project.")) deleteProject(index); }} className="p-1 hover:text-red-500 text-slate-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No projects defined or match filters. Add one above.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* CRUD Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingIndex !== null ? 'Edit Details' : 'Add New Details'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
              {activeSubTab === 'employees' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Employee ID</label>
                    <input
                      type="text"
                      required
                      value={profileForm.id}
                      onChange={e => setProfileForm(p => ({ ...p, id: e.target.value.toUpperCase().trim() }))}
                      disabled={editingIndex !== null}
                      placeholder="EMP001"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Employee Name</label>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
                    <input
                      type="text"
                      required
                      value={profileForm.department}
                      onChange={e => setProfileForm(p => ({ ...p, department: e.target.value }))}
                      placeholder="Engineering"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Designation</label>
                    <input
                      type="text"
                      required
                      value={profileForm.designation}
                      onChange={e => setProfileForm(p => ({ ...p, designation: e.target.value }))}
                      placeholder="Developer"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              {activeSubTab === 'projects' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Name</label>
                    <input
                      type="text"
                      required
                      value={projectForm.name}
                      onChange={e => setProjectForm(p => ({ ...p, name: e.target.value }))}
                      disabled={editingIndex !== null}
                      placeholder="Project Apollo"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Budget Code</label>
                    <input
                      type="text"
                      required
                      value={projectForm.budgetCode}
                      onChange={e => setProjectForm(p => ({ ...p, budgetCode: e.target.value.toUpperCase() }))}
                      placeholder="BC-2026-ENG-01"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project Start Date</label>
                    <input
                      type="date"
                      required
                      value={projectForm.startDate}
                      onChange={e => setProjectForm(p => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Project End Date</label>
                    <input
                      type="date"
                      required
                      value={projectForm.endDate}
                      onChange={e => setProjectForm(p => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              {activeSubTab === 'assignments' && (
                <div className="space-y-4">
                  {/* Select Employee */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Employee ID / Name</label>
                    <input
                      type="text"
                      value={empSearch}
                      disabled={editingIndex !== null}
                      placeholder="Type name or ID to search..."
                      onFocus={() => {
                        setIsEmpOpen(true);
                        setActiveEmpIdx(0);
                      }}
                      onBlur={() => setTimeout(() => setIsEmpOpen(false), 250)}
                      onKeyDown={handleEmpKeyDown}
                      onChange={e => {
                        setEmpSearch(e.target.value);
                        setIsEmpOpen(true);
                        setActiveEmpIdx(0);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                    {isEmpOpen && editingIndex === null && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-xl">
                        {filteredProfiles.length > 0 ? (
                          filteredProfiles.map((p, idx) => {
                            const isSelected = idx === activeEmpIdx;
                            return (
                              <div
                                onClick={() => {
                                  setAssignForm(prev => ({ ...prev, employeeId: p.id }));
                                  setEmpSearch(`${p.id} - ${p.name}`);
                                  setIsEmpOpen(false);
                                }}
                                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                                  isSelected 
                                    ? 'bg-brand-600 text-white font-bold dark:bg-brand-700' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className={isSelected ? 'text-white' : 'font-semibold text-slate-900 dark:text-white'}>{p.id}</span> - {p.name} <span className={`text-xs ${isSelected ? 'text-brand-200' : 'text-slate-400'}`}>({p.department})</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">No matching employees found</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Select Project */}
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Project Name</label>
                    <input
                      type="text"
                      value={projSearch}
                      disabled={editingIndex !== null}
                      placeholder="Type project name to search..."
                      onFocus={() => {
                        setIsProjOpen(true);
                        setActiveProjIdx(0);
                      }}
                      onBlur={() => setTimeout(() => setIsProjOpen(false), 250)}
                      onKeyDown={handleProjKeyDown}
                      onChange={e => {
                        setProjSearch(e.target.value);
                        setIsProjOpen(true);
                        setActiveProjIdx(0);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 disabled:opacity-50"
                    />
                    {isProjOpen && editingIndex === null && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto shadow-xl">
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map((p, idx) => {
                            const isSelected = idx === activeProjIdx;
                            return (
                              <div
                                onClick={() => {
                                  setAssignForm(prev => ({
                                    ...prev,
                                    projectName: p.name,
                                    travelStartDate: p.startDate,
                                    travelEndDate: p.endDate
                                  }));
                                  setProjSearch(p.name);
                                  setIsProjOpen(false);
                                }}
                                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${
                                  isSelected 
                                    ? 'bg-brand-600 text-white font-bold dark:bg-brand-700' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className={isSelected ? 'text-white font-bold' : 'font-semibold text-slate-900 dark:text-white'}>{p.name}</span> <span className={`text-xs ${isSelected ? 'text-brand-200' : 'text-slate-400'}`}>({p.budgetCode})</span>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">No matching projects found</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Start Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={assignForm.travelStartDate}
                        onChange={e => setAssignForm(p => ({ ...p, travelStartDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    {/* End Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={assignForm.travelEndDate}
                        onChange={e => setAssignForm(p => ({ ...p, travelEndDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Remarks</label>
                    <input
                      type="text"
                      value={assignForm.remarks}
                      onChange={e => setAssignForm(p => ({ ...p, remarks: e.target.value }))}
                      placeholder="Role and project details"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
                >
                  Save Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Date Range Selection Modal for Consolidated Excel Export */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-500" />
                Select Export Date Range
              </h3>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4 text-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specify the date range period for the consolidated attendance roster spreadsheet.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">From Date</label>
                  <input
                    type="date"
                    required
                    value={exportStartDate}
                    onChange={e => setExportStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">To Date</label>
                  <input
                    type="date"
                    required
                    value={exportEndDate}
                    onChange={e => setExportEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={performConsolidatedExport}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                >
                  Download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
