import { useState, useRef } from 'react';
import type { EmployeeProfile, ProjectDetails, ProjectAssignment, Employee } from '../hooks/usePlanningState';
import { importFromExcel, exportToExcel, importProjectsFromExcel, importEmployeesFromExcel, downloadExcelTemplate } from '../utils/excelHelper';
import { format } from 'date-fns';
import { normalizeDateString } from '../utils/timelineHelper';
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
  Link2
} from 'lucide-react';

interface MasterSheetViewProps {
  employees: Employee[]; // merged legacy array for compatibility/exports
  attendance: any;
  manualLeaves: any;
  // Normalized API
  profiles: EmployeeProfile[];
  projects: ProjectDetails[];
  assignments: ProjectAssignment[];
  addProfile: (p: EmployeeProfile) => boolean;
  editProfile: (idx: number, p: EmployeeProfile) => void;
  deleteProfile: (idx: number) => void;
  addProject: (p: ProjectDetails) => boolean;
  editProject: (idx: number, p: ProjectDetails) => void;
  deleteProject: (idx: number) => void;
  addAssignment: (a: ProjectAssignment) => void;
  editAssignment: (idx: number, a: ProjectAssignment) => void;
  deleteAssignment: (idx: number) => void;
  getMergedAssignments: () => Employee[];

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
}

