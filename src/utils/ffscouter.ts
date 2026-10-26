import { BattleStats, DifficultyLevel, FFScouterEstimate, PlayerProfile } from '../types/torn';

/**
 * Calculates the estimated battle stats and relative difficulty based on
 * FFScouter v2 principles for Torn City players.
 */
export function calculateFFScouterEstimate(
  target: Partial<PlayerProfile>,
  playerStats: BattleStats | null
): FFScouterEstimate {
  const level = target.level || 1;
  const age = target.age || 1;
  const ps = target.personalstats || {};

  const attackswon = ps.attackswon || 0;
  const xantaken = ps.xantaken || 0;
  const refills = ps.refills || 0;
  const statenhancers = ps.statenhancers || 0;
  const totalworkingstats = ps.totalworkingstats || 0;

  // 1. Estimate stat components
  const baseLevelStats = Math.round(Math.pow(level, 2.12) * 110);
  const xanaxBoost = Math.round(xantaken * 3100);
  const refillBoost = Math.round(refills * 2600);
  const seBoost = Math.round(statenhancers * 25000000);
  const workingStatsBoost = Math.round(totalworkingstats * 0.12);
  const ageFactor = Math.round(age * 55);

  const rawEstimate = Math.max(
    10,
    baseLevelStats + xanaxBoost + refillBoost + seBoost + workingStatsBoost + ageFactor
  );

  const minEstStats = Math.round(rawEstimate * 0.82);
  const maxEstStats = Math.round(rawEstimate * 1.25);

  // Default player stats if none provided (e.g. 50,000 total BS)
  const playerTotalBS = playerStats && playerStats.total > 0 ? playerStats.total : 50000;

  const statRatio = rawEstimate / playerTotalBS;

  // Check state
  const isUnavailable =
    target.status?.state === 'Hospital' ||
    target.status?.state === 'Jail' ||
    target.status?.state === 'Traveling' ||
    target.status?.state === 'Abroad';

  let difficulty: DifficultyLevel = 'MEDIUM';
  let difficultyLabel = 'MEDIUM';
  let estimatedFFMultiplier = 1.0;

  if (isUnavailable) {
    difficulty = 'UNAVAILABLE';
    difficultyLabel = target.status?.state?.toUpperCase() || 'UNAVAILABLE';
    estimatedFFMultiplier = 0;
  } else if (statRatio < 0.35) {
    difficulty = 'VERY_EASY';
    difficultyLabel = 'VERY EASY (100% Win)';
    estimatedFFMultiplier = 1.0 + (1 - statRatio) * 0.3; // 1.0x - 1.2x
  } else if (statRatio >= 0.35 && statRatio < 0.75) {
    difficulty = 'EASY';
    difficultyLabel = 'EASY (High Respect)';
    estimatedFFMultiplier = 1.4 + (0.75 - statRatio) * 1.5; // 1.4x - 2.0x
  } else if (statRatio >= 0.75 && statRatio < 1.25) {
    difficulty = 'MEDIUM';
    difficultyLabel = 'FAIR FIGHT (2.0x - 3.0x)';
    estimatedFFMultiplier = 2.0 + (1.25 - statRatio) * 2.0; // 2.0x - 3.0x
  } else if (statRatio >= 1.25 && statRatio < 2.0) {
    difficulty = 'HARD';
    difficultyLabel = 'HARD (Risk Defeat)';
    estimatedFFMultiplier = 3.0;
  } else {
    difficulty = 'DANGER';
    difficultyLabel = 'DANGER (Outmatched)';
    estimatedFFMultiplier = 3.0;
  }

  // Confidence heuristic based on available profile metrics
  let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
  if (xantaken > 0 || refills > 0 || totalworkingstats > 0) {
    confidence = 'High';
  } else if (level < 10) {
    confidence = 'Low';
  }

  return {
    estimatedTotalStats: rawEstimate,
    minEstStats,
    maxEstStats,
    difficulty,
    difficultyLabel,
    statRatio,
    estimatedFFMultiplier: Number(estimatedFFMultiplier.toFixed(1)),
    confidence,
    breakdown: {
      baseLevelStats,
      xanaxBoost,
      refillBoost,
      seBoost,
      workingStatsBoost,
      ageFactor,
    },
  };
}

/**
 * Formats large numbers compactly (e.g. 1.25M, 450k)
 */
