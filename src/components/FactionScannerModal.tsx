import React, { useState } from 'react';
import { Shield, Search, Loader2, AlertCircle, X, Check, Users } from 'lucide-react';
import { BattleStats, InactiveTarget } from '../types/torn';
import { scanFactionMembers } from '../services/tornApi';
import { PRESET_INACTIVE_FACTIONS } from '../data/inactivePresets';

interface FactionScannerModalProps {
  apiKey: string;
  playerStats: BattleStats | null;
  onAddTargets: (targets: InactiveTarget[]) => void;
  onClose?: () => void;
}

export const FactionScannerModal: React.FC<FactionScannerModalProps> = ({
  apiKey,
  playerStats,
  onAddTargets,
  onClose,
}) => {
  const [factionIdInput, setFactionIdInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleScanFaction = async (idToScan?: number) => {
    const fid = idToScan || parseInt(factionIdInput, 10);
    if (!fid || isNaN(fid)) {
      setErrorMsg('Please enter a valid numeric Faction ID');
      return;
    }

    if (!playerStats) {
      setErrorMsg('Player stats are required for FFScouter difficulty estimates');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const targets = await scanFactionMembers(fid, apiKey, playerStats);
      onAddTargets(targets);
      setSuccessMsg(`Successfully scanned Faction #${fid} and found ${targets.length} targets!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan faction. Verify Faction ID and API key permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl mb-6 text-slate-100">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Faction &amp; Target Scanner</h3>
            <p className="text-xs text-slate-400">Scan any Torn Faction ID for inactive members (&gt;30 days offline)</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Custom Faction ID Input Form */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            value={factionIdInput}
            onChange={(e) => setFactionIdInput(e.target.value)}
            placeholder="Enter Torn Faction ID (e.g. 9812 or 1042)..."
            className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => handleScanFaction()}
            disabled={loading}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 font-mono shadow-md shadow-red-950/50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>SCAN FACTION LIVE</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Preset Inactive Factions Quick Scan */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-xs font-mono text-slate-400 block mb-2">QUICK SCAN PRESET INACTIVE FACTIONS:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {PRESET_INACTIVE_FACTIONS.map((fac) => (
              <button
                key={fac.id}
                onClick={() => handleScanFaction(fac.id)}
                disabled={loading}
                className="p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg text-left transition-colors font-mono group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-red-400 transition-colors">
                  {fac.name}
                </div>
                <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                  <span>ID: #{fac.id}</span>
                  <span>~{fac.avgOfflineDays}d offline</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
