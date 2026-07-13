import { useState } from 'react';
import { Trash2, Eye, X, AlertCircle } from 'lucide-react';
import { formatToClientDate } from '../utils/timelineHelper';

interface RecycleBinViewProps {
  recycleBin: any[];
  restoreRecycleItem: (itemId: string) => Promise<void>;
  deleteRecycleItemPermanently: (itemId: string) => Promise<void>;
}

export default function RecycleBinView({
  recycleBin,
  restoreRecycleItem,
  deleteRecycleItemPermanently
}: RecycleBinViewProps) {
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isActioning, setIsActioning] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    try {
      setIsActioning(id);
      await restoreRecycleItem(id);
      alert('Record successfully restored!');
    } catch (err: any) {
      alert(`Restoration failed: ${err.message || err}`);
    } finally {
      setIsActioning(null);
    }
  };

  const handleDeletePermanent = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      setIsActioning(id);
      await deleteRecycleItemPermanently(id);
      alert('Record permanently deleted.');
    } catch (err: any) {
      alert(`Deletion failed: ${err.message || err}`);
    } finally {
      setIsActioning(null);
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'profile': return 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/20';
      case 'project': return 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/20';
      case 'assignment': return 'bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900/20';
      case 'leave': return 'bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 border-pink-100 dark:border-pink-900/20';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Trash2 className="w-7 h-7 text-rose-500" />
          Recycle Bin
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Recover deleted employees, projects, assignments, and leaves within 30 days before they are pruned automatically.
        </p>
      </div>

      {/* Main Table Panel */}
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-6">Record Type</th>
                <th className="py-3.5 px-6">Original ID/Key</th>
                <th className="py-3.5 px-6">Record Summary</th>
                <th className="py-3.5 px-6">Deleted Date</th>
                <th className="py-3.5 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {recycleBin && recycleBin.length > 0 ? (
                recycleBin.map((item) => {
                  let summary = '';
                  if (item.type === 'profile') {
                    summary = `Name: ${item.data?.name} | Dept: ${item.data?.department} | Designation: ${item.data?.designation}`;
                  } else if (item.type === 'project') {
                    summary = `Budget: ${item.data?.budgetCode} | Dates: ${formatToClientDate(item.data?.startDate)} to ${formatToClientDate(item.data?.endDate)}`;
                  } else if (item.type === 'assignment') {
                    summary = `Project: ${item.data?.projectName} | Employee: ${item.data?.employeeId} | Travel: ${formatToClientDate(item.data?.travelStartDate)} to ${formatToClientDate(item.data?.travelEndDate)}`;
                  } else if (item.type === 'leave') {
                    summary = `Employee: ${item.data?.employeeName} | Dates: ${formatToClientDate(item.data?.fromDate)} to ${formatToClientDate(item.data?.toDate)} | Type: ${item.data?.leaveType}`;
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getTypeBadgeClass(item.type)}`}>
                          {item.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {item.originalId}
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 dark:text-slate-350 font-semibold text-xs leading-relaxed max-w-xs truncate" title={summary}>
                        {summary}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(item.deletedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-650 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Check record details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                          <button
                            onClick={() => handleRestore(item.id)}
                            disabled={isActioning === item.id}
                            className="px-2.5 py-1 text-xs font-bold bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 dark:border-brand-900/30 rounded-lg cursor-pointer"
                            title="Restore record back to database"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handleDeletePermanent(item.id)}
                            disabled={isActioning === item.id}
                            className="p-1 hover:text-red-500 text-slate-400 cursor-pointer"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2 justify-center py-4">
                      <AlertCircle className="w-9 h-9 text-slate-300" />
                      <span className="font-semibold text-sm">Recycle Bin is empty. No deleted records found.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item details Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />

          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-850">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-500" />
                  Recycled Record Properties
                </h3>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-slate-50 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Record Type</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 uppercase">{selectedItem.type}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Original ID/Key</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">{selectedItem.originalId}</span>
                </div>
                <div>
                  <span className="font-extrabold text-slate-450 uppercase block">Deleted Date</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{new Date(selectedItem.deletedAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] font-extrabold text-slate-450 uppercase block mb-2">Properties Content</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(selectedItem.data || {}).map(([key, val]) => {
                    const displayVal = val === null || val === undefined || val === '' ? '-' : String(val);
                    const formattedKey = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, str => str.toUpperCase());
                    return (
                      <div key={key} className="py-1 border-b border-slate-100 dark:border-slate-800/40">
                        <span className="font-semibold text-slate-400 block mb-0.5">{formattedKey}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-150 dark:border-slate-850">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const id = selectedItem.id;
                    setSelectedItem(null);
                    handleRestore(id);
                  }}
                  className="px-5 py-2 bg-indigo-650 hover:bg-indigo-705 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Restore Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