export default function MasterSheetView({
  employees,
  attendance,
  manualLeaves,
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
  getMergedAssignments,

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
  setActiveTodayOnly
}: MasterSheetViewProps) {
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [profileForm, setProfileForm] = useState<EmployeeProfile>({ id: '', name: '', department: 'Engineering', function: '' });
  const [projectForm, setProjectForm] = useState<ProjectDetails>({ name: '', budgetCode: '', startDate: '', endDate: '' });
  const [assignForm, setAssignForm] = useState<ProjectAssignment>({
    employeeId: '',
    projectName: '',
    travelStartDate: '',
    travelEndDate: '',
    status: 'Working',
    remarks: ''
  });

  const targetProj = projects.find(p => p.name === assignForm.projectName);

  // Searchable select states
  const [empSearch, setEmpSearch] = useState('');
  const [isEmpOpen, setIsEmpOpen] = useState(false);
  const [activeEmpIdx, setActiveEmpIdx] = useState(0);
  const [projSearch, setProjSearch] = useState('');
  const [isProjOpen, setIsProjOpen] = useState(false);
  const [activeProjIdx, setActiveProjIdx] = useState(0);

  const uniqueDepts = Array.from(new Set(profiles.map(p => p.department)));
  const uniqueProjects = Array.from(new Set(projects.map(p => p.name)));
  const statuses = ['Working', 'Leave', 'Travelling'];

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
      setProfileForm({ id: '', name: '', department: 'Engineering', function: '' });
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
      if (assignForm.status !== 'Leave' && !assignForm.projectName) return;
      
      const targetProj = projects.find(p => p.name === assignForm.projectName);
      const rawStart = assignForm.travelStartDate || targetProj?.startDate || '';
      const rawEnd = assignForm.travelEndDate || targetProj?.endDate || '';
      const completeData = {
        ...assignForm,
        projectName: assignForm.status === 'Leave' ? '' : assignForm.projectName,
        travelStartDate: normalizeDateString(rawStart),
        travelEndDate: normalizeDateString(rawEnd)
      };

      // Check project date bounds validation
      if (completeData.status !== 'Leave' && targetProj) {
        const pStart = targetProj.startDate;
        const pEnd = targetProj.endDate;
        const tStart = completeData.travelStartDate;
        const tEnd = completeData.travelEndDate;
        
        if (tStart < pStart || tEnd > pEnd) {
          alert(`Validation Error: Travel dates (${tStart} to ${tEnd}) fall outside of the Project bounds (${pStart} to ${pEnd}) for '${targetProj.name}'. Travel dates must be within project bounds!`);
          return;
        }
      }

      // Check overlapping date validation for same employee
      const newStart = completeData.travelStartDate;
      const newEnd = completeData.travelEndDate;
      if (newStart && newEnd) {
        const overlappingAssign = assignments.find((a, idx) => {
          if (editingIndex !== null && idx === editingIndex) return false;
          if (a.employeeId !== completeData.employeeId) return false;
          // Overlap check formula: (StartA <= EndB) and (EndA >= StartB)
          return (newStart <= a.travelEndDate) && (newEnd >= a.travelStartDate);
        });

        if (overlappingAssign) {
          const empName = profiles.find(p => p.id === completeData.employeeId)?.name || 'Employee';
          const projText = overlappingAssign.projectName ? `project '${overlappingAssign.projectName}'` : 'Leave';
          alert(`Validation Error: ${empName} (${completeData.employeeId}) is already assigned to ${projText} from ${overlappingAssign.travelStartDate} to ${overlappingAssign.travelEndDate}. Double-booking is not allowed!`);
          return;
        }
      }

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
          const newProfiles = [...profiles];
          let added = 0;
          imported.forEach(emp => {
            if (!newProfiles.some(p => p.id === emp.id)) {
              newProfiles.push(emp);
              added++;
            }
          });
          localStorage.setItem('v2_employee_profiles', JSON.stringify(newProfiles));
          alert(`Successfully imported ${added} new employee profiles!`);
          window.location.reload();
        }
      } else if (activeSubTab === 'projects') {
        const imported = await importProjectsFromExcel(file);
        if (confirm(`Do you want to import ${imported.length} Projects directly into the Projects Database?`)) {
          const newProjects = [...projects];
          let added = 0;
          imported.forEach(proj => {
            if (!newProjects.some(p => p.name.toLowerCase() === proj.name.toLowerCase())) {
              newProjects.push(proj);
              added++;
            }
          });
          localStorage.setItem('v2_projects_list', JSON.stringify(newProjects));
          alert(`Successfully imported ${added} new projects!`);
          window.location.reload();
        }
      } else {
        // Assignments Tab Import
        const imported = await importFromExcel(file);
        if (confirm(`Do you want to import and normalize ${imported.length} rows of assignments?`)) {
          const newProfiles: EmployeeProfile[] = [...profiles];
          const newProjects: ProjectDetails[] = [...projects];
          const newAssignments: ProjectAssignment[] = [];

          let overlapError = "";
          for (let i = 0; i < imported.length; i++) {
            const emp = imported[i];
            const start = emp.travelStartDate || emp.projectStartDate;
            const end = emp.travelEndDate || emp.projectEndDate;
            
            // Check project date bounds validation
            if (emp.status !== 'Leave') {
              const pStart = emp.projectStartDate;
              const pEnd = emp.projectEndDate;
              if (start < pStart || end > pEnd) {
                overlapError = `Row ${i + 2}: Travel dates (${start} to ${end}) for Employee '${emp.name}' (${emp.id}) fall outside Project '${emp.project}' duration bounds (${pStart} to ${pEnd}).`;
                break;
              }
            }

            // Check overlap against assignments already added in this import session
            const overlap = newAssignments.find(a => 
              a.employeeId === emp.id && (start <= a.travelEndDate) && (end >= a.travelStartDate)
            );

            if (overlap) {
              overlapError = `Row ${i + 2}: Employee '${emp.name}' (${emp.id}) has overlapping assignments between '${emp.project}' [${start} to ${end}] and '${overlap.projectName}' [${overlap.travelStartDate} to ${overlap.travelEndDate}].`;
              break;
            }

            // 1. Profile mapping
            if (!newProfiles.some(p => p.id === emp.id)) {
              newProfiles.push({ id: emp.id, name: emp.name, department: emp.department, function: emp.function });
            }
            // 2. Project mapping
            if (!newProjects.some(p => p.name.toLowerCase() === emp.project.toLowerCase())) {
              newProjects.push({ name: emp.project, budgetCode: emp.budgetCode, startDate: emp.projectStartDate, endDate: emp.projectEndDate });
            }
            // 3. Assignment mapping
            newAssignments.push({
              employeeId: emp.id,
              projectName: emp.project,
              travelStartDate: start,
              travelEndDate: end,
              status: emp.status,
              remarks: emp.remarks
            });
          }

          if (overlapError) {
            alert(`Excel Import Blocked due to Double-Booking Violations:\n\n${overlapError}\n\nPlease resolve conflicts and try again.`);
            return;
          }

          // Bulk load
          localStorage.setItem('v2_employee_profiles', JSON.stringify(newProfiles));
          localStorage.setItem('v2_projects_list', JSON.stringify(newProjects));
          localStorage.setItem('v2_assignments_list', JSON.stringify(newAssignments));
          window.location.reload();
        }
      }
    } catch (err: any) {
      alert("Error importing Excel: " + err.message);
    }
  };

  const handleExcelExport = async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    await exportToExcel(employees, attendance, manualLeaves, currentMonth);
  };

  const handleDownloadTemplate = async () => {
    if (activeSubTab === 'employees') {
      await downloadExcelTemplate(['Employee ID', 'Employee Name', 'Department', 'Function'], 'Employees_Template.xlsx');
    } else if (activeSubTab === 'projects') {
      await downloadExcelTemplate(['Project Name', 'Budget Code', 'Start Date', 'End Date'], 'Projects_Template.xlsx');
    } else {
      await downloadExcelTemplate([
        'Employee ID', 'Employee Name', 'Project', 'Budget Code', 
        'Project Start Date', 'Project End Date', 'Travel Start Date', 'Travel End Date', 
        'Status', 'Remarks'
      ], 'Assignments_Template.xlsx');
    }
  };

  // Status Badge Class
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Working': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400';
      case 'Leave': return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400';
      case 'Travelling': return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Render assignments list
  const getFilteredAssignments = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return getMergedAssignments().map((a, idx) => ({ data: a, index: idx })).filter(({ data }) => {
      const matchesSearch = 
        data.name.toLowerCase().includes(search.toLowerCase()) ||
        data.id.toLowerCase().includes(search.toLowerCase()) ||
        data.project.toLowerCase().includes(search.toLowerCase()) ||
        data.department.toLowerCase().includes(search.toLowerCase()) ||
        data.function.toLowerCase().includes(search.toLowerCase());

      const matchesDept = !deptFilter || data.department === deptFilter;
      const matchesProject = !projectFilter || data.project === projectFilter;
      const matchesStatus = !statusFilter || data.status === statusFilter;

      let matchesToday = true;
      if (activeTodayOnly) {
        const start = data.travelStartDate;
        const end = data.travelEndDate;
        if (start && end) {
          matchesToday = todayStr >= start && todayStr <= end;
        } else {
          matchesToday = false;
        }
      }

      return matchesSearch && matchesDept && matchesProject && matchesStatus && matchesToday;
    });
  };

  const getTodayStatus = (prof: EmployeeProfile) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Explicit attendance override
    const att = attendance[`${prof.id}_${todayStr}`];
    if (att) return att;

    // 2. Manual Leave
    const isManualLeave = manualLeaves.some((l: any) => l.employeeId === prof.id && l.date === todayStr);
    if (isManualLeave) return 'L';

    // 3. Project / Travel Assignments active today
    const empAssignments = assignments.filter(a => a.employeeId === prof.id);
    for (const a of empAssignments) {
      const foundProj = projects.find(p => p.name === a.projectName);
      const startStr = a.travelStartDate || foundProj?.startDate || '';
      const endStr = a.travelEndDate || foundProj?.endDate || '';
      if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const today = new Date(todayStr);
        if (today >= start && today <= end) {
          if (a.status === 'Leave') return 'L';
          if (a.status === 'Travelling') return 'T';
          
          // First day & Last day are Travel (T) for 'Working' status
          if (startStr === todayStr || endStr === todayStr) {
            return 'T';
          }
          return 'W';
        }
      }
    }

    // 4. Default: Not Assigned (Absent today)
    return 'A';
  };

  const getFilteredEmployees = () => {
    return profiles.map((p, idx) => ({ data: p, index: idx })).filter(({ data }) => {
      const matchesSearch = !search || 
        data.name.toLowerCase().includes(search.toLowerCase()) ||
        data.id.toLowerCase().includes(search.toLowerCase()) ||
        data.function.toLowerCase().includes(search.toLowerCase()) ||
        data.department.toLowerCase().includes(search.toLowerCase());

      const matchesDept = !deptFilter || data.department === deptFilter;

      let matchesStatus = true;
      if (statusFilter) {
        const todayStatus = getTodayStatus(data); // 'W' | 'T' | 'L' | 'A' | 'H' | 'HD'
        if (statusFilter === 'Working') {
          matchesStatus = todayStatus === 'W' || todayStatus === 'HD';
        } else if (statusFilter === 'Travelling') {
          matchesStatus = todayStatus === 'T';
        } else if (statusFilter === 'Leave') {
          matchesStatus = todayStatus === 'L' || todayStatus === 'H';
        }
      }

      return matchesSearch && matchesDept && matchesStatus;
    });
  };

  const filteredAssigns = getFilteredAssignments();
  const filteredEmployeesList = getFilteredEmployees();

  return (
    <div className="space-y-6">
      {/* Header Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Master Sheet</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Separately manage employees and projects, then assign and link them together.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" ref={fileInputRef} onChange={handleExcelImport} accept=".xlsx,.xls" className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </button>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Download className="w-4 h-4 text-brand-500" />
            Download Template
          </button>
          <button 
            onClick={handleExcelExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeSubTab === 'employees' ? 'Add Employee' : (activeSubTab === 'projects' ? 'Add Project' : 'Add Assignment')}
          </button>
        </div>
      </div>

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

      {/* Filters Card (Only for assignments or employees lists) */}
      {(activeSubTab === 'assignments' || activeSubTab === 'employees') && (
        <div className="glass-panel p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between border border-slate-200 dark:border-slate-800">
          <div className="relative w-full lg:w-96">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={activeSubTab === 'assignments' ? "Search by Employee, Project, ID..." : "Search by Employee Name, ID, Function..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-sm focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Filters:</span>
            </div>
            
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-brand-500 rounded-xl text-xs py-2 px-3 focus:outline-none cursor-pointer"
            >
              <option value="">All Departments</option>
              {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

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
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
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
          </div>
        </div>
      )}

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
                  <th className="py-4 px-6">Function</th>
                  <th className="py-4 px-6">Project</th>
                  <th className="py-4 px-6">Travel Start</th>
                  <th className="py-4 px-6">Travel End</th>
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
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{data.function}</td>
                      <td className="py-3.5 px-6 font-medium text-slate-700 dark:text-slate-300">{data.project}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{data.travelStartDate}</td>
                      <td className="py-3.5 px-6 text-xs font-mono">{data.travelEndDate}</td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(data.status)}`}>
                          {data.status}
                        </span>
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
                  <th className="py-4 px-6">Function</th>
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
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{p.function}</td>
                      <td className="py-3.5 px-6">
                        {(() => {
                          const todayStatus = getTodayStatus(p);
                          switch (todayStatus) {
                            case 'W': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">Working</span>;
                            case 'T': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400">Travelling</span>;
                            case 'L': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">On Leave</span>;
                            case 'H': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">Holiday</span>;
                            case 'HD': return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400">Half Day</span>;
                            default: return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">Absent</span>;
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
                {projects.length > 0 ? (
                  projects.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="py-3.5 px-6 font-bold text-slate-800 dark:text-white">{p.name}</td>
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-500 dark:text-slate-400">{p.budgetCode || '-'}</td>
                      <td className="py-3.5 px-6 font-mono text-xs">{p.startDate}</td>
                      <td className="py-3.5 px-6 font-mono text-xs">{p.endDate}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleOpenEdit(idx)} className="p-1 hover:text-brand-500 text-slate-400 transition-colors"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Delete project details? This removes active assignments linking to this project.")) deleteProject(idx); }} className="p-1 hover:text-red-500 text-slate-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No project details defined. Add one above.</td>
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
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Function</label>
                    <input
                      type="text"
                      required
                      value={profileForm.function}
                      onChange={e => setProfileForm(p => ({ ...p, function: e.target.value }))}
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
                                key={p.id}
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
                      value={assignForm.status === 'Leave' ? '' : projSearch}
                      disabled={editingIndex !== null || assignForm.status === 'Leave'}
                      placeholder={assignForm.status === 'Leave' ? 'Not applicable for Leaves...' : 'Type project name to search...'}
                      onFocus={() => {
                        if (assignForm.status !== 'Leave') {
                          setIsProjOpen(true);
                          setActiveProjIdx(0);
                        }
                      }}
                      onBlur={() => setTimeout(() => setIsProjOpen(false), 250)}
                      onKeyDown={handleProjKeyDown}
                      onChange={e => {
                        if (assignForm.status !== 'Leave') {
                          setProjSearch(e.target.value);
                          setIsProjOpen(true);
                          setActiveProjIdx(0);
                        }
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
                                key={p.name}
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
                    {/* Travel Start */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        {assignForm.status === 'Leave' ? 'Leave Start Date' : 'Travel Start Date'}
                      </label>
                      <input
                        type="date"
                        value={assignForm.travelStartDate}
                        min={assignForm.status === 'Leave' ? undefined : targetProj?.startDate}
                        max={assignForm.status === 'Leave' ? undefined : targetProj?.endDate}
                        onChange={e => setAssignForm(p => ({ ...p, travelStartDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    {/* Travel End */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        {assignForm.status === 'Leave' ? 'Leave End Date' : 'Travel End Date'}
                      </label>
                      <input
                        type="date"
                        value={assignForm.travelEndDate}
                        min={assignForm.status === 'Leave' ? undefined : targetProj?.startDate}
                        max={assignForm.status === 'Leave' ? undefined : targetProj?.endDate}
                        onChange={e => setAssignForm(p => ({ ...p, travelEndDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assignment Status</label>
                    <select
                      value={assignForm.status}
                      onChange={e => {
                        const nextStatus = e.target.value;
                        setAssignForm(p => {
                          const next = { ...p, status: nextStatus as any };
                          if (nextStatus === 'Leave') {
                            next.projectName = '';
                          }
                          return next;
                        });
                        if (nextStatus === 'Leave') {
                          setProjSearch('');
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 cursor-pointer"
                    >
                      <option value="Working">Working</option>
                      <option value="Leave">Leave</option>
                      <option value="Travelling">Travelling</option>
                    </select>
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
    </div>
  );
}
