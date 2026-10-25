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
    target.status?.state === 'Traveling';

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
