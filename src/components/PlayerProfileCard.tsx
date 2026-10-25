import React from 'react';
import { Shield, Zap, Flame, Award, Heart, Activity } from 'lucide-react';
import { PlayerProfile, BattleStats } from '../types/torn';
import { formatStatNumber } from '../utils/ffscouter';

interface PlayerProfileCardProps {
  profile: PlayerProfile | null;
  battleStats: BattleStats | null;
}

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ profile, battleStats }) => {
  if (!profile || !battleStats) return null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl text-slate-100 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-amber-700 flex items-center justify-center font-bold text-lg text-white border border-red-500/30 shadow-lg">
            {profile.level}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">{profile.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
                ID: {profile.player_id}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                {profile.rank}
              </span>
              <span className="text-slate-600">·</span>
              <span>Age: {profile.age} days</span>
              {profile.faction && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-red-400 font-medium">{profile.faction.faction_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Total Battle Stats Banner */}
        <div className="flex items-center gap-4 bg-slate-950/80 px-4 py-2.5 rounded-lg border border-slate-800/80 font-mono">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest block">YOUR TOTAL BATTLE STATS</span>
            <span className="text-xl font-extrabold text-emerald-400 tracking-tight">
              {formatStatNumber(battleStats.total)}
            </span>
            <span className="text-xs text-slate-500 ml-1">BS</span>
          </div>
          <div className="h-8 w-[1px] bg-slate-800" />
          <div className="text-xs space-y-0.5">
            <div className="text-slate-400">
              STR/DEF: <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.strength)}</span> /{' '}
              <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.defense)}</span>
            </div>
            <div className="text-slate-400">
              SPD/DEX: <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.speed)}</span> /{' '}
              <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.dexterity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs font-mono">
        <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-rose-500" /> Strength:
          </span>
          <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.strength)}</span>
        </div>
        <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> Defense:
          </span>
          <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.defense)}</span>
        </div>
        <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Speed:
          </span>
          <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.speed)}</span>
        </div>
        <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60 flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Dexterity:
          </span>
          <span className="text-slate-200 font-bold">{formatStatNumber(battleStats.dexterity)}</span>
        </div>
      </div>
    </div>
  );
};
