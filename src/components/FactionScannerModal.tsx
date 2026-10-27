import React, { useState } from 'react';
import { Shield, Search, Loader2, AlertCircle, X, Check, Users, Cpu, Layers } from 'lucide-react';
import { BattleStats, InactiveTarget, PlayerProfile } from '../types/torn';
import { scanFactionMembers } from '../services/tornApi';
import { PRESET_INACTIVE_FACTIONS } from '../data/inactivePresets';
import { calculateDaysOffline, calculateFFScouterEstimate } from '../utils/ffscouter';
import { safeFetchJson } from '../utils/apiClient';

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
  const [startUserIdInput, setStartUserIdInput] = useState('180000');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Scan specific Faction ID live from Torn API
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
      setSuccessMsg(`Successfully scanned Faction #${fid} and loaded ${targets.length} targets!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan faction. Verify Faction ID and API key permissions.');
    } finally {
      setLoading(false);
    }
  };

  // Scan Live User ID Block from Torn API
  const handleScanRange = async () => {
    const start = parseInt(startUserIdInput, 10);
    if (!start || isNaN(start)) {
      setErrorMsg('Please enter a valid start User ID');
      return;
    }

    if (!apiKey) {
      setErrorMsg('Torn API Key is required for live range scanning');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const result = await safeFetchJson<any>(`/api/torn/scan-range?startId=${start}&count=15&key=${encodeURIComponent(apiKey)}`);
      if (!result.ok || !result.data) {
        throw new Error(result.error || 'Failed to scan ID range');
      }
      const data = result.data;

      if (data.error || !data.users) {
        throw new Error(data.error || 'Failed to scan ID range');
      }

      const foundTargets: InactiveTarget[] = data.users.map((u: any) => {
        const daysOffline = calculateDaysOffline(u.last_action || { relative: '0 days' });
        const rawProfile: Partial<PlayerProfile> = {
          player_id: u.player_id,
          name: u.name || `User_${u.player_id}`,
          level: u.level || 1,
          rank: u.rank || 'Civilian',
          age: u.age || 100,
          last_action: u.last_action || { status: 'Offline', relative: `${daysOffline} days ago`, timestamp: 0 },
          status: u.status || { description: 'Okay', details: '', state: 'Okay', until: 0 },
          personalstats: u.personalstats,
        };

        const ffScouter = calculateFFScouterEstimate(rawProfile, playerStats || { strength: 15000, defense: 15000, speed: 15000, dexterity: 15000, total: 60000 });

        return {
          ...rawProfile,
          daysOffline,
          ffScouter,
          attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${u.player_id}`,
          profileUrl: `https://www.torn.com/profiles.php?XID=${u.player_id}`,
        } as InactiveTarget;
      });

      onAddTargets(foundTargets);
      const nextId = data.nextStartId || (start + 15);
      setStartUserIdInput(nextId.toString());
      if (data.skipped) {
        setSuccessMsg(`Query complete: ${data.skipReason || `Auto-skipped +500 IDs past dead block to #${nextId}`}. Loaded ${foundTargets.length} targets.`);
      } else {
        setSuccessMsg(`Successfully queried User IDs ${start} - ${start + 15} live from Torn API! Loaded ${foundTargets.length} targets.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan user ID block');
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
            <h3 className="text-base font-bold text-white">Live Torn API Scanner</h3>
            <p className="text-xs text-slate-400">Query live Faction IDs and User ID ranges directly from Torn API</p>
          </div>
        </div>

        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Scanner Method 1: Scan Faction ID */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <label className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
            <Users className="w-4 h-4 text-red-400" /> Method 1: Scan Torn Faction ID
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={factionIdInput}
              onChange={(e) => setFactionIdInput(e.target.value)}
              placeholder="Enter Faction ID (e.g. 9812, 1042, 8800)..."
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
        </div>

        {/* Scanner Method 2: Batch User ID Range Scanner */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <label className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" /> Method 2: Live User ID Range Crawler
          </label>
          <p className="text-[11px] text-slate-400">
            Scans a block of consecutive User IDs directly from `api.torn.com` for active or inactive status.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={startUserIdInput}
              onChange={(e) => setStartUserIdInput(e.target.value)}
              placeholder="Start User ID (e.g. 180000, 250000, 500000)..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleScanRange}
              disabled={loading}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-slate-950 font-extrabold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0 font-mono shadow-md shadow-amber-950/50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
              <span>QUERY ID BLOCK LIVE</span>
            </button>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
                  <span>Faction ID: #{fac.id}</span>
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
