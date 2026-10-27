import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  Pause,
  Database,
  RefreshCw,
  AlertCircle,
  Zap,
  FastForward,
  ShieldCheck,
  AlertTriangle,
  Activity,
  ArrowRight,
  Clock,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';

import { safeFetchJson } from '../utils/apiClient';

interface AutoCrawlerWidgetProps {
  apiKey: string;
  onDbTargetsUpdated: () => void;
}

interface LiveScanInfo {
  isScanning: boolean;
  startId: number;
  endId: number;
  total: number;
  scannedCount: number;
  remaining: number;
  currentPid: number;
  isSkipping: boolean;
  skipReason: string;
  jumpStep?: number;
  jumpTargetId?: number;
}

export const AutoCrawlerWidget: React.FC<AutoCrawlerWidgetProps> = ({ apiKey, onDbTargetsUpdated }) => {
  const [enabled, setEnabled] = useState(false);
  const [currentId, setCurrentId] = useState(180000);
  const [totalInDb, setTotalInDb] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [lastError, setLastError] = useState('');
  const [consecutiveDeadBatches, setConsecutiveDeadBatches] = useState(0);
  const [consecutiveIncorrectIds, setConsecutiveIncorrectIds] = useState(0);
  const [totalDeadBlocksSkipped, setTotalDeadBlocksSkipped] = useState(0);
  const [lastJumpSize, setLastJumpSize] = useState(0);
  const [skipRangesCount, setSkipRangesCount] = useState(0);
  const [maxConsecutive404s, setMaxConsecutive404s] = useState(10);
  const [timeoutMs, setTimeoutMs] = useState(10000);
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0);
  const [totalTimeoutsSkipped, setTotalTimeoutsSkipped] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [setting404Limit, setSetting404Limit] = useState(10);
  const [settingTimeoutSec, setSettingTimeoutSec] = useState(10);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const [liveScan, setLiveScan] = useState<LiveScanInfo>({
    isScanning: false,
    startId: 180000,
    endId: 180019,
    total: 20,
    scannedCount: 0,
    remaining: 20,
    currentPid: 180000,
    isSkipping: false,
    skipReason: '',
  });

  // Fetch status from server using safeFetchJson
  const fetchStatus = async () => {
    try {
      const url = apiKey
        ? `/api/torn/crawler-status?key=${encodeURIComponent(apiKey)}`
        : '/api/torn/crawler-status';
      const result = await safeFetchJson<any>(url);

      if (!result.ok || !result.data) {
        if (result.isRateLimited) {
          // Throttled by Cloud Run / proxy, wait quietly
          return;
        }
        return;
      }

      const data = result.data;
      setEnabled(data.enabled);
      setCurrentId(data.currentId);
      if (data.totalInDb !== undefined) {
        if (data.totalInDb !== totalInDb) {
          onDbTargetsUpdated();
        }
        setTotalInDb(data.totalInDb);
      }
      setLastRun(data.lastRun || 0);
      setIsScanning(data.isScanning || false);
      if (data.lastStatusMessage) setStatusMsg(data.lastStatusMessage);
      if (data.lastError !== undefined) setLastError(data.lastError);
      if (data.consecutiveDeadBatches !== undefined) setConsecutiveDeadBatches(data.consecutiveDeadBatches);
      if (data.consecutiveIncorrectIds !== undefined) setConsecutiveIncorrectIds(data.consecutiveIncorrectIds);
      if (data.totalDeadBlocksSkipped !== undefined) setTotalDeadBlocksSkipped(data.totalDeadBlocksSkipped);
      if (data.lastJumpSize !== undefined) setLastJumpSize(data.lastJumpSize);
      if (data.skipRangesCount !== undefined) setSkipRangesCount(data.skipRangesCount);
      if (data.maxConsecutive404s !== undefined) {
        setMaxConsecutive404s(data.maxConsecutive404s);
        setSetting404Limit(data.maxConsecutive404s);
      }
      if (data.timeoutMs !== undefined) {
        setTimeoutMs(data.timeoutMs);
        setSettingTimeoutSec(Math.round(data.timeoutMs / 1000));
      }
      if (data.consecutiveTimeouts !== undefined) setConsecutiveTimeouts(data.consecutiveTimeouts);
      if (data.totalTimeoutsSkipped !== undefined) setTotalTimeoutsSkipped(data.totalTimeoutsSkipped);

      if (data.liveScan) {
        setLiveScan(data.liveScan);
      }
    } catch {
      // Ignore network errors gracefully
    }
  };

  useEffect(() => {
    fetchStatus();
    // Moderate polling: 3.5s while actively scanning, 6s when active, 12s when paused to avoid rate limits
    const pollInterval = isScanning ? 3500 : enabled ? 6000 : 12000;
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [apiKey, isScanning, enabled]);

  const handleToggleCrawler = async (nextState?: boolean) => {
    const targetState = nextState !== undefined ? nextState : !enabled;

    if (targetState && !apiKey) {
      setMsg('Please set your Torn API Key first to enable auto-crawling.');
      return;
    }

    setLoading(true);
    setMsg('');

    try {
      const result = await safeFetchJson<any>('/api/torn/crawler-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: targetState,
          apiKey,
          startId: currentId,
        }),
      });

      if (!result.ok || !result.data) {
        setMsg(result.error || 'Failed to toggle crawler');
        return;
      }

      const data = result.data;
      setEnabled(data.enabled);
      setMsg(data.message || (data.enabled ? 'Crawler started' : 'Crawler paused'));
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
      const result = await safeFetchJson<any>('/api/torn/crawler-scan-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          startId: currentId,
        }),
      });

      if (!result.ok || !result.data) {
        setMsg(result.error || 'Failed to run manual scan');
        return;
      }

      const data = result.data;
      if (data.success) {
        setCurrentId(data.currentId);
        setTotalInDb(data.totalInDb);
        if (data.lastStatusMessage) setStatusMsg(data.lastStatusMessage);
        if (data.lastError) setLastError(data.lastError);
        fetchStatus();
        onDbTargetsUpdated();
      }
    } catch (e: any) {
      setMsg(e.message || 'Failed to run manual scan');
    } finally {
      setLoading(false);
    }
  };

  // Manually jump forward past dead ID ranges
  const handleManualJump = async (step: number) => {
    setLoading(true);
    setMsg('');
    try {
      const result = await safeFetchJson<any>('/api/torn/crawler-jump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      if (!result.ok || !result.data) {
        setMsg(result.error || 'Failed to jump ID range');
        return;
      }
      const data = result.data;
      if (data.success) {
        setCurrentId(data.currentId);
        if (data.message) setStatusMsg(data.message);
        fetchStatus();
      }
    } catch (e: any) {
      setMsg(e.message || 'Failed to jump ID range');
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

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setMsg('');
    try {
      const result = await safeFetchJson<any>('/api/torn/crawler-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxConsecutive404s: setting404Limit,
          timeoutMs: settingTimeoutSec * 1000,
        }),
      });
      if (result.ok && result.data?.success) {
        setMaxConsecutive404s(result.data.maxConsecutive404s);
        setTimeoutMs(result.data.timeoutMs);
        setMsg(`Settings saved: Auto-skip on ${result.data.maxConsecutive404s} 404s or ${result.data.timeoutMs / 1000}s timeout`);
        setShowSettings(false);
        fetchStatus();
      } else {
        setMsg(result.error || 'Failed to save settings');
      }
    } catch (e: any) {
      setMsg(e.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Compute live scan figures
  const scanTotal = liveScan.total || 20;
  const scanStartId = liveScan.startId || currentId;
  const scanEndId = liveScan.endId || (scanStartId + scanTotal - 1);
  const scannedCount = isScanning
    ? Math.min(scanTotal, liveScan.scannedCount)
    : scanTotal;
  const remainingIds = isScanning
    ? Math.max(0, scanTotal - scannedCount)
    : 0;
  const scanPercent = isScanning
    ? Math.min(100, Math.max(5, Math.round((scannedCount / scanTotal) * 100)))
    : 100;

  const isSkippingState =
    liveScan.isSkipping ||
    consecutiveIncorrectIds >= 5 ||
    consecutiveTimeouts > 0 ||
    consecutiveDeadBatches >= 2;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-xl text-slate-100 flex flex-col gap-3 font-mono text-xs">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Info */}
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 transition-all ${
              isSkippingState
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse'
                : isScanning
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-spin'
                : enabled
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            {isSkippingState ? (
              <FastForward className="w-5 h-5 text-amber-400 animate-pulse" />
            ) : isScanning ? (
              <RefreshCw className="w-5 h-5" />
            ) : (
              <Cpu className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white text-sm">Background Auto-Crawler</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                  isSkippingState
                    ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse'
                    : isScanning
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : enabled
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
              >
                {isSkippingState
                  ? '⏩ AUTO-SKIPPING (10 404s / 10s Timeout)'
                  : isScanning
                  ? '⚡ SCANNING...'
                  : enabled
                  ? '🟢 ACTIVE (30s Loop)'
                  : '⚪ PAUSED'}
              </span>

              {/* 404 Tracker Chip */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${
                consecutiveIncorrectIds >= 5
                  ? 'bg-rose-950 text-rose-200 border-rose-700 animate-pulse'
                  : consecutiveIncorrectIds > 0
                  ? 'bg-amber-950/70 text-amber-300 border-amber-800/70'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`}>
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>404s: <strong>{consecutiveIncorrectIds}/{maxConsecutive404s}</strong></span>
                <span className="text-slate-400 text-[9px]">(Auto-Skip at {maxConsecutive404s})</span>
              </span>

              {/* 10s Timeout Watchdog Badge */}
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${
                consecutiveTimeouts > 0
                  ? 'bg-amber-950 text-amber-200 border-amber-700 animate-pulse'
                  : 'bg-slate-950 text-slate-400 border-slate-800'
              }`} title="Requests automatically abort and trigger a +500 skip if any ID fetch takes 10 seconds">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{timeoutMs / 1000}s Watchdog:</span>
                <span className="text-emerald-400 font-bold">{consecutiveTimeouts > 0 ? `${consecutiveTimeouts} Timeout(s)` : 'Active'}</span>
              </span>

              {consecutiveDeadBatches > 1 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/80 animate-pulse">
                  Dead Zone ({consecutiveDeadBatches} empty batches)
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
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
              {totalDeadBlocksSkipped > 0 && (
                <>
                  <span>·</span>
                  <span className="text-amber-400/90 font-medium flex items-center gap-1">
                    <FastForward className="w-3 h-3" />
                    <span>{totalDeadBlocksSkipped} dead block{totalDeadBlocksSkipped > 1 ? 's' : ''} auto-skipped</span>
                    {totalTimeoutsSkipped > 0 && (
                      <span className="text-slate-400 text-[10px]">({totalTimeoutsSkipped} timeouts)</span>
                    )}
                  </span>
                </>
              )}
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
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Auto-Skip thresholds (10 404s, 10s timeout)"
            className={`px-2.5 py-2 border rounded-xl font-bold text-xs flex items-center gap-1 transition-all shrink-0 ${
              showSettings
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Skip Rules</span>
          </button>

          <button
            onClick={() => handleManualJump(500)}
            disabled={loading || isScanning}
            title="Fast-forward +500 IDs forward to bypass empty/dead ranges"
            className="px-2.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 rounded-xl font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50 shrink-0"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>+500 SKIP</span>
          </button>

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

      {/* Auto-Skip Settings Panel */}
      {showSettings && (
        <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3 text-slate-200 shadow-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex flex-col gap-1">
            <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-Skip Threshold Rules</span>
            </span>
            <p className="text-[11px] text-slate-400">
              When the crawler or live scanner encounters 10 404s or a 10s timeout, it fast-forwards +500 IDs past the dead block.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">404 Limit:</span>
              <input
                type="number"
                min={3}
                max={50}
                value={setting404Limit}
                onChange={(e) => setSetting404Limit(Math.max(1, parseInt(e.target.value, 10) || 10))}
                className="w-12 bg-transparent text-amber-400 font-bold text-xs focus:outline-none text-center"
              />
              <span className="text-[10px] text-slate-500">404s</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Timeout:</span>
              <input
                type="number"
                min={3}
                max={30}
                value={settingTimeoutSec}
                onChange={(e) => setSettingTimeoutSec(Math.max(2, parseInt(e.target.value, 10) || 10))}
                className="w-12 bg-transparent text-amber-400 font-bold text-xs focus:outline-none text-center"
              />
              <span className="text-[10px] text-slate-500">sec</span>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-all disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{savingSettings ? 'Saving...' : 'Apply'}</span>
            </button>

            <button
              onClick={() => setShowSettings(false)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Skipping State Banner: visible when consecutive 404s trigger or approach jump threshold */}
      {isSkippingState && (
        <div className="bg-gradient-to-r from-rose-950/80 via-amber-950/70 to-rose-950/80 border border-amber-500/50 rounded-lg p-3 text-amber-200 shadow-lg shadow-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[10px] uppercase tracking-wider bg-rose-900/90 text-rose-200 border border-rose-700/80 px-2 py-0.5 rounded">
                  AUTO-SKIPPING ACTIVE
                </span>
                <span className="text-[10px] text-amber-400 font-bold">
                  Bypassing Dead ID Segment
                </span>
              </div>
              <p className="text-[11px] text-slate-200 mt-0.5">
                {liveScan.skipReason || (
                  consecutiveIncorrectIds >= maxConsecutive404s
                    ? `Reached ${consecutiveIncorrectIds} consecutive 404s ('Incorrect ID'). Fast-forwarding +500 IDs to resume scanning.`
                    : consecutiveTimeouts > 0
                    ? `10-second timeout reached fetching IDs from Torn API. Fast-forwarding +500 IDs to prevent stalls.`
                    : `Detected high frequency of 404s (${consecutiveIncorrectIds}/${maxConsecutive404s}). Approaching auto-skip threshold (+500 IDs).`
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <span className="px-2 py-1 rounded bg-slate-950/80 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1.5">
              <FastForward className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-Jump: +500 IDs</span>
            </span>
          </div>
        </div>
      )}

      {/* Live-Scan Visual Progress Bar with Remaining IDs Counter */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Activity className={`w-3.5 h-3.5 ${isScanning ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Live Range:</span>
              <strong className="text-amber-300 font-bold">#{scanStartId} &rarr; #{scanEndId}</strong>
            </span>

            {isScanning && liveScan.currentPid && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-300 border border-slate-700">
                Checking ID: <strong className="text-white">#{liveScan.currentPid}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] self-end sm:self-auto">
            <span className="text-slate-400">
              Scanned: <strong className="text-white">{scannedCount}</strong> / {scanTotal}
            </span>
            <span className="text-slate-600">|</span>
            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border flex items-center gap-1 ${
              isScanning
                ? remainingIds > 0
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              <span>Remaining:</span>
              <strong className="text-xs text-amber-300 font-bold">{remainingIds}</strong>
              <span>IDs</span>
            </span>
          </div>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5 relative">
          <div
            className={`h-full rounded-full transition-all duration-300 relative ${
              isSkippingState
                ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                : isScanning
                ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-emerald-500/70'
            }`}
            style={{ width: `${scanPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            {isScanning
              ? `Scanning batch (${scannedCount}/${scanTotal} verified) ...`
              : enabled
              ? `Batch completed. Next scan cycle triggers in 30s.`
              : `Crawler paused. Click 'START AUTO-CRAWLER' or 'SCAN NOW' to run.`}
          </span>
          <span className="font-semibold text-slate-400">
            {scanPercent}% {isScanning ? 'Complete' : 'Cycle Ready'}
          </span>
        </div>
      </div>

      {/* Real-time Status Message, Diagnostic Bar & Batch Validator Chip */}
      <div className="pt-2 border-t border-slate-800/80 text-[11px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-slate-400">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-amber-400/80 font-semibold uppercase text-[9px] tracking-wider shrink-0">
            Status Log:
          </span>
          <span className="text-slate-300 truncate">{msg || statusMsg || 'Ready'}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-emerald-400/80 text-[10px] bg-emerald-950/40 border border-emerald-800/30 px-2 py-0.5 rounded">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Batch Validator: Strict &gt;=30d</span>
          </span>

          {lastError && (
            <div className="flex items-center gap-1.5 text-red-400 bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded shrink-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[280px]">{lastError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
