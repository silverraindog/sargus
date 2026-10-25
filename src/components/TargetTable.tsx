import React from 'react';
import { ExternalLink, Swords, Bookmark, Copy, Check, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { InactiveTarget } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle } from '../utils/ffscouter';

interface TargetTableProps {
  targets: InactiveTarget[];
  onSelectTarget: (target: InactiveTarget) => void;
  onToggleBookmark: (targetId: number) => void;
  onMarkAttacked: (targetId: number) => void;
}

export const TargetTable: React.FC<TargetTableProps> = ({
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

  if (targets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 my-6">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3 opacity-80" />
        <h3 className="text-lg font-bold text-white mb-1">No Inactive Targets Match Your Filters</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
          Try adjusting the offline duration threshold, broadening level ranges, or running a custom faction scan.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3.5 px-4 font-semibold">Target Player</th>
              <th className="py-3.5 px-3 font-semibold">Status &amp; Faction</th>
              <th className="py-3.5 px-3 font-semibold">Offline Time</th>
              <th className="py-3.5 px-3 font-semibold">Est. Battle Stats</th>
              <th className="py-3.5 px-3 font-semibold">FFScouter Difficulty</th>
              <th className="py-3.5 px-4 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {targets.map((target) => {
              const diffStyle = getDifficultyBadgeStyle(target.ffScouter.difficulty);
              const isHospital = target.status.state === 'Hospital';
              const isJail = target.status.state === 'Jail';
              const isTraveling = target.status.state === 'Traveling';

              return (
                <tr
                  key={target.player_id}
                  onClick={() => onSelectTarget(target)}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  {/* Target Player Column */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleBookmark(target.player_id);
                        }}
                        className={`text-slate-600 hover:text-amber-400 transition-colors ${
                          target.isBookmarked ? 'text-amber-400' : ''
                        }`}
                        title="Bookmark target"
                      >
                        <Bookmark className="w-4 h-4 fill-current" />
                      </button>

                      <div className="w-7 h-7 rounded bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-amber-400 shrink-0">
                        {target.level}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5 font-sans font-bold text-slate-100 text-sm group-hover:text-red-400 transition-colors">
                          <span>{target.name}</span>
                          <a
                            href={target.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                            title="Open Torn Profile"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ID: <span className="text-slate-400">{target.player_id}</span> · Age:{' '}
                          <span className="text-slate-400">{target.age}d</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Status & Faction */}
                  <td className="py-3 px-3">
                    <div>
                      {isHospital && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-400 border border-rose-800/80 inline-block mb-1">
                          HOSPITAL
                        </span>
                      )}
                      {isJail && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-800/80 inline-block mb-1">
                          JAIL
                        </span>
                      )}
                      {isTraveling && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-950/80 text-blue-400 border border-blue-800/80 inline-block mb-1">
                          TRAVELING
                        </span>
                      )}
                      {!isHospital && !isJail && !isTraveling && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 inline-block mb-1">
                          OKAY
                        </span>
                      )}

                      <div className="text-slate-400 text-[11px] truncate max-w-[140px]">
                        {target.faction ? target.faction.faction_name : 'No Faction'}
                      </div>
                    </div>
                  </td>

                  {/* Offline Time */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-amber-400 text-xs">
                      {target.daysOffline} days
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {target.last_action.relative || `${target.daysOffline}d ago`}
                    </div>
                  </td>

                  {/* Estimated Battle Stats */}
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-200">
                      ~{formatStatNumber(target.ffScouter.estimatedTotalStats)} <span className="text-slate-500 font-normal">BS</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Range: {formatStatNumber(target.ffScouter.minEstStats)} - {formatStatNumber(target.ffScouter.maxEstStats)}
                    </div>
                  </td>

                  {/* Difficulty Badge */}
                  <td className="py-3 px-3">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${diffStyle.badgeBg}`}>
                      <span>{target.ffScouter.difficultyLabel}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {target.ffScouter.estimatedFFMultiplier > 0
                        ? `Est. Respect: ${target.ffScouter.estimatedFFMultiplier}x`
                        : 'Unavailable'}
                    </div>
                  </td>

                  {/* Direct Attack Button (Key requirement: "an attack button that redirects to the user the person is attacking") */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => handleCopyLink(target, e)}
                        className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                        title="Copy direct attack link"
                      >
                        {copiedId === target.player_id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
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
                        className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs shadow-md shadow-red-950/60 border border-red-500/40 flex items-center gap-1.5 transition-all transform active:scale-95 whitespace-nowrap"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>ATTACK</span>
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
  );
};