export function formatStatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

/**
 * Returns Tailwind CSS color classes for FFScouter difficulty levels
 */
export function getDifficultyBadgeStyle(difficulty: DifficultyLevel): {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
} {
  switch (difficulty) {
    case 'VERY_EASY':
      return {
        bg: 'bg-emerald-950/40',
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    case 'EASY':
      return {
        bg: 'bg-teal-950/40',
        text: 'text-teal-300',
        border: 'border-teal-500/40',
        badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      };
    case 'MEDIUM':
      return {
        bg: 'bg-amber-950/40',
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    case 'HARD':
      return {
        bg: 'bg-orange-950/40',
        text: 'text-orange-400',
        border: 'border-orange-500/40',
        badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      };
    case 'DANGER':
      return {
        bg: 'bg-rose-950/40',
        text: 'text-rose-400',
        border: 'border-rose-500/40',
        badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      };
    case 'UNAVAILABLE':
    default:
      return {
        bg: 'bg-slate-900/60',
        text: 'text-slate-400',
        border: 'border-slate-800',
        badgeBg: 'bg-slate-800 text-slate-400 border-slate-700',
      };
  }
}

/**
 * Calculates days offline from last action timestamp or relative string
 */
export function calculateDaysOffline(lastAction: { timestamp: number; relative: string }): number {
  if (lastAction.timestamp && lastAction.timestamp > 0) {
    const diffSec = Math.floor(Date.now() / 1000) - lastAction.timestamp;
    return Math.max(0, Math.floor(diffSec / 86400));
  }

  // Parse relative string like "42 days ago", "3 months ago", "2 years ago"
  const rel = lastAction.relative.toLowerCase();
  if (rel.includes('year')) {
    const years = parseInt(rel, 10) || 1;
    return years * 365;
  }
  if (rel.includes('month')) {
    const months = parseInt(rel, 10) || 1;
    return months * 30;
  }
  if (rel.includes('day')) {
    return parseInt(rel, 10) || 1;
  }
  return 0;
}

/**
 * Known Torn travel destinations
 */
export const TORN_COUNTRIES = [
  'Argentina',
  'Canada',
  'Cayman Islands',
  'China',
  'Hawaii',
  'Japan',
  'Mexico',
  'South Africa',
  'Switzerland',
  'UAE',
  'United Kingdom',
] as const;

/**
 * Extracts country/location from Torn user profile data or status
 */
export function extractTargetCountry(user: any): string {
  if (!user) return 'Torn';

  // Direct country field if already mapped
  if (typeof user.country === 'string' && user.country.trim()) {
    return user.country.trim();
  }

  // Check travel selection destination
  if (user.travel && typeof user.travel.destination === 'string' && user.travel.destination.trim()) {
    return user.travel.destination.trim();
  }

  const desc = (user.status?.description || '').toLowerCase();
  const details = (user.status?.details || '').trim();
  const state = user.status?.state || '';

  // Check known Torn destinations
  const destinations: { name: string; regex: RegExp }[] = [
    { name: 'Argentina', regex: /argentina/i },
    { name: 'Canada', regex: /canada/i },
    { name: 'Cayman Islands', regex: /cayman/i },
    { name: 'China', regex: /china/i },
    { name: 'Hawaii', regex: /hawaii/i },
    { name: 'Japan', regex: /japan/i },
    { name: 'Mexico', regex: /mexico/i },
    { name: 'South Africa', regex: /south africa/i },
    { name: 'Switzerland', regex: /switzerland/i },
    { name: 'UAE', regex: /uae|united arab emirates|emirates/i },
    { name: 'United Kingdom', regex: /united kingdom|u\.k\.|uk/i },
  ];

  for (const dest of destinations) {
    if (dest.regex.test(details) || dest.regex.test(desc)) {
      return dest.name;
    }
  }

  // If status details has a non-empty string and state is Abroad
  if (state === 'Abroad' && details && !details.toLowerCase().includes('hospital') && !details.toLowerCase().includes('jail')) {
    return details;
  }

  // If description starts with "In " and is not "In hospital" / "In jail"
  if (desc.startsWith('in ') && !desc.includes('hospital') && !desc.includes('jail')) {
    const rawName = user.status.description.substring(3).trim();
    if (rawName && rawName.toLowerCase() !== 'torn') {
      return rawName;
    }
  }

  return 'Torn';
}

/**
 * Returns a flag emoji for a given Torn country
 */
export function getCountryFlag(country: string): string {
  if (!country) return '🏙️';
  const c = country.toLowerCase();
  if (c.includes('argentina')) return '🇦🇷';
  if (c.includes('canada')) return '🇨🇦';
  if (c.includes('cayman')) return '🇰🇾';
  if (c.includes('china')) return '🇨🇳';
  if (c.includes('hawaii')) return '🌺';
  if (c.includes('japan')) return '🇯🇵';
  if (c.includes('mexico')) return '🇲🇽';
  if (c.includes('south africa')) return '🇿🇦';
  if (c.includes('switzerland')) return '🇨🇭';
  if (c.includes('uae') || c.includes('emirates')) return '🇦🇪';
  if (c.includes('united kingdom') || c === 'uk') return '🇬🇧';
  return '🏙️'; // Torn City
}

/**
 * Checks if a target is abroad / outside Torn
 */
export function isAbroadTarget(country: string, state?: string): boolean {
  if (state === 'Abroad' || state === 'Traveling') return true;
  if (!country) return false;
  return country.toLowerCase() !== 'torn';
}

/**
 * Calculates XP required for next level and current XP progress percentage
 * based on Torn level progression mechanics and user profile stats.
 */
export function calculatePlayerXpProgress(
  level: number,
  personalstats?: any,
  rawApiData?: any
): {
  currentXp: number;
  xpRequired: number;
  levelProgress: number;
} {
  const safeLevel = Math.max(1, Math.min(100, Number(level) || 1));

  // Max level in Torn is 100
  if (safeLevel >= 100) {
    const maxReq = Math.round(150 * Math.pow(100, 2.2) + 1200);
    return {
      currentXp: maxReq,
      xpRequired: maxReq,
      levelProgress: 100,
    };
  }

  // Torn XP needed for next level: standard exponential progression formula
  // e.g. Lvl 1: ~1,350 XP; Lvl 15: ~59,880 XP; Lvl 50: ~812,000 XP
  const xpRequired = Math.round(150 * Math.pow(safeLevel, 2.2) + 1200);

  // If Torn API returns an explicit XP / exp / level_progress field:
  const rawXp = rawApiData?.xp ?? rawApiData?.exp ?? rawApiData?.experience ?? rawApiData?.current_xp;
  if (typeof rawXp === 'number' && !isNaN(rawXp) && rawXp > 0) {
    // If raw cumulative XP is provided, get progress within current level bracket
    const currentInLevel = rawXp > xpRequired ? (rawXp % xpRequired) : rawXp;
    const progress = Math.min(100, Math.max(0, Math.round((currentInLevel / xpRequired) * 100)));
    return {
      currentXp: Math.round(currentInLevel),
      xpRequired,
      levelProgress: progress,
    };
  }

  // If level_progress percentage is returned directly
  if (typeof rawApiData?.level_progress === 'number') {
    const pct = Math.min(100, Math.max(0, Math.round(rawApiData.level_progress)));
    const currentXp = Math.round((pct / 100) * xpRequired);
    return {
      currentXp,
      xpRequired,
      levelProgress: pct,
    };
  }

  // Derive estimated XP progress from combat, crimes, and activity:
  const ps = personalstats || {};
  const attackswon = Number(ps.attackswon) || 0;
  const defendswon = Number(ps.defendswon) || 0;
  const totalcrimes = Number(ps.totalcrimes) || 0;
  const useractivity = Number(ps.useractivity) || 0;
  const age = Number(rawApiData?.age) || 50;

  // Level-weighted activity score
  const combatXp = attackswon * 220 + defendswon * 80;
  const crimeXp = totalcrimes * 35;
  const activityXp = Math.round((useractivity / 120) + (age * 15));
  const estimatedTotalActivity = combatXp + crimeXp + activityXp;

  // Modulo within current level bracket with a deterministic seed for smooth display
  const bracketProgress = (estimatedTotalActivity % xpRequired);
  const minProgress = Math.min(xpRequired * 0.95, Math.max(xpRequired * 0.12, bracketProgress));
  const levelProgress = Math.min(99, Math.max(1, Math.round((minProgress / xpRequired) * 100)));

  return {
    currentXp: Math.round(minProgress),
    xpRequired,
    levelProgress,
  };
}

