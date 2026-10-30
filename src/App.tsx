/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { KeyModal } from './components/KeyModal';
import { PlayerProfileCard } from './components/PlayerProfileCard';
import { TargetFilterBar } from './components/TargetFilterBar';
import { TargetTable } from './components/TargetTable';
import { TargetGrid } from './components/TargetGrid';
import { TargetDetailModal } from './components/TargetDetailModal';
import { FactionScannerModal } from './components/FactionScannerModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';
import { AttackHistoryTab } from './components/AttackHistoryTab';
import { AutoCrawlerWidget } from './components/AutoCrawlerWidget';
import { TargetDifficultyChart } from './components/TargetDifficultyChart';

import { AttackHistoryItem, BattleStats, FilterOptions, InactiveTarget, PlayerProfile } from './types/torn';
import { clearStoredApiKey, fetchSelfProfile, getStoredApiKey, loadInitialTargets, setStoredApiKey } from './services/tornApi';
import { calculateDaysOffline, calculateFFScouterEstimate, extractTargetCountry } from './utils/ffscouter';
import { safeFetchJson } from './utils/apiClient';
import { Key, ShieldAlert } from 'lucide-react';

const BOOKMARKS_STORAGE_KEY = 'torn_scouter_bookmarks';
const NOTES_STORAGE_KEY = 'torn_scouter_notes';
const HISTORY_STORAGE_KEY = 'sargus_attack_history';
const ARCHIVE_STORAGE_KEY = 'sargus_archived_attack_history';
const AUTO_REFRESH_STORAGE_KEY = 'sargus_auto_refresh_sec';

