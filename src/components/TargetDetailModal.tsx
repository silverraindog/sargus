import React, { useState } from 'react';
import { X, Swords, ExternalLink, Bookmark, Clock, Shield, Award, Calculator, Check, Copy, MapPin, Globe } from 'lucide-react';
import { InactiveTarget } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle, getCountryFlag } from '../utils/ffscouter';

interface TargetDetailModalProps {
  target: InactiveTarget | null;
  onClose: () => void;
  onToggleBookmark: (targetId: number) => void;
  onSaveNotes: (targetId: number, notes: string) => void;
}

export const TargetDetailModal: React.FC<TargetDetailModalProps> = ({
  target,
  onClose,
  onToggleBookmark,
  onSaveNotes,
}) => {
  if (!target) return null;

  const [notes, setNotes] = useState(target.notes || '');
  const [copied, setCopied] = useState(false);

  const diffStyle = getDifficultyBadgeStyle(target.ffScouter.difficulty);
  const ps = target.personalstats || {};
  const bd = target.ffScouter.breakdown;

  const country = target.country || 'Torn';
  const flag = getCountryFlag(country);
  const isAbroad = target.status.state === 'Abroad' || country.toLowerCase() !== 'torn';
  const isTraveling = target.status.state === 'Traveling';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(target.attackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    onSaveNotes(target.player_id, val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-100 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-extrabold text-amber-400 text-lg shrink-0">
              {target.level}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{target.name}</h2>
                <a
                  href={target.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-xs text-slate-400 font-mono">
                  ID: {target.player_id} · Age: {target.age} days · Rank: {target.rank}
                </p>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold inline-flex items-center gap-1 border ${
                    isAbroad
                      ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                  title={isAbroad ? `Abroad in ${country}` : 'In Torn City'}
                >
                  <span>{flag}</span>
                  <span>{country} {isAbroad ? '(Abroad)' : '(In City)'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onToggleBookmark(target.player_id)}
            className={`p-2 rounded-lg bg-slate-950 border border-slate-800 transition-colors ${
              target.isBookmarked ? 'text-amber-400 border-amber-500/30' : 'text-slate-400'
            }`}
          >
            <Bookmark className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Location & Tactical Status Banner */}
        <div className={`my-4 p-3.5 rounded-xl border flex items-center justify-between gap-4 font-mono text-xs ${
          isAbroad
            ? 'bg-sky-950/40 border-sky-800/80 text-sky-200'
            : isTraveling
            ? 'bg-blue-950/40 border-blue-800/80 text-blue-200'
            : 'bg-slate-950/70 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center text-lg shrink-0">
              {flag}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">
                  Location: {country}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-extrabold bg-slate-900 border border-slate-700">
                  {target.status.state}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Status: &ldquo;{target.status.description || 'Okay'}&rdquo; {target.status.details ? `(${target.status.details})` : ''}
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] shrink-0 hidden sm:block">
            {isAbroad ? (
              <span className="text-amber-400 font-bold">⚠️ Player is abroad (fly to {country})</span>
            ) : isTraveling ? (
              <span className="text-blue-400 font-bold">✈️ In flight</span>
            ) : (
              <span className="text-emerald-400 font-bold">🎯 Attackable from Torn City</span>
            )}
          </div>
        </div>

        {/* FFScouter Summary Banner */}
        <div className="mb-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">FFSCOUTER EST. STATS</span>
            <span className="text-xl font-extrabold text-emerald-400 font-mono">
              ~{formatStatNumber(target.ffScouter.estimatedTotalStats)}
            </span>
            <span className="text-xs text-slate-500 block font-mono">
              Range: {formatStatNumber(target.ffScouter.minEstStats)} - {formatStatNumber(target.ffScouter.maxEstStats)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">DIFFICULTY CLASS</span>
            <div className={`inline-block px-2.5 py-1 rounded text-xs font-bold border mt-0.5 ${diffStyle.badgeBg}`}>
              {target.ffScouter.difficultyLabel}
            </div>
            <span className="text-xs text-slate-400 block font-mono mt-1">
              Stat Ratio: {(target.ffScouter.statRatio * 100).toFixed(0)}%
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">INACTIVE TIME</span>
            <span className="text-xl font-bold text-amber-400 font-mono">
              {target.daysOffline} Days
            </span>
            <span className="text-xs text-slate-400 block font-mono">
              {target.last_action.relative}
            </span>
          </div>
        </div>

        {/* FFScouter Calculation Breakdown */}
        <div className="mb-5">
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calculator className="w-4 h-4 text-red-400" /> FFScouter Battle Stat Breakdown Formula
          </h3>
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Base Level Component (Lvl {target.level}):</span>
              <span className="text-slate-200 font-bold">+{formatStatNumber(bd.baseLevelStats)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Xanax Boost ({ps.xantaken || 0} xanax taken):</span>
              <span className="text-slate-200 font-bold">+{formatStatNumber(bd.xanaxBoost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Energy Refills ({ps.refills || 0} refills):</span>
              <span className="text-slate-200 font-bold">+{formatStatNumber(bd.refillBoost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Working Stats Contribution:</span>
              <span className="text-slate-200 font-bold">+{formatStatNumber(bd.workingStatsBoost)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
              <span className="text-slate-300 font-bold">Total Estimated Stats:</span>
              <span className="text-emerald-400 font-extrabold">{formatStatNumber(target.ffScouter.estimatedTotalStats)} BS</span>
            </div>
          </div>
        </div>

        {/* Personal Attack Notes */}
        <div className="mb-6">
          <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1">
            Personal Hit Notes
          </label>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="Add hit notes (e.g., 'Easy hit with Pepper Spray', 'Yielded 2.8 Fair Fight respect', 'Defeated in 3 turns')..."
            className="w-full h-20 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500 font-mono resize-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={handleCopyLink}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-mono border border-slate-800 flex items-center justify-center gap-2 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Attack Link Copied!' : 'Copy Direct Attack URL'}</span>
          </button>

          <a
            href={target.attackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-red-950/60 border border-red-500/40 flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <Swords className="w-4 h-4" />
            <span>ATTACK TARGET NOW</span>
          </a>
        </div>
      </div>
    </div>
  );
};
