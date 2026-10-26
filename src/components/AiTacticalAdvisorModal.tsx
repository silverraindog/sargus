import React, { useState } from 'react';
import { Sparkles, Loader2, Crosshair, AlertTriangle, RefreshCw } from 'lucide-react';
import { BattleStats, InactiveTarget, PlayerProfile } from '../types/torn';
import { safeFetchJson } from '../utils/apiClient';

interface AiTacticalAdvisorModalProps {
  playerProfile: PlayerProfile | null;
  playerStats: BattleStats | null;
  targets: InactiveTarget[];
}

export const AiTacticalAdvisorModal: React.FC<AiTacticalAdvisorModalProps> = ({
  playerProfile,
  playerStats,
  targets,
}) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTacticalAdvice = async () => {
    if (!playerProfile || !playerStats) {
      setErrorMsg('Player profile and stats are required');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const topTargets = targets
        .filter((t) => t.status.state === 'Okay')
        .slice(0, 8)
        .map((t) => ({
          name: t.name,
          level: t.level,
          estStats: t.ffScouter.estimatedTotalStats,
          difficulty: t.ffScouter.difficultyLabel,
          daysOffline: t.daysOffline,
          respectMult: t.ffScouter.estimatedFFMultiplier,
        }));

      const result = await safeFetchJson<any>('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: {
            name: playerProfile.name,
            level: playerProfile.level,
            totalStats: playerStats.total,
          },
          targets: topTargets,
        }),
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to generate tactical advice');
      }

      const data = result.data;
      if (data.error) {
        throw new Error(data.error);
      }

      setAdvice(data.advice);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate tactical advice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl mb-6 text-slate-100">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Gemini AI Tactical Hit Advisor</h3>
            <p className="text-xs text-slate-400">AI chain analysis for maximum respect gain and minimal energy loss</p>
          </div>
        </div>

        <button
          onClick={fetchTacticalAdvice}
          disabled={loading}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold text-xs rounded-lg flex items-center gap-2 transition-all shadow-md shadow-amber-950/50 shrink-0 font-mono"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span>GENERATE TACTICAL ANALYSIS</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {advice ? (
        <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-200 font-mono leading-relaxed space-y-2 whitespace-pre-line">
          {advice}
        </div>
      ) : (
        <div className="bg-slate-950/50 p-6 rounded-xl border border-slate-800 text-center text-slate-400 text-xs font-mono">
          Click "GENERATE TACTICAL ANALYSIS" to evaluate your top inactive targets against your battle stats.
        </div>
      )}
    </div>
  );
};
