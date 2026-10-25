import React, { useState, useMemo } from 'react';
import {
  History,
  Swords,
  Trash2,
  Download,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
  Flame,
  TrendingUp,
  BarChart3,
  Award,
  Zap,
  Percent,
  Archive,
  FolderArchive,
  ArchiveRestore,
  Database,
  X,
  Check,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { AttackHistoryItem } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle } from '../utils/ffscouter';

interface AttackHistoryTabProps {
  history: AttackHistoryItem[];
  archivedHistory: AttackHistoryItem[];
  onClearHistory: () => void;
  onRemoveItem: (id: string) => void;
  onAttackAgain: (item: AttackHistoryItem) => void;
  onUpdateResult: (id: string, result: 'SUCCESS' | 'FAILURE' | 'PENDING') => void;
  onArchiveOldLogs: () => { count: number; message: string };
  onRestoreArchived: () => void;
  onClearArchived: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const wins = payload.find((p: any) => p.dataKey === 'wins')?.value || 0;
    const losses = payload.find((p: any) => p.dataKey === 'losses')?.value || 0;
    const pending = payload.find((p: any) => p.dataKey === 'pending')?.value || 0;
    const total = wins + losses + pending;
    const rate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '0';

    return (
      <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl font-mono text-xs space-y-1.5 min-w-[150px]">
        <div className="font-bold text-white border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>Date: {label}</span>
          <span className="text-amber-400 font-bold">{rate}% Win</span>
        </div>
        <div className="text-emerald-400 flex items-center justify-between">
          <span>Success (Wins):</span>
          <span className="font-bold">{wins}</span>
        </div>
        <div className="text-rose-400 flex items-center justify-between">
          <span>Failures (Losses):</span>
          <span className="font-bold">{losses}</span>
        </div>
        {pending > 0 && (
          <div className="text-slate-400 flex items-center justify-between">
            <span>Pending:</span>
            <span className="font-bold">{pending}</span>
          </div>
        )}
        <div className="text-slate-500 pt-1 border-t border-slate-800/80 text-[10px] flex items-center justify-between">
          <span>Total Raids:</span>
          <span>{total}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AttackHistoryTab: React.FC<AttackHistoryTabProps> = ({
  history,
  archivedHistory,
  onClearHistory,
  onRemoveItem,
  onAttackAgain,
  onUpdateResult,
  onArchiveOldLogs,
  onRestoreArchived,
  onClearArchived,
}) => {
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [archiveBannerMsg, setArchiveBannerMsg] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [resultFilter, setResultFilter] = useState<'ALL' | 'SUCCESS' | 'FAILURE' | 'PENDING'>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | '24H' | '7D' | '30D' | '90D'>('ALL');

  // Filtered History calculation
  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      // 1. Search Query Filter (target name, target ID, faction name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = item.targetName.toLowerCase().includes(q);
        const idMatch = item.targetId.toString().includes(q);
        const factionMatch = item.factionName ? item.factionName.toLowerCase().includes(q) : false;
        if (!nameMatch && !idMatch && !factionMatch) return false;
      }

      // 2. Result Outcome Filter
      if (resultFilter !== 'ALL') {
        const itemResult = item.result || 'PENDING';
        if (itemResult !== resultFilter) return false;
      }

      // 3. Date Range Filter
      if (dateRangeFilter !== 'ALL') {
        const now = Date.now();
        let maxAgeMs = 0;
        if (dateRangeFilter === '24H') maxAgeMs = 24 * 60 * 60 * 1000;
        else if (dateRangeFilter === '7D') maxAgeMs = 7 * 24 * 60 * 60 * 1000;
        else if (dateRangeFilter === '30D') maxAgeMs = 30 * 24 * 60 * 60 * 1000;
        else if (dateRangeFilter === '90D') maxAgeMs = 90 * 24 * 60 * 60 * 1000;

        if (now - item.timestamp > maxAgeMs) return false;
      }

      return true;
    });
  }, [history, searchQuery, resultFilter, dateRangeFilter]);

  const hasActiveFilters = searchQuery.trim() !== '' || resultFilter !== 'ALL' || dateRangeFilter !== 'ALL';

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

  // Metric Calculations
  const totalAttacks = history.length;
  const wins = history.filter((h) => h.result === 'SUCCESS').length;
  const losses = history.filter((h) => h.result === 'FAILURE').length;
  const pending = history.filter((h) => !h.result || h.result === 'PENDING').length;
  const markedCount = wins + losses;
  const winRateNum = markedCount > 0 ? (wins / markedCount) * 100 : 0;
  const winRate = winRateNum.toFixed(1);

  // All-Time Combined Metrics (Active + Archived)
  const allTimeCombined = useMemo(() => {
    const combined = [...history, ...archivedHistory];
    const total = combined.length;
    const wins = combined.filter((h) => h.result === 'SUCCESS').length;
    const losses = combined.filter((h) => h.result === 'FAILURE').length;
    const pending = combined.filter((h) => !h.result || h.result === 'PENDING').length;
    const marked = wins + losses;
    const winRate = marked > 0 ? ((wins / marked) * 100).toFixed(1) : '0.0';
    const winRateNum = marked > 0 ? (wins / marked) * 100 : 0;
    return { total, wins, losses, pending, marked, winRate, winRateNum };
  }, [history, archivedHistory]);

  // Cutoff for 30 days
  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const eligibleToArchiveCount = history.filter((h) => h.timestamp < cutoff30d).length;

  // Trend Data Calculation for Recharts Bar Chart
  const trendData = useMemo(() => {
    if (history.length === 0) return [];

    const map = new Map<string, { dateKey: string; label: string; timestamp: number; wins: number; losses: number; pending: number }>();

    history.forEach((item) => {
      const d = new Date(item.timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}/${d.getDate()}`;

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateKey,
          label,
          timestamp: new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
          wins: 0,
          losses: 0,
          pending: 0,
        });
      }

      const entry = map.get(dateKey)!;
      if (item.result === 'SUCCESS') entry.wins += 1;
      else if (item.result === 'FAILURE') entry.losses += 1;
      else entry.pending += 1;
    });

    return Array.from(map.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-14);
  }, [history]);

  // Difficulty Breakdown
  const difficultyTypes = [
    { key: 'VERY_EASY', label: 'Very Easy', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { key: 'EASY', label: 'Easy', badge: 'bg-green-500/20 text-green-400 border-green-500/30' },
    { key: 'MEDIUM', label: 'Medium', badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { key: 'HARD', label: 'Hard', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
    { key: 'DANGER', label: 'Danger', badge: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  ];

  const difficultyStats = difficultyTypes.map((diff) => {
    const items = history.filter((h) => h.difficulty === diff.key);
    const dWins = items.filter((h) => h.result === 'SUCCESS').length;
    const dLosses = items.filter((h) => h.result === 'FAILURE').length;
    const dMarked = dWins + dLosses;
    const dRateNum = dMarked > 0 ? (dWins / dMarked) * 100 : 0;
    const dRateStr = dMarked > 0 ? `${dRateNum.toFixed(0)}%` : 'N/A';
    return {
      ...diff,
      total: items.length,
      wins: dWins,
      losses: dLosses,
      marked: dMarked,
      rateNum: dRateNum,
      rateStr: dRateStr,
    };
  });

  // Streak Calculation
  let currentStreak = 0;
  let streakType: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
  const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
  for (const item of sortedHistory) {
    if (item.result === 'SUCCESS') {
      if (streakType === 'NONE') streakType = 'WIN';
      if (streakType === 'WIN') currentStreak++;
      else break;
    } else if (item.result === 'FAILURE') {
      if (streakType === 'NONE') streakType = 'LOSS';
      if (streakType === 'LOSS') currentStreak++;
      else break;
    }
  }

  // Highest Level Defeated
  const defeatedTargets = history.filter((h) => h.result === 'SUCCESS');
  const maxDefeatedLevel = defeatedTargets.length > 0 ? Math.max(...defeatedTargets.map((t) => t.targetLevel)) : null;

  // Recent 8 attacks for form indicators
  const recentAttacks = sortedHistory.slice(0, 8);

  // Handle Archive Action
  const handleTriggerArchive = () => {
    const res = onArchiveOldLogs();
    setArchiveBannerMsg(res.message);
    setTimeout(() => {
      setArchiveBannerMsg(null);
    }, 6000);
  };

  // CSV Export Active History
  const handleExportCsv = (list: AttackHistoryItem[], filename: string) => {
    if (list.length === 0) return;
    const headers = ['Timestamp', 'Date', 'Target Name', 'Target ID', 'Level', 'Est Stats', 'Difficulty', 'FF Multiplier', 'Result Outcome'];
    const rows = list.map((h) => [
      h.timestamp,
      new Date(h.timestamp).toLocaleString(),
      `"${h.targetName}"`,
      h.targetId,
      h.targetLevel,
      h.estimatedTotalStats,
      h.difficultyLabel,
      h.estimatedFFMultiplier,
      h.result || 'PENDING',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (history.length === 0 && archivedHistory.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 my-6">
        <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">No Attack Activity Logged Yet</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Every time you click an 'ATTACK' button for any target, it will automatically record the timestamp and raid details here so you can mark Success or Defeat and track your win rate performance!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top All-Time Win/Loss Summary Quick Overview Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800/90 rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 tracking-wide uppercase">
                All-Time Win / Loss Summary
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GLOBAL OVERVIEW
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Total record of successful vs failed attacks across active logs and stored archives
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
            <span className="text-slate-500">Recorded Raids:</span>
            <span className="text-white font-bold">{allTimeCombined.total} total</span>
            <span className="text-slate-600">({history.length} active · {archivedHistory.length} archived)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* All-Time Win Rate % */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-emerald-500/30 flex flex-col justify-between shadow-lg">
            <div className="text-slate-400 text-xs uppercase font-bold flex items-center justify-between">
              <span>All-Time Win Rate</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2 tracking-tight">
              {allTimeCombined.winRate}%
            </div>
            {/* Visual ratio bar */}
            <div className="mt-3 space-y-1">
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full rounded-l-full transition-all"
                  style={{ width: `${allTimeCombined.winRateNum}%` }}
                />
                <div
                  className="bg-rose-500 h-full rounded-r-full transition-all"
                  style={{ width: `${100 - allTimeCombined.winRateNum}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>{allTimeCombined.wins} Wins</span>
                <span>{allTimeCombined.losses} Losses</span>
              </div>
            </div>
          </div>

          {/* All-Time Wins Count */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-emerald-500/20 flex flex-col justify-between shadow-lg">
            <div className="text-slate-400 text-xs uppercase font-bold flex items-center justify-between">
              <span>Successful Attacks</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">
              {allTimeCombined.wins} <span className="text-xs font-normal text-slate-400">Wins</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {allTimeCombined.marked > 0 ? ((allTimeCombined.wins / allTimeCombined.marked) * 100).toFixed(0) : 0}% of marked outcome raids
            </div>
          </div>

          {/* All-Time Losses Count */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-rose-500/20 flex flex-col justify-between shadow-lg">
            <div className="text-slate-400 text-xs uppercase font-bold flex items-center justify-between">
              <span>Failed Attacks</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold text-rose-400 mt-2">
              {allTimeCombined.losses} <span className="text-xs font-normal text-slate-400">Defeats</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              {allTimeCombined.marked > 0 ? ((allTimeCombined.losses / allTimeCombined.marked) * 100).toFixed(0) : 0}% of marked outcome raids
            </div>
          </div>

          {/* Unmarked / Pending & Ratio summary */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 flex flex-col justify-between shadow-lg">
            <div className="text-slate-400 text-xs uppercase font-bold flex items-center justify-between">
              <span>Outcome Tracking Status</span>
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              {allTimeCombined.marked} <span className="text-xs font-normal text-slate-400">/ {allTimeCombined.total}</span>
            </div>
            <div className="text-[11px] text-amber-400/90 font-bold mt-2">
              {allTimeCombined.pending > 0 ? `${allTimeCombined.pending} pending outcome result(s)` : 'All raids marked!'}
            </div>
          </div>
        </div>
      </div>
      {/* Toast Banner for Archive Actions */}
      {archiveBannerMsg && (
        <div className="bg-slate-900 border border-amber-500/40 p-4 rounded-xl text-amber-200 text-xs font-mono flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{archiveBannerMsg}</span>
          </div>
          <button onClick={() => setArchiveBannerMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Performance Overview Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Performance Overview
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  LIVE ANALYTICS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Calculates your raid win rate, difficulty success ratios, and battle trends
              </p>
            </div>
          </div>

          {/* Recent Form Pills */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
            <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold mr-1">Recent Form:</span>
            {recentAttacks.length > 0 ? (
              <div className="flex items-center gap-1">
                {recentAttacks.map((item, idx) => (
                  <span
                    key={item.id + idx}
                    className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-[10px] transition-transform hover:scale-110 ${
                      item.result === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : item.result === 'FAILURE'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                    title={`${item.targetName} (${item.result || 'PENDING'})`}
                  >
                    {item.result === 'SUCCESS' ? 'W' : item.result === 'FAILURE' ? 'L' : '?'}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-600 font-mono">No data</span>
            )}
          </div>
        </div>

        {/* Top Analytics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
          {/* Main Win Rate Highlight Card */}
          <div className="md:col-span-1 bg-slate-950/90 p-4 rounded-xl border border-amber-500/20 shadow-lg flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-all" />
            <div>
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Raid Win Rate</span>
                <Percent className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-4xl font-extrabold text-white tracking-tight">
                  {winRate}%
                </span>
                <span className="text-xs font-bold text-emerald-400">
                  {wins} W / {losses} L
                </span>
              </div>
            </div>

            {/* Win Rate Progress Meter */}
            <div className="mt-4 space-y-1.5">
              <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden border border-slate-700/50 p-0.5 flex">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${Math.min(100, Math.max(0, winRateNum))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{markedCount} outcome-tracked raids</span>
                <span>{pending > 0 ? `${pending} pending` : 'All marked'}</span>
              </div>
            </div>
          </div>

          {/* Total Raids Logged */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Active Logged Raids</span>
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-slate-100 mt-2">{totalAttacks}</div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Success resolution:</span>
              <span className="font-bold text-amber-400">
                {totalAttacks > 0 ? ((markedCount / totalAttacks) * 100).toFixed(0) : 0}%
              </span>
            </div>
          </div>

          {/* Current Streak Indicator */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Current Streak</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white">
                {currentStreak > 0 ? currentStreak : '0'}
              </span>
              <span
                className={`text-xs font-bold uppercase ${
                  streakType === 'WIN'
                    ? 'text-emerald-400'
                    : streakType === 'LOSS'
                    ? 'text-rose-400'
                    : 'text-slate-500'
                }`}
              >
                {streakType === 'WIN' ? 'Wins Streak 🔥' : streakType === 'LOSS' ? 'Loss Streak ⚠️' : 'No streak'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active sequential outcome
            </div>
          </div>

          {/* Highest Level Defeated */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
              <span>Top Level Defeated</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400 mt-2">
              {maxDefeatedLevel ? `Lvl ${maxDefeatedLevel}` : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {defeatedTargets.length} total victories recorded
            </div>
          </div>
        </div>

        {/* Success vs Failure Trend Bar Chart */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Raid Outcome Trend Over Time
              </h3>
              <p className="text-[11px] text-slate-400">
                Visual comparison of Success (Wins) vs Failure (Losses) across raid dates
              </p>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> Success (Wins)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> Failures (Losses)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-600 inline-block" /> Pending
              </span>
            </div>
          </div>

          <div className="h-56 w-full pt-2">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="wins" name="Success" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="losses" name="Failure" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="pending" name="Pending" fill="#475569" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                No raid trend data recorded yet. Log raids and mark outcomes to view trend chart.
              </div>
            )}
          </div>
        </div>

        {/* Win-Rate Breakdown by Difficulty Category */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Win Rate Breakdown by Difficulty Level
            </span>
            <span className="text-[11px] text-slate-500 font-normal">
              Based on FFScouter battle stat estimates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {difficultyStats.map((ds) => (
              <div
                key={ds.key}
                className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 flex flex-col justify-between space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${ds.badge}`}>
                    {ds.label}
                  </span>
                  <span className="text-xs font-extrabold text-white">{ds.rateStr}</span>
                </div>

                {/* Progress bar for difficulty */}
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      ds.rateNum >= 75
                        ? 'bg-emerald-400'
                        : ds.rateNum >= 40
                        ? 'bg-amber-400'
                        : ds.rateNum > 0
                        ? 'bg-rose-400'
                        : 'bg-slate-700'
                    }`}
                    style={{ width: `${ds.rateNum}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{ds.wins}W - {ds.losses}L</span>
                  <span>({ds.total} raids)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main History Table with Cleanup & Archive Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-red-500" />
            <h3 className="text-base font-bold text-white">Raiding Activity Log</h3>
            <span className="text-xs text-slate-400 font-mono">({history.length} active entries)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Archive Old Logs (>30d) Utility Button */}
            <button
              onClick={handleTriggerArchive}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-mono flex items-center gap-1.5 transition-all shadow-sm"
              title="Move entries older than 30 days to local storage key sargus_archived_attack_history to maintain active table performance"
            >
              <Archive className="w-3.5 h-3.5 text-amber-400" />
              <span>Archive Logs (&gt;30d)</span>
              {eligibleToArchiveCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                  {eligibleToArchiveCount}
                </span>
              )}
            </button>

            {/* View Archived Vault Button */}
            <button
              onClick={() => setShowArchiveModal(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5 transition-colors"
            >
              <FolderArchive className="w-3.5 h-3.5 text-blue-400" />
              <span>Archived Vault</span>
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                {archivedHistory.length}
              </span>
            </button>

            {/* Export CSV */}
            <button
              onClick={() => handleExportCsv(history, 'sargus_active_attack_history')}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            {/* Clear Log */}
            <button
              onClick={onClearHistory}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-xs text-rose-300 font-mono flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-mono">
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search target name, ID, or faction..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Result Filter Select */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-500 uppercase font-bold shrink-0">Outcome:</span>
              <select
                value={resultFilter}
                onChange={(e: any) => setResultFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Results</option>
                <option value="SUCCESS" className="bg-slate-900 text-emerald-400">Wins Only (Success)</option>
                <option value="FAILURE" className="bg-slate-900 text-rose-400">Losses Only (Failures)</option>
                <option value="PENDING" className="bg-slate-900 text-slate-400">Pending / Unmarked</option>
              </select>
            </div>

            {/* Date Range Select */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] text-slate-500 uppercase font-bold shrink-0">Timeframe:</span>
              <select
                value={dateRangeFilter}
                onChange={(e: any) => setDateRangeFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-slate-200">All Time</option>
                <option value="24H" className="bg-slate-900 text-slate-200">Last 24 Hours</option>
                <option value="7D" className="bg-slate-900 text-slate-200">Last 7 Days</option>
                <option value="30D" className="bg-slate-900 text-slate-200">Last 30 Days</option>
                <option value="90D" className="bg-slate-900 text-slate-200">Last 90 Days</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
            <span className="text-[11px] text-slate-400">
              Showing <strong className="text-white">{filteredHistory.length}</strong> of {history.length} active logs
            </span>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setResultFilter('ALL');
                  setDateRangeFilter('ALL');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-bold flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
        {history.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-mono text-xs">
            All active attack logs have been archived or cleared. Click <strong>Archived Vault</strong> to view stored historical records.
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-mono text-xs space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-slate-200 font-bold">No Attack Logs Match Your Filters</div>
            <p className="text-slate-500 max-w-sm mx-auto text-[11px]">
              Try clearing search terms or selecting 'All Results' / 'All Time' timeframe.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setResultFilter('ALL');
                setDateRangeFilter('ALL');
              }}
              className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-400 font-bold inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Attacked Target</th>
                  <th className="py-3.5 px-3 font-semibold">Timestamp</th>
                  <th className="py-3.5 px-3 font-semibold">Est. Battle Stats</th>
                  <th className="py-3.5 px-3 font-semibold">Difficulty</th>
                  <th className="py-3.5 px-3 font-semibold">Attack Result</th>
                  <th className="py-3.5 px-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredHistory.map((item) => {
                  const diffStyle = getDifficultyBadgeStyle(item.difficulty);
                  const currentResult = item.result || 'PENDING';

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

                      {/* Success / Failure Result Outcome Toggle */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800 inline-flex">
                          <button
                            onClick={() => onUpdateResult(item.id, 'SUCCESS')}
                            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                              currentResult === 'SUCCESS'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60'
                                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900'
                            }`}
                            title="Mark Win / Success"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>WIN</span>
                          </button>

                          <button
                            onClick={() => onUpdateResult(item.id, 'FAILURE')}
                            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                              currentResult === 'FAILURE'
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60'
                                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-900'
                            }`}
                            title="Mark Defeat / Failure"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>LOSE</span>
                          </button>

                          <button
                            onClick={() => onUpdateResult(item.id, 'PENDING')}
                            className={`px-1.5 py-1 rounded text-[11px] transition-all ${
                              currentResult === 'PENDING'
                                ? 'bg-slate-800 text-slate-300 font-medium'
                                : 'text-slate-600 hover:text-slate-400'
                            }`}
                            title="Clear Result Status"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
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
        )}
      </div>

      {/* Archived Logs Vault Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-mono">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Archived Attack Vault
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-blue-300 border border-slate-700">
                      sargus_archived_attack_history
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Stored attack logs older than 30 days kept separate for UI performance
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowArchiveModal(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="text-xs text-slate-300">
                  Total Stored Archives: <strong className="text-white text-sm">{archivedHistory.length}</strong> entries
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleExportCsv(archivedHistory, 'sargus_archived_attack_history')}
                    disabled={archivedHistory.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" /> Export Archived CSV
                  </button>

                  <button
                    onClick={() => {
                      onRestoreArchived();
                      setArchiveBannerMsg('Restored all archived entries back into active attack history log!');
                    }}
                    disabled={archivedHistory.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/80 text-xs text-emerald-300 font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" /> Restore All to Active Log
                  </button>

                  <button
                    onClick={onClearArchived}
                    disabled={archivedHistory.length === 0}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900/80 border border-rose-800/80 text-xs text-rose-300 font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Purge Archive
                  </button>
                </div>
              </div>

              {archivedHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                  No archived logs present in local storage. Logs older than 30 days can be moved here using the 'Archive Logs (&gt;30d)' button.
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Target Name</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Level / Est. Stats</th>
                        <th className="py-3 px-3">Difficulty</th>
                        <th className="py-3 px-3">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {archivedHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-bold text-slate-200">
                            {item.targetName} <span className="text-slate-500 font-normal">({item.targetId})</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            Lvl {item.targetLevel} · ~{formatStatNumber(item.estimatedTotalStats)} BS
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[11px] font-bold text-slate-400">
                              {item.difficultyLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.result === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : item.result === 'FAILURE'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.result || 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


