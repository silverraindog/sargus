import React, { useState, useEffect } from 'react';
import { Cpu, Play, Pause, Database, RefreshCw, Check, AlertCircle, Zap } from 'lucide-react';

interface AutoCrawlerWidgetProps {
  apiKey: string;
  onDbTargetsUpdated: () => void;
}

export const AutoCrawlerWidget: React.FC<AutoCrawlerWidgetProps> = ({ apiKey, onDbTargetsUpdated }) => {
  const [enabled, setEnabled] = useState(false);
  const [currentId, setCurrentId] = useState(180000);
  const [totalInDb, setTotalInDb] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Fetch status on load
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/torn/crawler-status');
      const data = await res.json();
      setEnabled(data.enabled);
      setCurrentId(data.currentId);
      setTotalInDb(data.totalInDb);
      setLastRun(data.lastRun);
    } catch (e) {
      console.error('Failed to fetch crawler status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Poll status every 15s
    return () => clearInterval(interval);
  }, []);

  const handleToggleCrawler = async (nextState?: boolean) => {
    const targetState = nextState !== undefined ? nextState : !enabled;

    if (targetState && !apiKey) {
      setMsg('Please set your Torn API Key first to enable auto-crawling.');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const res = await fetch('/api/torn/crawler-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: targetState,
          apiKey,
          startId: currentId,
        }),
      });

      const data = await res.json();
      setEnabled(data.enabled);
      setMsg(data.message);
      onDbTargetsUpdated();
    } catch (e: any) {
      setMsg(e.message || 'Failed to toggle crawler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl text-slate-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 font-mono text-xs">
      {/* Status Info */}
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            enabled
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-pulse'
              : 'bg-slate-950 border-slate-800 text-slate-500'
          }`}
        >
          <Cpu className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">Background Auto-Crawler</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                enabled
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              {enabled ? '🟢 ACTIVE (90s Loop)' : '⚪ PAUSED'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
            <span>Next ID Range: <strong className="text-amber-400">#{currentId}</strong></span>
            <span>·</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Database className="w-3 h-3 text-red-400" />
              <span>Saved in DB:</span>
              <strong className="text-emerald-400 font-bold">{totalInDb} targets</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons & Inputs */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase">Start ID:</span>
          <input
            type="number"
            value={currentId}
            onChange={(e) => setCurrentId(parseInt(e.target.value, 10) || 180000)}
            disabled={enabled}
            className="w-20 px-1 py-0.5 bg-transparent text-amber-400 font-bold focus:outline-none text-xs"
          />
        </div>

        <button
          onClick={() => handleToggleCrawler()}
          disabled={loading}
          className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all shrink-0 ${
            enabled
              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 border border-amber-500'
              : 'bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white border border-red-500/40 shadow-red-950/60'
          }`}
        >
          {enabled ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{enabled ? 'PAUSE CRAWLER' : 'START AUTO-CRAWLER'}</span>
        </button>
      </div>
    </div>
  );
};
