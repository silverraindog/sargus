import React from 'react';
import { History, Swords, Trash2, Download, ExternalLink, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { AttackHistoryItem } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle } from '../utils/ffscouter';

interface AttackHistoryTabProps {
  history: AttackHistoryItem[];
  onClearHistory: () => void;
  onRemoveItem: (id: string) => void;
  onAttackAgain: (item: AttackHistoryItem) => void;
}

export const AttackHistoryTab: React.FC<AttackHistoryTabProps> = ({
  history,
  onClearHistory,
  onRemoveItem,
  onAttackAgain,
}) => {
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Metrics
  const totalAttacks = history.length;
  const last24hCount = history.filter((h) => Date.now() - h.timestamp < 24 * 60 * 60 * 1000).length;
  const uniqueTargetsCount = new Set(history.map((h) => h.targetId)).size;

  // CSV Export
  const handleExportCsv = () => {
    if (history.length === 0) return;
    const headers = ['Timestamp', 'Date', 'Target Name', 'Target ID', 'Level', 'Est Stats', 'Difficulty', 'FF Multiplier'];
    const rows = history.map((h) => [
      h.timestamp,
      new Date(h.timestamp).toLocaleString(),
      `"${h.targetName}"`,
      h.targetId,
      h.targetLevel,
      h.estimatedTotalStats,
      h.difficultyLabel,
      h.estimatedFFMultiplier,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sargus_attack_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (history.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 my-6">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">No Attack Activity Logged Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Every time you click an 'ATTACK' button for any target, it will automatically record the timestamp and raid details here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
          <div className="text-slate-500 text-xs font-semibold uppercase">Total Attacks Logged</div>
          <div className="text-2xl font-extrabold text-white mt-1">{totalAttacks}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Recorded raid clicks</div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
          <div className="text-slate-500 text-xs font-semibold uppercase">Attacks (Last 24h)</div>
          <div className="text-2xl font-extrabold text-red-400 mt-1">{last24hCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Recent chain activity</div>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
          <div className="text-slate-500 text-xs font-semibold uppercase">Unique Targets Raided</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{uniqueTargetsCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Distinct player accounts</div>
        </div>
      </div>

      {/* Main History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Raiding Activity Log</h3>
            <span className="text-xs text-slate-400 font-mono">({history.length} entries)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-xs text-rose-300 font-mono flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Log
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Attacked Target</th>
                <th className="py-3.5 px-3 font-semibold">Timestamp</th>
                <th className="py-3.5 px-3 font-semibold">Est. Battle Stats</th>
                <th className="py-3.5 px-3 font-semibold">Difficulty</th>
                <th className="py-3.5 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.map((item) => {
                const diffStyle = getDifficultyBadgeStyle(item.difficulty);

                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
                    {/* Target info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-amber-400 shrink-0">
                          {item.targetLevel}
                        </div>
                        <div>
                          <div className="font-sans font-bold text-slate-100 text-sm flex items-center gap-1.5">
                            <span>{item.targetName}</span>
                            <a
                              href={`https://www.torn.com/profiles.php?XID=${item.targetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            ID: <span className="text-slate-400">{item.targetId}</span>
                            {item.factionName && <span> · {item.factionName}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{formatTimeAgo(item.timestamp)}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                    </td>

                    {/* Est Stats */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-200">
                        ~{formatStatNumber(item.estimatedTotalStats)} <span className="text-slate-500 font-normal">BS</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        FF: {item.estimatedFFMultiplier}x
                      </div>
                    </td>

                    {/* Difficulty */}
                    <td className="py-3.5 px-3">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${diffStyle.badgeBg}`}>
                        {item.difficultyLabel}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-500 hover:text-rose-400 border border-slate-800 transition-colors"
                          title="Remove entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={item.attackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => onAttackAgain(item)}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/50 transition-colors"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>ATTACK AGAIN</span>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
