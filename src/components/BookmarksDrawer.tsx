import React from 'react';
import { Bookmark, Swords, Trash2, ExternalLink, ArrowRight } from 'lucide-react';
import { InactiveTarget } from '../types/torn';
import { formatStatNumber, getDifficultyBadgeStyle } from '../utils/ffscouter';

interface BookmarksDrawerProps {
  bookmarkedTargets: InactiveTarget[];
  onSelectTarget: (target: InactiveTarget) => void;
  onToggleBookmark: (targetId: number) => void;
  onClearAll: () => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  bookmarkedTargets,
  onSelectTarget,
  onToggleBookmark,
  onClearAll,
}) => {
  if (bookmarkedTargets.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 my-6">
        <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-1">No Saved Targets Yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Click the bookmark icon on any inactive target to save them to your custom attack queue.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6 text-slate-100 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-amber-400 fill-current" />
          <h3 className="text-base font-bold text-white">Saved Hit Queue</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
            {bookmarkedTargets.length} Targets
          </span>
        </div>

        <button
          onClick={onClearAll}
          className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear All Saved
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {bookmarkedTargets.map((target) => {
          const diffStyle = getDifficultyBadgeStyle(target.ffScouter.difficulty);

          return (
            <div
              key={target.player_id}
              onClick={() => onSelectTarget(target)}
              className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-slate-900 border border-slate-800 font-bold text-amber-400 text-xs flex items-center justify-center shrink-0">
                      {target.level}
                    </span>
                    <span className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">
                      {target.name}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmark(target.player_id);
                    }}
                    className="text-slate-500 hover:text-rose-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>Inactive: <strong className="text-amber-400">{target.daysOffline}d</strong></span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${diffStyle.badgeBg}`}>
                    {target.ffScouter.difficultyLabel}
                  </span>
                </div>

                {target.notes && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-900/80 p-2 rounded border border-slate-800/80 mb-2 line-clamp-2">
                    "{target.notes}"
                  </p>
                )}
              </div>

              <a
                href={target.attackUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-red-950/50 mt-2"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>ATTACK NOW</span>
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};
