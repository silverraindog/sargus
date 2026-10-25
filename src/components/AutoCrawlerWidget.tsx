import React, { useState, useEffect } from 'react';
import { Cpu, Play, Pause, Database, RefreshCw, AlertCircle, Zap } from 'lucide-react';

interface AutoCrawlerWidgetProps {
  apiKey: string;
  onDbTargetsUpdated: () => void;
}

export const AutoCrawlerWidget: React.FC<AutoCrawlerWidgetProps> = ({ apiKey, onDbTargetsUpdated }) => {
  const [enabled, setEnabled] = useState(false);
  const [currentId, setCurrentId] = useState(180000);
  const [totalInDb, setTotalInDb] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [lastError, setLastError] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Fetch status from server
  const fetchStatus = async () => {
    try {
      const url = apiKey
        ? `/api/torn/crawler-status?key=${encodeURIComponent(apiKey)}`
        : '/api/torn/crawler-status';
      const res = await fetch(url);
      const data = await res.json();

      setEnabled(data.enabled);
      setCurrentId(data.currentId);
      if (data.totalInDb !== undefined) {
        if (data.totalInDb !== totalInDb && totalInDb !== 0) {
          onDbTargetsUpdated();
        }
        setTotalInDb(data.totalInDb);
      }
      setLastRun(data.lastRun || 0);
      setIsScanning(data.isScanning || false);
      if (data.lastStatusMessage) setStatusMsg(data.lastStatusMessage);
      if (data.lastError !== undefined) setLastError(data.lastError);
    } catch (e) {
      console.error('Failed to fetch crawler status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000); // Poll status every 8s
    return () => clearInterval(interval);
  }, [apiKey]);

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
      fetchStatus();
      onDbTargetsUpdated();
    } catch (e: any) {
      setMsg(e.message || 'Failed to toggle crawler');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = async () => {
    if (!apiKey) {
      setMsg('Please set your Torn API Key first to run a manual scan.');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const res = await fetch('/api/torn/crawler-scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          startId: currentId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentId(data.currentId);
        setTotalInDb(data.totalInDb);
        if (data.lastStatusMessage) setStatusMsg(data.lastStatusMessage);
        if (data.lastError) setLastError(data.lastError);
        onDbTargetsUpdated();
      }
    } catch (e: any) {
      setMsg(e.message || 'Failed to run manual scan');
    } finally {
      setLoading(false);
    }
  };

  // Format relative last run time
  const formatTimeAgo = (ts: number) => {
    if (!ts) return 'Never';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl text-slate-100 flex flex-col gap-3 font-mono text-xs">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Info */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              isScanning
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-spin'
                : enabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {isScanning ? <RefreshCw className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Background Auto-Crawler</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  isScanning
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : enabled
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {isScanning ? '⚡ SCANNING...' : enabled ? '🟢 ACTIVE (90s Loop)' : '⚪ PAUSED'}
              </span>
            </div>

            <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>
                Next Range: <strong className="text-amber-400">#{currentId} - #{currentId + 19}</strong>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Database className="w-3 h-3 text-red-400" />
                <span>Saved in DB:</span>
                <strong className="text-emerald-400 font-bold">{totalInDb} targets</strong>
              </span>
              <span>·</span>
              <span className="text-slate-400">Last run: {formatTimeAgo(lastRun)}</span>
            </div>
          </div>
        </div>

        {/* Control Buttons & Inputs */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Start ID:</span>
            <input
              type="number"
              value={currentId}
              onChange={(e) => setCurrentId(parseInt(e.target.value, 10) || 180000)}
              disabled={enabled || loading}
              className="w-20 px-1 py-0.5 bg-transparent text-amber-400 font-bold focus:outline-none text-xs"
            />
          </div>

          <button
            onClick={handleManualScan}
            disabled={loading || isScanning}
            title="Force run 1 scan cycle immediately"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0 shadow"
          >
            <Zap className={`w-3.5 h-3.5 fill-current ${loading || isScanning ? 'animate-spin' : ''}`} />
            <span>SCAN NOW</span>
          </button>

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

      {/* Real-time Status Message & Diagnostic Bar */}
      {(statusMsg || msg || lastError) && (
        <div className="pt-2 border-t border-slate-800/80 text-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-400">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-amber-400/80 font-semibold uppercase text-[9px] tracking-wider shrink-0">
              Status Log:
            </span>
            <span className="text-slate-300 truncate">{msg || statusMsg || 'Ready'}</span>
          </div>

          {lastError && (
            <div className="flex items-center gap-1.5 text-red-400 bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded shrink-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[280px]">{lastError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
