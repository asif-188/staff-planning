import { useState } from 'react';
import type { AuditLogEntry } from '../hooks/usePlanningState';
import { 
  History, 
  RotateCcw, 
  Search, 
  Download, 
  User, 
  Database,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { exportAuditLogToExcel } from '../utils/excelHelper';

interface AuditLogViewProps {
  auditLogs: AuditLogEntry[];
  revertChange: (log: AuditLogEntry) => Promise<void>;
}

export default function AuditLogView({ auditLogs, revertChange }: AuditLogViewProps) {
  const [operatorName, setOperatorName] = useState(() => {
    return localStorage.getItem('v2_active_operator_name') || 'HR Administrator';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [isSubmittingRevert, setIsSubmittingRevert] = useState<string | null>(null);
  
  // Selected log for detailed difference inspection modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const handleOperatorChange = (val: string) => {
    setOperatorName(val);
    localStorage.setItem('v2_active_operator_name', val);
  };

  const handleRevert = async (log: AuditLogEntry) => {
    const confirmation = confirm(
      `Revert action?\n\nType: ${log.recordType.toUpperCase()}\nAction: ${log.actionType.toUpperCase()}\nDescription: ${log.description}\n\nThis will apply changes to restore historical database records.`
    );
    if (!confirmation) return;

    try {
      setIsSubmittingRevert(log.id);
      await revertChange(log);
      alert('Action successfully rolled back!');
    } catch (err: any) {
      alert(`Rollback failed: ${err.message || err}`);
    } finally {
      setIsSubmittingRevert(null);
    }
  };

  // Filter logs
  const filteredLogs = auditLogs.filter(log => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || 
      log.who.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.recordId.toLowerCase().includes(q);

    const matchesAction = !actionFilter || log.actionType === actionFilter;
    const matchesTarget = !targetFilter || log.recordType === targetFilter;

    return matchesSearch && matchesAction && matchesTarget;
  });

  // Calculate statistics
  const totalCount = auditLogs.length;
  const updateCount = auditLogs.filter(l => l.actionType === 'update').length;
  const deleteCount = auditLogs.filter(l => l.actionType === 'delete').length;
  const createCount = auditLogs.filter(l => l.actionType === 'create').length;

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'create': return 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20';
      case 'update': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/20';
      case 'delete': return 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/20';
      case 'restore': return 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/20';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  const getRecordBadgeClass = (recType: string) => {
    switch (recType) {
      case 'profile': return 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/20';
      case 'project': return 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/20';
      case 'assignment': return 'bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 border-teal-100 dark:border-teal-900/20';
      case 'leave': return 'bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 border-pink-100 dark:border-pink-900/20';
      default: return 'bg-slate-50 text-slate-750';
    }
  };

  const renderDifference = (log: AuditLogEntry) => {
    if (!log.oldValue && !log.newValue) return <span className="text-xs text-slate-400 italic">No value data available</span>;

    const renderValGrid = (obj: any) => {
      return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs pt-1.5">
          {Object.entries(obj || {}).map(([key, val]) => {
            const displayVal = val === null || val === undefined || val === '' ? '-' : String(val);
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            return (
              <div key={key} className="py-1 border-b border-slate-100 dark:border-slate-800/40">
                <span className="font-semibold text-slate-400 block mb-0.5">{formattedKey}</span>
                <span className="font-bold text-slate-750 dark:text-slate-200">{displayVal}</span>
              </div>
            );
          })}
        </div>
      );
    };

    if (log.actionType === 'create') {
      return (
        <div className="space-y-1.5 p-4 bg-emerald-50/20 dark:bg-emerald-950/10 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
          <span className="text-xs font-bold text-emerald-600 block mb-1">Created fields & properties:</span>
          {renderValGrid(log.newValue)}
        </div>
      );
    }

    if (log.actionType === 'delete') {
      return (
        <div className="space-y-1.5 p-4 bg-red-50/20 dark:bg-red-950/10 rounded-xl border border-red-100/50 dark:border-red-900/20">
          <span className="text-xs font-bold text-red-600 block mb-1">Deleted fields & properties:</span>
          {renderValGrid(log.oldValue)}
        </div>
      );
    }

    if (log.actionType === 'update') {
      const oldObj = log.oldValue || {};
      const newObj = log.newValue || {};
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      const changes = allKeys.filter(k => JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k]));

      if (changes.length === 0) return <span className="text-xs text-slate-400 italic">No visible property edits.</span>;

      return (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/20 text-xs">
          <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            Edits & Field Comparisons
          </div>
          <div className="p-3 space-y-2">
            {changes.map(k => (
              <div key={k} className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/40 last:border-b-0">
                <span className="font-bold text-slate-500 dark:text-slate-400 truncate">{k}</span>
                <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded font-mono truncate" title={String(oldObj[k])}>
                  - {oldObj[k] !== undefined ? String(oldObj[k]) : 'null'}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-1.5 py-0.5 rounded font-mono truncate" title={String(newObj[k])}>
                  + {newObj[k] !== undefined ? String(newObj[k]) : 'null'}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header and User setup */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-7 h-7 text-indigo-500" />
            Audit Logging & Recoveries
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Automated change logs tracking every database create, delete, update, or restore. Recover previous values instantly.
          </p>
        </div>

        {/* HR Username Input */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-950 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm self-start lg:self-center">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-600">
            <User className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Operator Profile</span>
            <input
              type="text"
              value={operatorName}
              onChange={e => handleOperatorChange(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:outline-none text-slate-700 dark:text-slate-200 mt-0.5 p-0"
              placeholder="Enter your name..."
            />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-500 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Tracked</p>
            <h4 className="text-xl font-bold text-slate-850 dark:text-white mt-0.5">{totalCount}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Creations</p>
            <h4 className="text-xl font-bold text-slate-805 dark:text-white mt-0.5">{createCount}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-500 rounded-xl">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Updates</p>
            <h4 className="text-xl font-bold text-slate-805 dark:text-white mt-0.5">{updateCount}</h4>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-xl">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Deletions</p>
            <h4 className="text-xl font-bold text-slate-805 dark:text-white mt-0.5">{deleteCount}</h4>
          </div>
        </div>
      </div>

      {/* Filter and controls bar */}
      <div className="bg-white dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search operator, details, document ID..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Action and target dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="">All Actions</option>
            <option value="create">CREATE</option>
            <option value="update">UPDATE</option>
            <option value="delete">DELETE</option>
            <option value="restore">RESTORE</option>
          </select>

          <select
            value={targetFilter}
            onChange={e => setTargetFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:outline-none cursor-pointer"
          >
            <option value="">All Targets</option>
            <option value="profile">Employee Profile</option>
            <option value="project">Project Details</option>
            <option value="assignment">Assignment</option>
            <option value="leave">Leave Request</option>
          </select>

          <button
            onClick={() => exportAuditLogToExcel(filteredLogs)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            Audit Excel
          </button>
        </div>
      </div>

      {/* Main logs list */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                <th className="py-3 px-6">Timestamp</th>
                <th className="py-3 px-6">Operator</th>
                <th className="py-3 px-6 text-center">Action</th>
                <th className="py-3 px-6 text-center">Target</th>
                <th className="py-3 px-6">Description</th>
                <th className="py-3 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-850/60 text-sm">
              {filteredLogs.length > 0 ? (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-500 whitespace-nowrap text-xs">
                      {new Date(log.when).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-700 dark:text-slate-200 text-xs">
                      {log.who}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getActionBadgeClass(log.actionType)}`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${getRecordBadgeClass(log.recordType)}`}>
                        {log.recordType}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-700 dark:text-slate-300 font-semibold text-xs leading-relaxed max-w-[320px] truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          View Diff
                        </button>
                        <button
                          onClick={() => handleRevert(log)}
                          disabled={isSubmittingRevert === log.id}
                          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                            isSubmittingRevert === log.id
                              ? 'bg-slate-100 text-slate-400 cursor-wait'
                              : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-455 border border-rose-200 dark:border-rose-800 cursor-pointer'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Revert
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No change records match filter parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Difference view Modal Dialog */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />

          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-850">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  Property Difference Inspector
                </h3>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="px-2.5 py-1 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 rounded-lg text-slate-405"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Timestamp</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(selectedLog.when).toLocaleString()}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Operator</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedLog.who}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Action</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase">{selectedLog.actionType}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Target Id</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{selectedLog.recordId}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-850 rounded-xl">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase block mb-1">Audit trail description</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{selectedLog.description}</p>
              </div>

              <div className="space-y-3">
                {renderDifference(selectedLog)}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-150 dark:border-slate-850">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
                <button
                  onClick={() => {
                    const log = selectedLog;
                    setSelectedLog(null);
                    handleRevert(log);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Revert Change
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