export default function App() {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());
  // Open modal automatically on page load if user hasn't set their key yet
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(!getStoredApiKey());

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerStats, setPlayerStats] = useState<BattleStats | null>(null);

  const [targets, setTargets] = useState<InactiveTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<InactiveTarget | null>(null);

  const [nextScanStartId, setNextScanStartId] = useState<number>(185000);
  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const [liveScanNotice, setLiveScanNotice] = useState<string | null>(null);

  // Auto Refresh state (default 30s, minimum 15s when enabled to respect Cloud Run rate limits)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(AUTO_REFRESH_STORAGE_KEY);
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (val === 0) return 0; // Off
        return Math.max(15, val); // Clamp to at least 15s
      }
      return 30; // default 30s
    } catch {
      return 30;
    }
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(Date.now());

  const handleAutoRefreshIntervalChange = (seconds: number) => {
    const sanitized = seconds === 0 ? 0 : Math.max(15, seconds);
    setAutoRefreshInterval(sanitized);
    localStorage.setItem(AUTO_REFRESH_STORAGE_KEY, sanitized.toString());
  };

  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [182763, 159203];
    } catch {
      return [182763, 159203];
    }
  });

  const [notesMap, setNotesMap] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(NOTES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [attackHistory, setAttackHistory] = useState<AttackHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [archivedHistory, setArchivedHistory] = useState<AttackHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<'targets' | 'scanner' | 'bookmarks' | 'history'>('targets');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Archive logs older than 30 days
  const handleArchiveOldLogs = (): { count: number; message: string } => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const active = attackHistory.filter((item) => item.timestamp >= cutoff);
    const old = attackHistory.filter((item) => item.timestamp < cutoff);

    if (old.length === 0) {
      return { count: 0, message: 'No attack logs older than 30 days were found in your active view.' };
    }

    const updatedArchive = [...old, ...archivedHistory];
    setAttackHistory(active);
    setArchivedHistory(updatedArchive);

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(active));
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(updatedArchive));

    return {
      count: old.length,
      message: `Successfully archived ${old.length} attack log(s) older than 30 days into local archive storage.`,
    };
  };

  // Restore archived logs back to active view
  const handleRestoreArchivedLogs = () => {
    if (archivedHistory.length === 0) return;
    const restored = [...attackHistory, ...archivedHistory].sort((a, b) => b.timestamp - a.timestamp);
    setAttackHistory(restored);
    setArchivedHistory([]);

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(restored));
    localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  };

  // Clear archived logs permanently
  const handleClearArchivedHistory = () => {
    setArchivedHistory([]);
    localStorage.removeItem(ARCHIVE_STORAGE_KEY);
  };

  // Filter state defaulting to >= 30 days offline (1 month or more as requested)
  const [filters, setFilters] = useState<FilterOptions>({
    minDaysOffline: 30,
    minLevel: 1,
    maxLevel: 100,
    difficultyFilter: 'ALL',
    statusFilter: 'ALL',
    hiddenStatuses: [],

    searchQuery: '',
    sortBy: 'DAYS_OFFLINE',
    sortOrder: 'desc',
    sourceCategory: 'ALL',
  });

  const [profileError, setProfileError] = useState<string | null>(null);

  // Fetch targets stored in server's persistent file database
  const fetchDbTargets = async () => {
    try {
      const result = await safeFetchJson<{ targets: any[]; totalCount: number }>('/api/torn/db-targets');
      if (result.ok && result.data?.targets && Array.isArray(result.data.targets)) {
        const parsedDbTargets: InactiveTarget[] = result.data.targets.map((u: any) => {
          const daysOffline = calculateDaysOffline(u.last_action || { relative: '0 days' });
          const country = extractTargetCountry(u);
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
            country,
            attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${u.player_id}`,
            profileUrl: `https://www.torn.com/profiles.php?XID=${u.player_id}`,
          } as InactiveTarget;
        });

        handleAddScannedTargets(parsedDbTargets);
      }
    } catch {
      // Handled cleanly by safeFetchJson
    }
  };

  // Global Refresh (manual click updates profile too, periodic auto-timer updates DB targets)
  const handleManualRefresh = async (includeProfile = true) => {
    setIsRefreshing(true);
    try {
      await fetchDbTargets();
      if (includeProfile && apiKey) {
        const { profile, battleStats, error } = await fetchSelfProfile(apiKey);
        if (profile) setPlayerProfile(profile);
        if (battleStats) setPlayerStats(battleStats);
        if (error) setProfileError(error);
      }
    } catch {
      // Handled cleanly
    } finally {
      setLastRefreshedAt(Date.now());
      setIsRefreshing(false);
    }
  };

  // Periodic Auto Refresh Timer
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      // On periodic tick, only refresh DB targets to prevent rate-limiting Torn user profile
      handleManualRefresh(false);
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, apiKey]);

  // Load player profile & initialize targets
  const loadProfileAndTargets = async (key: string) => {
    try {
      const { profile, battleStats, error } = await fetchSelfProfile(key);
      setPlayerProfile(profile);
      setPlayerStats(battleStats);
      setProfileError(error || null);

      const defaultStats = battleStats || { strength: 15000, defense: 15000, speed: 15000, dexterity: 15000, total: 60000 };
      const initialTargets = loadInitialTargets(defaultStats);
      setTargets(initialTargets);
      fetchDbTargets();
    } catch (err) {
      console.error('Error initializing Sargus:', err);
    }
  };

  useEffect(() => {
    loadProfileAndTargets(apiKey);
  }, [apiKey]);

  // Handle API Key update
  const handleSaveKey = (newKey: string) => {
    setStoredApiKey(newKey);
    setApiKey(newKey);
    loadProfileAndTargets(newKey);
  };

  // Scan live User ID blocks directly from Torn API (auto-skips +500 on 10x 404s or 10s timeout)
  const handleScanMoreLive = async () => {
    if (!apiKey) {
      setIsKeyModalOpen(true);
      return;
    }

    setIsScanningLive(true);
    setLiveScanNotice(null);
    try {
      const result = await safeFetchJson<any>(`/api/torn/scan-range?startId=${nextScanStartId}&count=20&key=${encodeURIComponent(apiKey)}`);
      if (result.ok && result.data) {
        if (result.data.users && Array.isArray(result.data.users)) {
          const foundTargets: InactiveTarget[] = result.data.users.map((u: any) => {
            const daysOffline = calculateDaysOffline(u.last_action || { relative: '0 days' });
            const country = extractTargetCountry(u);
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
              country,
              attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${u.player_id}`,
              profileUrl: `https://www.torn.com/profiles.php?XID=${u.player_id}`,
            } as InactiveTarget;
          });

          if (foundTargets.length > 0) {
            handleAddScannedTargets(foundTargets);
          }
        }

        if (result.data.nextStartId) {
          setNextScanStartId(result.data.nextStartId);
        } else {
          setNextScanStartId((prev) => prev + 20);
        }

        if (result.data.skipped) {
          setLiveScanNotice(result.data.skipReason || `Auto-skipped +500 IDs to #${result.data.nextStartId} (10 404s or 10s timeout hit)`);
          setTimeout(() => setLiveScanNotice(null), 8000);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live API targets:', err);
    } finally {
      setIsScanningLive(false);
    }
  };

  // Toggle Bookmark
  const handleToggleBookmark = (targetId: number) => {
    setBookmarkedIds((prev) => {
      const updated = prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId];
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Save Notes
  const handleSaveNotes = (targetId: number, notes: string) => {
    setNotesMap((prev) => {
      const updated = { ...prev, [targetId]: notes };
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Track Attack Action
  const handleMarkAttacked = (targetId: number) => {
    const targetObj = targets.find((t) => t.player_id === targetId);

    if (targetObj) {
      const newEntry: AttackHistoryItem = {
        id: `${targetId}_${Date.now()}`,
        targetId: targetObj.player_id,
        targetName: targetObj.name,
        targetLevel: targetObj.level,
        factionName: targetObj.faction?.faction_name,
        estimatedTotalStats: targetObj.ffScouter.estimatedTotalStats,
        difficulty: targetObj.ffScouter.difficulty,
        difficultyLabel: targetObj.ffScouter.difficultyLabel,
        estimatedFFMultiplier: targetObj.ffScouter.estimatedFFMultiplier,
        attackUrl: targetObj.attackUrl,
        timestamp: Date.now(),
        result: 'PENDING',
      };

      setAttackHistory((prev) => {
        const updated = [newEntry, ...prev];
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    }

    setTargets((prev) =>
      prev.map((t) =>
        t.player_id === targetId ? { ...t, lastAttackedTimestamp: Date.now() } : t
      )
    );
  };

  // Update Attack History result outcome (Success / Failure / Pending)
  const handleUpdateAttackResult = (id: string, result: 'SUCCESS' | 'FAILURE' | 'PENDING') => {
    setAttackHistory((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, result } : item
      );
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Handle re-attacking from History tab
  const handleAttackAgainFromHistory = (item: AttackHistoryItem) => {
    const newEntry: AttackHistoryItem = {
      ...item,
      id: `${item.targetId}_${Date.now()}`,
      timestamp: Date.now(),
      result: 'PENDING',
    };
    setAttackHistory((prev) => {
      const updated = [newEntry, ...prev];
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Clear attack history
  const handleClearHistory = () => {
    setAttackHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  // Remove single history item
  const handleRemoveHistoryItem = (id: string) => {
    setAttackHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Remove multiple history items in a batch
  const handleBatchRemoveHistoryItems = (ids: string[]) => {
    const idSet = new Set(ids);
    setAttackHistory((prev) => {
      const updated = prev.filter((item) => !idSet.has(item.id));
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Add or update scanned targets from faction scanner or crawler
  const handleAddScannedTargets = (scanned: InactiveTarget[]) => {
    setTargets((prev) => {
      const existingIds = new Set(prev.map((p) => p.player_id));
      const newItems = scanned.filter((s) => !existingIds.has(s.player_id));
      const updatedPrev = prev.map((item) => {
        const match = scanned.find((s) => s.player_id === item.player_id);
        return match ? { ...item, ...match } : item;
      });
      return [...newItems, ...updatedPrev];
    });
  };

  // Filtered and Sorted Targets Calculation
  const filteredTargets = useMemo(() => {
    return targets
      .map((t) => ({
        ...t,
        isBookmarked: bookmarkedIds.includes(t.player_id),
        notes: notesMap[t.player_id] || t.notes || '',
        ffScouter: playerStats ? calculateFFScouterEstimate(t, playerStats) : t.ffScouter,
      }))
      .filter((target) => {
        if (target.daysOffline < filters.minDaysOffline) return false;
        if (target.level < filters.minLevel || target.level > filters.maxLevel) return false;
        if (filters.difficultyFilter !== 'ALL' && target.ffScouter.difficulty !== filters.difficultyFilter) {
          return false;
        }
        const targetState = (target.status.state || 'Okay').toLowerCase();
        if (filters.hiddenStatuses.map(s => s.toLowerCase()).includes(targetState)) {
          console.log('Filtering out target due to hidden status:', target.name, targetState, filters.hiddenStatuses);
          return false;
        }
        if (filters.statusFilter === 'OKAY_ONLY' && targetState !== 'okay') {
          return false;
        }
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const nameMatch = target.name.toLowerCase().includes(q);
          const idMatch = target.player_id.toString().includes(q);
          const factionMatch = target.faction?.faction_name.toLowerCase().includes(q) || false;
          const countryMatch = target.country?.toLowerCase().includes(q) || false;
          if (!nameMatch && !idMatch && !factionMatch && !countryMatch) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (filters.sortBy === 'DAYS_OFFLINE') {
          comp = a.daysOffline - b.daysOffline;
        } else if (filters.sortBy === 'DIFFICULTY') {
          comp = a.ffScouter.statRatio - b.ffScouter.statRatio;
        } else if (filters.sortBy === 'EST_STATS') {
          comp = a.ffScouter.estimatedTotalStats - b.ffScouter.estimatedTotalStats;
        } else if (filters.sortBy === 'LEVEL') {
          comp = a.level - b.level;
        } else if (filters.sortBy === 'FAIR_FIGHT') {
          comp = b.ffScouter.estimatedFFMultiplier - a.ffScouter.estimatedFFMultiplier;
        }
        return filters.sortOrder === 'desc' ? -comp : comp;
      });
  }, [targets, filters, bookmarkedIds, notesMap, playerStats]);

  // Bookmarked targets list
  const bookmarkedTargets = useMemo(() => {
    return targets
      .filter((t) => bookmarkedIds.includes(t.player_id))
      .map((t) => ({
        ...t,
        isBookmarked: true,
        notes: notesMap[t.player_id] || '',
        ffScouter: playerStats ? calculateFFScouterEstimate(t, playerStats) : t.ffScouter,
      }));
  }, [targets, bookmarkedIds, notesMap, playerStats]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500 selection:text-white flex flex-col justify-between">
      <div>
        {/* API Key Setup Banner if no key configured */}
        {!apiKey && (
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-red-950 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 font-mono text-center flex flex-wrap items-center justify-center gap-2 shadow-lg">
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <strong>Welcome to Sargus!</strong> Setup your own Torn API Key to fetch your live level &amp; battle stats.
            </span>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg transition-colors uppercase text-[10px] shadow-sm"
            >
              Configure Your Key
            </button>
          </div>
        )}

        {/* Header Navigation */}
        <Header
          apiKey={apiKey}
          onOpenKeyModal={() => setIsKeyModalOpen(true)}
          playerProfile={playerProfile}
          playerStats={playerStats}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          bookmarkCount={bookmarkedIds.length}
          historyCount={attackHistory.length}
          autoRefreshInterval={autoRefreshInterval}
          onAutoRefreshIntervalChange={handleAutoRefreshIntervalChange}
          onManualRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          lastRefreshedAt={lastRefreshedAt}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Authenticated Player Overview Card */}
          <PlayerProfileCard
            profile={playerProfile}
            battleStats={playerStats}
            profileError={profileError}
            onOpenKeyModal={() => setIsKeyModalOpen(true)}
          />

          {/* Auto-Crawler Control Bar */}
          <AutoCrawlerWidget apiKey={apiKey} onDbTargetsUpdated={fetchDbTargets} />

          {/* Tab 1: Main Target Scouting View */}
          {activeTab === 'targets' && (
            <>
              {liveScanNotice && (
                <div className="mb-4 bg-gradient-to-r from-amber-950/90 via-rose-950/80 to-amber-950/90 border border-amber-500/50 rounded-xl p-3 text-amber-200 text-xs font-mono flex items-center justify-between gap-3 shadow-lg shadow-amber-950/40 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase text-[10px]">
                      ⚡ Live Scanner Auto-Jump
                    </span>
                    <span>{liveScanNotice}</span>
                  </div>
                  <button
                    onClick={() => setLiveScanNotice(null)}
                    className="text-amber-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <TargetFilterBar

                filters={filters}
                onFilterChange={(updated) => setFilters((prev) => ({ ...prev, ...updated }))}
                onResetFilters={() =>
                  setFilters({
                    minDaysOffline: 30,
                    minLevel: 1,
                    maxLevel: 100,
                    difficultyFilter: 'ALL',
                    statusFilter: 'ALL',
                    hiddenStatuses: [],

                    searchQuery: '',
                    sortBy: 'DAYS_OFFLINE',
                    sortOrder: 'desc',
                    sourceCategory: 'ALL',
                  })
                }
                viewMode={viewMode}
                setViewMode={setViewMode}
                totalCount={targets.length}
                filteredCount={filteredTargets.length}
                onScanMoreLive={handleScanMoreLive}
                isScanningLive={isScanningLive}
              />

              <TargetDifficultyChart targets={filteredTargets} />

              {viewMode === 'table' ? (
                <TargetTable
                  targets={filteredTargets}
                  onSelectTarget={(t) => setSelectedTarget(t)}
                  onToggleBookmark={handleToggleBookmark}
                  onMarkAttacked={handleMarkAttacked}
                />
              ) : (
                <TargetGrid
                  targets={filteredTargets}
                  onSelectTarget={(t) => setSelectedTarget(t)}
                  onToggleBookmark={handleToggleBookmark}
                  onMarkAttacked={handleMarkAttacked}
                />
              )}
            </>
          )}

          {/* Tab 2: Faction Scanner */}
          {activeTab === 'scanner' && (
            <FactionScannerModal
              apiKey={apiKey}
              playerStats={playerStats}
              onAddTargets={handleAddScannedTargets}
            />
          )}

          {/* Tab 3: Saved Targets Queue */}
          {activeTab === 'bookmarks' && (
            <BookmarksDrawer
              bookmarkedTargets={bookmarkedTargets}
              onSelectTarget={(t) => setSelectedTarget(t)}
              onToggleBookmark={handleToggleBookmark}
              onClearAll={() => {
                setBookmarkedIds([]);
                localStorage.removeItem(BOOKMARKS_STORAGE_KEY);
              }}
            />
          )}

          {/* Tab 4: Attack History Log */}
          {activeTab === 'history' && (
            <AttackHistoryTab
              history={attackHistory}
              archivedHistory={archivedHistory}
              onClearHistory={handleClearHistory}
              onRemoveItem={handleRemoveHistoryItem}
              onBatchRemoveItems={handleBatchRemoveHistoryItems}
              onAttackAgain={handleAttackAgainFromHistory}
              onUpdateResult={handleUpdateAttackResult}
              onArchiveOldLogs={handleArchiveOldLogs}
              onRestoreArchived={handleRestoreArchivedLogs}
              onClearArchived={handleClearArchivedHistory}
            />
          )}
        </main>
      </div>

      {/* Target Detail Modal */}
      <TargetDetailModal
        target={selectedTarget}
        onClose={() => setSelectedTarget(null)}
        onToggleBookmark={handleToggleBookmark}
        onSaveNotes={handleSaveNotes}
      />

      {/* API Key Modal */}
      <KeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
        currentKey={apiKey}
        onSaveKey={handleSaveKey}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>SARGUS v2.4</span> · <span>Powered by Torn API &amp; FFScouter Stat Engine</span>
          </div>
          <div className="text-slate-600">
            Attack redirects navigate directly to official Torn City page (`page.php?sid=attack&amp;user2ID=...`)
          </div>
        </div>
      </footer>
    </div>
  );
}
