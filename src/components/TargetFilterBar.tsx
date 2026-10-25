import React from 'react';
import { Search, Filter, ArrowUpDown, LayoutGrid, List, Clock, SlidersHorizontal, RefreshCw, Cpu } from 'lucide-react';
import { DifficultyLevel, FilterOptions } from '../types/torn';

interface TargetFilterBarProps {
  filters: FilterOptions;
  onFilterChange: (updated: Partial<FilterOptions>) => void;
  onResetFilters: () => void;
  viewMode: 'table' | 'cards';
  setViewMode: (mode: 'table' | 'cards') => void;
  totalCount: number;
  filteredCount: number;
  onScanMoreLive?: () => void;
  isScanningLive?: boolean;
}

export const TargetFilterBar: React.FC<TargetFilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  viewMode,
  setViewMode,
  totalCount,
  filteredCount,
  onScanMoreLive,
  isScanningLive,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg space-y-4 text-slate-100">
      {/* Search & Main Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search target by player name, User ID, or faction..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {/* View Toggle & Count Indicator */}
        <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
          {onScanMoreLive && (
            <button
              onClick={onScanMoreLive}
              disabled={isScanningLive}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-50 text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950/50 transition-all shrink-0"
              title="Query next batch of User IDs live from Torn API"
            >
              <Cpu className={`w-3.5 h-3.5 ${isScanningLive ? 'animate-spin' : ''}`} />
              <span>{isScanningLive ? 'Querying API...' : 'Fetch Live API Targets'}</span>
            </button>
          )}

          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="text-white font-bold">{filteredCount}</span> of{' '}
            <span className="text-slate-500">{totalCount}</span> targets
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Offline Duration Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1 shrink-0 mr-1">
          <Clock className="w-3.5 h-3.5 text-red-400" /> INACTIVE DURATION:
        </span>

        {[
          { days: 30, label: '≥ 1 Month (30d+)' },
          { days: 60, label: '≥ 2 Months (60d+)' },
          { days: 90, label: '≥ 3 Months (90d+)' },
          { days: 180, label: '≥ 6 Months (180d+)' },
          { days: 365, label: '≥ 1 Year (365d+)' },
        ].map((item) => (
          <button
            key={item.days}
            onClick={() => onFilterChange({ minDaysOffline: item.days })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              filters.minDaysOffline === item.days
                ? 'bg-red-600 text-white font-semibold shadow-md shadow-red-950/50'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Advanced Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
        {/* Difficulty Filter */}
        <div>
          <label className="block text-slate-400 font-mono mb-1">FFScouter Difficulty</label>
          <select
            value={filters.difficultyFilter}
            onChange={(e) => onFilterChange({ difficultyFilter: e.target.value as any })}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-red-500 font-mono"
          >
            <option value="ALL">All Difficulties</option>
            <option value="VERY_EASY">🟢 Very Easy (Free Hit)</option>
            <option value="EASY">🧪 Easy (High Respect)</option>
            <option value="MEDIUM">🟡 Medium (Fair Fight)</option>
            <option value="HARD">🟧 Hard (High Risk)</option>
            <option value="DANGER">🔴 Danger (Outmatched)</option>
          </select>
        </div>

        {/* Level Range Filter */}
        <div>
          <label className="block text-slate-400 font-mono mb-1">Target Level Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={filters.minLevel}
              onChange={(e) => onFilterChange({ minLevel: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center font-mono text-slate-200 focus:outline-none focus:border-red-500"
              placeholder="Min"
            />
            <span className="text-slate-600">-</span>
            <input
              type="number"
              min={1}
              max={100}
              value={filters.maxLevel}
              onChange={(e) => onFilterChange({ maxLevel: Math.min(100, parseInt(e.target.value, 10) || 100) })}
              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-center font-mono text-slate-200 focus:outline-none focus:border-red-500"
              placeholder="Max"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-slate-400 font-mono mb-1">Target Status</label>
          <select
            value={filters.statusFilter}
            onChange={(e) => onFilterChange({ statusFilter: e.target.value as any })}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-red-500 font-mono"
          >
            <option value="ALL">All Statuses</option>
            <option value="OKAY_ONLY">Okay / Ready to Hit Only</option>
            <option value="INCLUDE_HOSPITAL">Include Hospitalized</option>
          </select>
        </div>

        {/* Sort By Selector */}
        <div>
          <label className="block text-slate-400 font-mono mb-1 flex items-center justify-between">
            <span>Sort By</span>
            <button
              onClick={() => onFilterChange({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
              className="text-red-400 hover:underline text-[10px] uppercase font-bold"
            >
              {filters.sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
            </button>
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-red-500 font-mono"
          >
            <option value="DAYS_OFFLINE">Days Offline (Longest First)</option>
            <option value="DIFFICULTY">FFScouter Difficulty (Easiest First)</option>
            <option value="EST_STATS">Estimated Stats (Lowest First)</option>
            <option value="LEVEL">Level</option>
            <option value="FAIR_FIGHT">Estimated Respect / FF Multiplier</option>
          </select>
        </div>
      </div>
    </div>
  );
};
