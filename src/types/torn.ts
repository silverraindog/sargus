export type DifficultyLevel = 'VERY_EASY' | 'EASY' | 'MEDIUM' | 'HARD' | 'DANGER' | 'UNAVAILABLE';

export interface BattleStats {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
  total: number;
}

export interface PlayerProfile {
  player_id: number;
  name: string;
  level: number;
  gender?: string;
  age: number; // in days
  rank: string;
  faction?: {
    faction_id: number;
    faction_name: string;
    position: string;
    days_in_faction: number;
  };
  last_action: {
    status: 'Offline' | 'Idle' | 'Online';
    timestamp: number;
    relative: string;
  };
  status: {
    description: string;
    details: string;
    state: 'Okay' | 'Hospital' | 'Jail' | 'Traveling' | 'Fallen';
    until: number;
  };
  battleStats?: BattleStats;
  personalstats?: {
    attackswon?: number;
    xantaken?: number;
    refills?: number;
    statenhancers?: number;
    totalworkingstats?: number;
    useractivity?: number;
    networth?: number;
    totalcrimes?: number;
  };
  jobstats?: {
    manual_labor: number;
    intelligence: number;
    endurance: number;
  };
}

export interface FFScouterEstimate {
  estimatedTotalStats: number;
  minEstStats: number;
  maxEstStats: number;
  difficulty: DifficultyLevel;
  difficultyLabel: string;
  statRatio: number; // targetEst / playerTotal
  estimatedFFMultiplier: number; // Fair Fight multiplier (e.g. 1.0x to 3.0x)
  confidence: 'High' | 'Medium' | 'Low';
  breakdown: {
    baseLevelStats: number;
    xanaxBoost: number;
    refillBoost: number;
    seBoost: number;
    workingStatsBoost: number;
    ageFactor: number;
  };
}

export interface InactiveTarget extends PlayerProfile {
  ffScouter: FFScouterEstimate;
  attackUrl: string;
  profileUrl: string;
  daysOffline: number;
  notes?: string;
  isBookmarked?: boolean;
  lastAttackedTimestamp?: number;
}

export interface AttackHistoryItem {
  id: string;
  targetId: number;
  targetName: string;
  targetLevel: number;
  factionName?: string;
  estimatedTotalStats: number;
  difficulty: DifficultyLevel;
  difficultyLabel: string;
  estimatedFFMultiplier: number;
  attackUrl: string;
  timestamp: number;
  result?: 'SUCCESS' | 'FAILURE' | 'PENDING';
}

export interface FilterOptions {
  minDaysOffline: number; // 30 = 1 month
  minLevel: number;
  maxLevel: number;
  difficultyFilter: DifficultyLevel | 'ALL';
  statusFilter: 'ALL' | 'OKAY_ONLY' | 'INCLUDE_HOSPITAL';
  searchQuery: string;
  sortBy: 'DAYS_OFFLINE' | 'LEVEL' | 'EST_STATS' | 'DIFFICULTY' | 'FAIR_FIGHT';
  sortOrder: 'asc' | 'desc';
  sourceCategory: 'ALL' | 'INACTIVE_FACTIONS' | 'STARTER_TARGETS' | 'CUSTOM_SCAN';
}
