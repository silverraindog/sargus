import React from 'react';
import { Shield, Key, Crosshair, Sparkles, Bookmark, Search } from 'lucide-react';
import { PlayerProfile, BattleStats } from '../types/torn';
import { formatStatNumber } from '../utils/ffscouter';

interface HeaderProps {
  apiKey: string;
  onOpenKeyModal: () => void;
  playerProfile: PlayerProfile | null;
  playerStats: BattleStats | null;
  activeTab: 'targets' | 'scanner' | 'advisor' | 'bookmarks';
  setActiveTab: (tab: 'targets' | 'scanner' | 'advisor' | 'bookmarks') => void;
  bookmarkCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  apiKey,
  onOpenKeyModal,
  playerProfile,
  playerStats,
  activeTab,
  setActiveTab,
  bookmarkCount,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/50 border border-red-500/30">
            <Crosshair className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <a href="#" className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-red-400 transition-colors">
              TORN <span className="text-red-500">SCOUTER</span>
            </a>
            <p className="text-[10px] text-slate-400 -mt-1 font-mono tracking-wider">INACTIVE TARGET FINDER</p>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab('targets')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'targets'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Target Scout</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scanner'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Faction Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('advisor')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'advisor'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Advisor</span>
          </button>

          <button
            onClick={() => setActiveTab('bookmarks')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 whitespace-nowrap relative ${
              activeTab === 'bookmarks'
                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved Hits</span>
            {bookmarkCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] font-mono bg-red-600 text-white rounded-full">
                {bookmarkCount}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Single Primary Action / API Key Status */}
        <div className="flex items-center gap-3 shrink-0">
          {playerProfile && playerStats && (
            <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
              <div>
                <span className="text-slate-500">PLAYER:</span>{' '}
                <span className="text-white font-semibold">{playerProfile.name}</span>{' '}
                <span className="text-amber-400 font-bold">Lvl {playerProfile.level}</span>
              </div>
              <div className="h-3 w-[1px] bg-slate-800" />
              <div>
                <span className="text-slate-500">BS:</span>{' '}
                <span className="text-emerald-400 font-bold">{formatStatNumber(playerStats.total)}</span>
              </div>
            </div>
          )}

          <button
            onClick={onOpenKeyModal}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-red-500/50 text-xs font-mono text-slate-200 hover:text-white transition-colors flex items-center gap-2 shrink-0"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">API KEY:</span>
            <span className="text-emerald-400 font-bold">
              {apiKey ? `${apiKey.substring(0, 4)}...${apiKey.slice(-3)}` : 'SET KEY'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
