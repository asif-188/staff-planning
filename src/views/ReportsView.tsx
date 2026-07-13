import { useState } from 'react';
import type { EmployeeProfile, ProjectDetails, ProjectAssignment, LeaveRecord } from '../hooks/usePlanningState';
import { getDatesForMonth, resolveStatusOnDate } from '../utils/timelineHelper';
import { exportToExcel } from '../utils/excelHelper';
import { format } from 'date-fns';
import { 
  FileSpreadsheet, 
  BarChart3, 
  Calendar,
  PieChart,
  UserCheck,
  DownloadCloud
} from 'lucide-react';

interface ReportsViewProps {
  profiles: EmployeeProfile[];
  projects: ProjectDetails[];
  assignments: ProjectAssignment[];
  leaves: LeaveRecord[];
}

export default function ReportsView({ 
  profiles, 
  projects, 
  assignments, 
  leaves 
}: ReportsViewProps) {
  const [reportMonth, setReportMonth] = useState('2026-05');
  const dates = getDatesForMonth(reportMonth);

  const [year, month] = reportMonth.split('-');
  const displayMonthName = format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy');

  const handleDownload = async () => {
    await exportToExcel(profiles, projects, assignments, leaves, reportMonth);
  };

  // Compile summary details based strictly on W, L, T, S and %
  const getCompiledData = () => {
    return profiles.map(prof => {
      let working = 0, leave = 0, travel = 0, standby = 0;
      
      dates.forEach(d => {
        const status = resolveStatusOnDate(prof.id, d.dateStr, assignments, projects, leaves);
        
        if (status === 'W') working++;
        else if (status === 'L') leave++;
        else if (status === 'T') travel++;
        else if (status === 'S') standby++;
      });

      const activeDays = working + travel;
      const totalScheduled = working + travel + leave + standby;
      const rate = totalScheduled > 0 ? Math.round((activeDays / totalScheduled) * 100) : 100;

      return {
        prof,
        working,
        leave,
        travel,
        standby,
        rate
      };
    });
  };

  const compiledData = getCompiledData();

  const reportCards = [
    {
      title: 'Attendance Summary',
      description: 'Calculates active vs scheduled days, standby metrics, and rates.',
      icon: <UserCheck className="w-5 h-5 text-emerald-500" />
    },
    {
      title: 'Leave Summary Report',
      description: 'Tracks employee rotation schedules, manual leaves, and auto leaves.',
      icon: <Calendar className="w-5 h-5 text-purple-500" />
    },
    {
      title: 'Utilization Report',
      description: 'Project allocation rates vs benchmark capacity.',
      icon: <BarChart3 className="w-5 h-5 text-blue-500" />
    },
    {
      title: 'Project Manpower Allocation',
      description: 'Aggregates FTE count and headcount by active project budgets.',
      icon: <PieChart className="w-5 h-5 text-brand-500" />
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Reports & Export</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Generate detailed Excel workbooks compiling all planning schedules and attendance statistics.
          </p>
        </div>

        {/* Download Trigger */}
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={reportMonth}
            onChange={e => setReportMonth(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-brand-500"
          />
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
          >
            <DownloadCloud className="w-4 h-4" />
            Download Excel Report
          </button>
        </div>
      </div>

      {/* Reports Available Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {reportCards.map((card, idx) => (
          <div key={idx} className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl w-fit">
                {card.icon}
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">{card.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{card.description}</p>
            </div>
            <button 
              onClick={handleDownload}
              className="mt-4 text-xs font-semibold text-brand-600 dark:text-brand-400 flex items-center gap-1.5 hover:underline"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download Report (.xlsx)
            </button>
          </div>
        ))}
      </div>

      {/* Overview Table */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Preview Summary: {displayMonthName}</h3>
        
        <div className="glass-panel overflow-hidden rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-6">Department</th>
                  <th className="py-3.5 px-6 text-center">Working (W)</th>
                  <th className="py-3.5 px-6 text-center">Travel (T)</th>
                  <th className="py-3.5 px-6 text-center">Leave (L)</th>
                  <th className="py-3.5 px-6 text-center">Standby (S)</th>
                  <th className="py-3.5 px-6 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {compiledData.map((data, index) => (
                  <tr key={index} className="hover:bg-slate-100/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="py-3 px-6 font-bold text-slate-800 dark:text-white">{data.prof.name}</td>
                    <td className="py-3 px-6 text-slate-600 dark:text-slate-400">{data.prof.department || '-'}</td>
                    <td className="py-3 px-6 text-center font-mono">{data.working}</td>
                    <td className="py-3 px-6 text-center font-mono text-purple-600 dark:text-purple-400">{data.travel}</td>
                    <td className="py-3 px-6 text-center font-mono text-slate-400">{data.leave}</td>
                    <td className="py-3 px-6 text-center font-mono text-orange-600 dark:text-orange-400">{data.standby}</td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-brand-600 dark:text-brand-400">{data.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
