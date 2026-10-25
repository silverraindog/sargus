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
import { AiTacticalAdvisorModal } from './components/AiTacticalAdvisorModal';
import { BookmarksDrawer } from './components/BookmarksDrawer';

import { BattleStats, FilterOptions, InactiveTarget, PlayerProfile } from './types/torn';
import { clearStoredApiKey, fetchSelfProfile, getStoredApiKey, loadInitialTargets, setStoredApiKey } from './services/tornApi';
import { calculateFFScouterEstimate } from './utils/ffscouter';
import { RefreshCw, ShieldAlert, Sparkles, Swords } from 'lucide-react';

const BOOKMARKS_STORAGE_KEY = 'torn_scouter_bookmarks';
const NOTES_STORAGE_KEY = 'torn_scouter_notes';

export default function App() {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey());
  const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);

  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [playerStats, setPlayerStats] = useState<BattleStats | null>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  const [targets, setTargets] = useState<InactiveTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<InactiveTarget | null>(null);

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

  const [activeTab, setActiveTab] = useState<'targets' | 'scanner' | 'advisor' | 'bookmarks'>('targets');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Filter state defaulting to >= 30 days offline (1 month or more as requested)
  const [filters, setFilters] = useState<FilterOptions>({
    minDaysOffline: 30,
    minLevel: 1,
    maxLevel: 100,
    difficultyFilter: 'ALL',
    statusFilter: 'ALL',
    searchQuery: '',
    sortBy: 'DAYS_OFFLINE',
    sortOrder: 'desc',
    sourceCategory: 'ALL',
  });

  // Load player profile & initialize targets
  const loadProfileAndTargets = async (key: string) => {
    setLoadingProfile(true);
    try {
      const { profile, battleStats } = await fetchSelfProfile(key);
      setPlayerProfile(profile);
      setPlayerStats(battleStats);

      const initialTargets = loadInitialTargets(battleStats);
      setTargets(initialTargets);
    } catch (err) {
      console.error('Error initializing Torn Scouter:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (apiKey) {
      loadProfileAndTargets(apiKey);
    }
  }, [apiKey]);

  // Handle API Key update
  const handleSaveKey = (newKey: string) => {
    setStoredApiKey(newKey);
    setApiKey(newKey);
    loadProfileAndTargets(newKey);
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

  // Mark Attacked
  const handleMarkAttacked = (targetId: number) => {
    setTargets((prev) =>
      prev.map((t) =>
        t.player_id === targetId ? { ...t, lastAttackedTimestamp: Date.now() } : t
      )
    );
  };

  // Add scanned targets from faction scanner
  const handleAddScannedTargets = (scanned: InactiveTarget[]) => {
    setTargets((prev) => {
      const existingIds = new Set(prev.map((p) => p.player_id));
      const newItems = scanned.filter((s) => !existingIds.has(s.player_id));
      return [...newItems, ...prev];
    });
    setActiveTab('targets');
  };

  // Filtered and Sorted Targets Calculation
  const filteredTargets = useMemo(() => {
    return targets
      .map((t) => ({
        ...t,
        isBookmarked: bookmarkedIds.includes(t.player_id),
        notes: notesMap[t.player_id] || t.notes || '',
        // Re-calculate FFScouter estimate if playerStats changed
        ffScouter: playerStats ? calculateFFScouterEstimate(t, playerStats) : t.ffScouter,
      }))
      .filter((target) => {
        // 1. Min Days Offline (Inactives in 1 month / 30d+)
        if (target.daysOffline < filters.minDaysOffline) return false;

        // 2. Level filter
        if (target.level < filters.minLevel || target.level > filters.maxLevel) return false;

        // 3. Difficulty filter
        if (filters.difficultyFilter !== 'ALL' && target.ffScouter.difficulty !== filters.difficultyFilter) {
          return false;
        }

        // 4. Status filter
        if (filters.statusFilter === 'OKAY_ONLY' && target.status.state !== 'Okay') {
          return false;
        }

        // 5. Search query
        if (filters.searchQuery.trim()) {
          const q = filters.searchQuery.toLowerCase();
          const nameMatch = target.name.toLowerCase().includes(q);
          const idMatch = target.player_id.toString().includes(q);
          const factionMatch = target.faction?.faction_name.toLowerCase().includes(q) || false;
          if (!nameMatch && !idMatch && !factionMatch) return false;
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
        {/* Header Navigation */}
        <Header
          apiKey={apiKey}
          onOpenKeyModal={() => setIsKeyModalOpen(true)}
          playerProfile={playerProfile}
          playerStats={playerStats}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          bookmarkCount={bookmarkedIds.length}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Authenticated Player Overview Card */}
          <PlayerProfileCard profile={playerProfile} battleStats={playerStats} />

          {/* Tab 1: Main Target Scouting View */}
          {activeTab === 'targets' && (
            <>
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
              />

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

          {/* Tab 3: AI Tactical Advisor */}
          {activeTab === 'advisor' && (
            <AiTacticalAdvisorModal
              playerProfile={playerProfile}
              playerStats={playerStats}
              targets={targets}
            />
          )}

          {/* Tab 4: Saved Targets Queue */}
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
