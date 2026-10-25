import React from 'react';
import { ExternalLink, Swords, Bookmark, Copy, Check, ShieldAlert, Award, Clock } from 'lucide-react';
import { InactiveTarget } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle } from '../utils/ffscouter';

interface TargetGridProps {
  targets: InactiveTarget[];
  onSelectTarget: (target: InactiveTarget) => void;
  onToggleBookmark: (targetId: number) => void;
  onMarkAttacked: (targetId: number) => void;
}

export const TargetGrid: React.FC<TargetGridProps> = ({
  targets,
  onSelectTarget,
  onToggleBookmark,
  onMarkAttacked,
}) => {
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  const handleCopyLink = (target: InactiveTarget, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(target.attackUrl);
    setCopiedId(target.player_id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {targets.map((target) => {
        const diffStyle = getDifficultyBadgeStyle(target.ffScouter.difficulty);
        const ps = target.personalstats || {};

        return (
          <div
            key={target.player_id}
            onClick={() => onSelectTarget(target)}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-amber-400 text-base shrink-0">
                    {target.level}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base group-hover:text-red-400 transition-colors flex items-center gap-1.5">
                      <span>{target.name}</span>
                      <a
                        href={target.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      ID: {target.player_id} · Age: {target.age} days
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleBookmark(target.player_id);
                  }}
                  className={`text-slate-600 hover:text-amber-400 transition-colors p-1 ${
                    target.isBookmarked ? 'text-amber-400' : ''
                  }`}
                >
                  <Bookmark className="w-5 h-5 fill-current" />
                </button>
              </div>

              {/* Status & Offline Badge */}
              <div className="flex items-center justify-between gap-2 my-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Inactive:</span>
                  <span className="font-bold text-amber-400">{target.daysOffline} days</span>
                </div>

                <div className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border ${diffStyle.badgeBg}`}>
                  {target.ffScouter.difficultyLabel}
                </div>
              </div>

              {/* Stat breakdown box */}
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 font-mono text-xs space-y-1.5 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">EST. BATTLE STATS:</span>
                  <span className="text-emerald-400 font-extrabold text-sm">
                    ~{formatStatNumber(target.ffScouter.estimatedTotalStats)} BS
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Confidence:</span>
                  <span className="text-slate-300 font-semibold">{target.ffScouter.confidence}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Xanax Taken:</span>
                  <span className="text-slate-300 font-mono">{ps.xantaken || 0}</span>
                </div>
                {target.faction && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Faction:</span>
                    <span className="text-red-400 font-semibold truncate max-w-[130px]">{target.faction.faction_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Attack Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <button
                onClick={(e) => handleCopyLink(target, e)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800 flex items-center gap-1 transition-colors"
                title="Copy attack link"
              >
                {copiedId === target.player_id ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href={target.attackUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkAttacked(target.player_id);
                }}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs text-center shadow-md shadow-red-950/60 border border-red-500/40 flex items-center justify-center gap-2 transition-all transform active:scale-95"
              >
                <Swords className="w-4 h-4" />
                <span>ATTACK TARGET</span>
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};
