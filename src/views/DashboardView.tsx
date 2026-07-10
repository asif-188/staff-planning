import type { EmployeeProfile, ProjectAssignment, ProjectDetails, AttendanceRecord, ManualLeave } from '../hooks/usePlanningState';
import { 
  Users, 
  Briefcase, 
  UserCheck, 
  PlaneTakeoff, 
  Coffee, 
  CalendarDays,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardViewProps {
  profiles: EmployeeProfile[];
  assignments: ProjectAssignment[];
  projects: ProjectDetails[];
  attendance: AttendanceRecord;
  manualLeaves: ManualLeave[];
  onNavigate: (
    tab: 'dashboard' | 'master-sheet' | 'planning' | 'attendance' | 'availability-finder' | 'settings',
    subTab?: 'assignments' | 'employees' | 'projects',
    filters?: {
      search?: string;
      deptFilter?: string;
      projectFilter?: string;
      statusFilter?: string;
      activeTodayOnly?: boolean;
    }
  ) => void;
}

export default function DashboardView({ 
  profiles, 
  assignments, 
  projects, 
  attendance, 
  manualLeaves,
  onNavigate
}: DashboardViewProps) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Helper to determine status of a profile today (live)
  const getTodayStatus = (prof: EmployeeProfile) => {
    // 1. Explicit attendance override
    const att = attendance[`${prof.id}_${todayStr}`];
    if (att) return att;

    // 2. Manual Leave
    const isManualLeave = manualLeaves.some(l => l.employeeId === prof.id && l.date === todayStr);
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

  // Resolve status metrics today
  const statuses = profiles.map(p => getTodayStatus(p));
  const working = statuses.filter(s => s === 'W').length;
  const travelling = statuses.filter(s => s === 'T').length;
  const leaves = statuses.filter(s => s === 'L').length;
  const holidays = statuses.filter(s => s === 'H').length;
  const halfDays = statuses.filter(s => s === 'HD').length;

  const totalEmployees = profiles.length;
  const activeProjectsCount = Array.from(new Set(assignments.map(a => a.projectName))).length;

  // Present today is defined as Working, Travelling, or Half Day
  const presentCount = working + travelling + halfDays;
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0;

  // 1. Department wise manpower
  const deptCount: { [key: string]: number } = {};
  profiles.forEach(p => {
    deptCount[p.department] = (deptCount[p.department] || 0) + 1;
  });
  const deptData = Object.entries(deptCount).map(([name, count]) => ({ name, count }));

  // 2. Project wise manpower allocation today
  const projectManpower: { [projectName: string]: number } = {};
  projects.forEach(p => {
    projectManpower[p.name] = 0;
  });
  profiles.forEach(prof => {
    const empAssignments = assignments.filter(a => a.employeeId === prof.id);
    for (const a of empAssignments) {
      if (!a.projectName) continue; // Skip assignments with empty project name (e.g. Leave status)
      const foundProj = projects.find(p => p.name === a.projectName);
      const startStr = a.travelStartDate || foundProj?.startDate || '';
      const endStr = a.travelEndDate || foundProj?.endDate || '';
      if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        const today = new Date(todayStr);
        if (today >= start && today <= end) {
          projectManpower[a.projectName] = (projectManpower[a.projectName] || 0) + 1;
          break; // only count once
        }
      }
    }
  });
  const projectData = Object.entries(projectManpower).map(([name, count]) => ({ name, count }));

  // Max value for scaling SVG graphs
  const maxDept = Math.max(...deptData.map(d => d.count), 1);
  const maxProj = Math.max(...projectData.map(p => p.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Overview of resource utilization, status overview, and real-time attendance analytics for {format(new Date(), 'dd MMMM yyyy')}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Employees */}
        <div 
          onClick={() => onNavigate('master-sheet', 'employees')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-brand-500/30 dark:hover:border-brand-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">Total Unique Staff</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{totalEmployees}</h3>
            </div>
            <div className="p-3 bg-brand-100 dark:bg-brand-950/50 rounded-xl text-brand-600 dark:text-brand-400 group-hover:bg-brand-500 group-hover:text-white transition-all duration-300">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="text-emerald-500 font-semibold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
              Active
            </span>
            <span>across all regions</span>
          </div>
        </div>

        {/* Total Projects */}
        <div 
          onClick={() => onNavigate('master-sheet', 'projects')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-indigo-500/30 dark:hover:border-indigo-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">Total Projects</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{projects.length}</h3>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-indigo-500">{activeProjectsCount} active</span>
            <span>({assignments.length} assignments)</span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div 
          onClick={() => onNavigate('attendance')}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-emerald-500/30 dark:hover:border-emerald-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">Attendance Rate</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{attendanceRate}%</h3>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-emerald-500">{presentCount} present</span>
            <span>today</span>
          </div>
        </div>

        {/* Staff on Leave */}
        <div 
          onClick={() => onNavigate('master-sheet', 'employees', { statusFilter: 'Leave' })}
          className="glass-panel p-6 rounded-2xl shadow-sm hover:scale-[1.02] cursor-pointer transition-all duration-300 hover:shadow-md hover:border-rose-500/30 dark:hover:border-rose-400/30 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors">Staff on Leave</p>
              <h3 className="text-3xl font-bold mt-1 text-slate-800 dark:text-white">{leaves}</h3>
            </div>
            <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl text-rose-600 dark:text-rose-400 group-hover:bg-rose-500 group-hover:text-white transition-all duration-300">
              <Coffee className="w-6 h-6" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <span>Absent from active roster</span>
          </div>
        </div>
      </div>

      {/* Staff Status Breakdown Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div 
          onClick={() => onNavigate('master-sheet', 'employees', { statusFilter: 'Working' })}
          className="glass-panel p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md hover:border-blue-500/30 dark:hover:border-blue-400/30 group transition-all duration-300"
        >
          <div className="p-3 bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Working</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{working + halfDays}</h4>
          </div>
        </div>
        <div 
          onClick={() => onNavigate('master-sheet', 'employees', { statusFilter: 'Travelling' })}
          className="glass-panel p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md hover:border-purple-500/30 dark:hover:border-purple-400/30 group transition-all duration-300"
        >
          <div className="p-3 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-all duration-300">
            <PlaneTakeoff className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Travelling</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{travelling}</h4>
          </div>
        </div>
        <div 
          onClick={() => onNavigate('master-sheet', 'employees', { statusFilter: 'Leave' })}
          className="glass-panel p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md hover:border-zinc-400/30 dark:hover:border-zinc-600/30 group transition-all duration-300"
        >
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 rounded-lg group-hover:bg-zinc-500 group-hover:text-white transition-all duration-300">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">On Leave / Holiday</p>
            <h4 className="text-xl font-bold text-slate-800 dark:text-white">{leaves + holidays}</h4>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Wise Manpower */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Project-wise Manpower Allocation</h3>
          <div className="space-y-4">
            {projectData.length > 0 ? (
              projectData.map(item => {
                const percent = (item.count / maxProj) * 100;
                return (
                  <div 
                    key={item.name} 
                    onClick={() => onNavigate('master-sheet', 'assignments', { projectFilter: item.name, activeTodayOnly: true })}
                    className="space-y-1 cursor-pointer group p-1.5 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 rounded-lg transition-all"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">{item.name}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">{item.count} Staff</span>
                    </div>
                    <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">No project data currently available.</p>
            )}
          </div>
        </div>

        {/* Department Wise Manpower */}
        <div className="glass-panel p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Department-wise Manpower</h3>
          <div className="space-y-4">
            {deptData.length > 0 ? (
              deptData.map(item => {
                const percent = (item.count / maxDept) * 100;
                return (
                  <div 
                    key={item.name} 
                    onClick={() => onNavigate('master-sheet', 'employees', { deptFilter: item.name })}
                    className="space-y-1 cursor-pointer group p-1.5 hover:bg-slate-100/50 dark:hover:bg-slate-900/30 rounded-lg transition-all"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">{item.name}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">{item.count} Staff</span>
                    </div>
                    <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm py-8 text-center">No department data available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
