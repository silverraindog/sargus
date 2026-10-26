import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, ChevronDown, Check, Clock, Zap } from 'lucide-react';

export interface AutoRefreshOption {
  label: string;
  value: number; // in seconds, 0 = Off
  badge?: string;
}

export const REFRESH_OPTIONS: AutoRefreshOption[] = [
  { label: 'Off (Manual)', value: 0 },
  { label: 'Every 15s', value: 15, badge: 'FAST' },
  { label: 'Every 30s', value: 30, badge: 'REC' },
  { label: 'Every 60s (1 min)', value: 60 },
  { label: 'Every 5 mins', value: 300 },
];

interface AutoRefreshDropdownProps {
  interval: number; // current interval in seconds, 0 = off
  onIntervalChange: (seconds: number) => void;
  onManualRefresh: () => Promise<void> | void;
  isRefreshing?: boolean;
  lastRefreshedAt?: number;
}

export const AutoRefreshDropdown: React.FC<AutoRefreshDropdownProps> = ({
  interval,
  onIntervalChange,
  onManualRefresh,
  isRefreshing = false,
  lastRefreshedAt = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState<number>(interval);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (interval <= 0) {
      setCountdown(0);
      return;
    }

    setCountdown(interval);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return interval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interval, lastRefreshedAt]);

  const activeOption = REFRESH_OPTIONS.find((opt) => opt.value === interval) || REFRESH_OPTIONS[0];

  const handleTriggerRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onManualRefresh();
    if (interval > 0) {
      setCountdown(interval);
    }
  };

  const handleSelectOption = (value: number) => {
    onIntervalChange(value);
    setIsOpen(false);
    if (value > 0) {
      setCountdown(value);
    }
  };

  // Format time ago for tooltip/status
  const formatTimeAgo = () => {
    if (!lastRefreshedAt) return 'Never';
    const seconds = Math.floor((Date.now() - lastRefreshedAt) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  return (
    <div className="relative inline-block text-left font-mono" ref={containerRef}>
      <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-md transition-all overflow-hidden">
        {/* Main Refresh Trigger Button */}
        <button
          type="button"
          onClick={handleTriggerRefresh}
          disabled={isRefreshing}
          title={`Click to refresh data now (Last updated: ${formatTimeAgo()})`}
          className={`px-2.5 py-1.5 flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white transition-colors disabled:opacity-60 ${
            isRefreshing ? 'bg-slate-850' : ''
          }`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-amber-400 ${
              isRefreshing ? 'animate-spin text-amber-300' : ''
            }`}
          />
          <span className="hidden sm:inline text-[11px] uppercase tracking-wider">Refresh</span>
          {interval > 0 ? (
            <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>{countdown}s</span>
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-normal">Off</span>
          )}
        </button>

        {/* Separator */}
        <div className="w-[1px] h-4 bg-slate-800" />

        {/* Dropdown Menu Chevron Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          title="Change Auto Refresh Interval"
          className="px-1.5 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-amber-400' : ''
            }`}
          />
        </button>
      </div>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 py-1 text-xs text-slate-200 divide-y divide-slate-800/60 font-sans animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" />
              Auto Refresh Rate
            </span>
            <span className="text-[9px] text-slate-500 font-normal">{formatTimeAgo()}</span>
          </div>

          <div className="py-1">
            {REFRESH_OPTIONS.map((option) => {
              const isSelected = interval === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleSelectOption(option.value)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between font-mono text-xs transition-colors ${
                    isSelected
                      ? 'bg-amber-500/10 text-amber-300 font-bold'
                      : 'hover:bg-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{option.label}</span>
                  </div>

                  {option.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        option.badge === 'REC'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                      }`}
                    >
                      {option.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-3 py-2 text-[10px] font-mono text-slate-400 bg-slate-950/50 flex items-center justify-between">
            <span>Manual Refresh:</span>
            <button
              onClick={handleTriggerRefresh}
              className="text-amber-400 hover:underline font-bold flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              Sync Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
