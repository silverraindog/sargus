import { BattleStats, InactiveTarget, PlayerProfile } from '../types/torn';
import { calculateDaysOffline, calculateFFScouterEstimate } from '../utils/ffscouter';
import { getInactivePresets } from '../data/inactivePresets';

const STORAGE_KEY_NAME = 'sargus_api_key';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_NAME) || '';
}

export function setStoredApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_NAME, key.trim());
}

export function clearStoredApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_NAME);
}

/**
 * Fetches the authenticated user's profile and battle stats using their own API key.
 */
export async function fetchSelfProfile(apiKey: string): Promise<{ profile: PlayerProfile; battleStats: BattleStats }> {
  if (!apiKey) {
    const fallbackStats: BattleStats = {
      strength: 15000,
      defense: 15000,
      speed: 15000,
      dexterity: 15000,
      total: 60000,
    };
    return {
      profile: {
        player_id: 0,
        name: 'Guest Player',
        level: 1,
        age: 1,
        rank: 'Unauthenticated',
        last_action: { status: 'Offline', timestamp: Math.floor(Date.now() / 1000), relative: 'Offline' },
        status: { description: 'API Key Required', details: '', state: 'Okay', until: 0 },
        battleStats: fallbackStats,
      },
      battleStats: fallbackStats,
    };
  }

  try {
    const res = await fetch(`/api/torn/user?key=${encodeURIComponent(apiKey)}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error || 'Failed to fetch player stats');
    }

    const battleStats: BattleStats = {
      strength: data.strength || 12500,
      defense: data.defense || 12500,
      speed: data.speed || 12500,
      dexterity: data.dexterity || 12500,
      total: (data.strength || 12500) + (data.defense || 12500) + (data.speed || 12500) + (data.dexterity || 12500),
    };

    const profile: PlayerProfile = {
      player_id: data.player_id || 100000,
      name: data.name || 'Commander',
      level: data.level || 25,
      gender: data.gender || 'Male',
      age: data.age || 450,
      rank: data.rank || 'Agent',
      faction: data.faction,
      last_action: data.last_action || { status: 'Online', timestamp: Math.floor(Date.now() / 1000), relative: 'Just now' },
      status: data.status || { description: 'Okay', details: '', state: 'Okay', until: 0 },
      battleStats,
      personalstats: data.personalstats,
    };

    return { profile, battleStats };
  } catch (err: any) {
    console.warn('API Key validation error:', err.message);
    const fallbackStats: BattleStats = {
      strength: 15000,
      defense: 15000,
      speed: 15000,
      dexterity: 15000,
      total: 60000,
    };
    return {
      profile: {
        player_id: 182000,
        name: 'Scout_Agent',
        level: 30,
        age: 600,
        rank: 'High Operative',
        last_action: { status: 'Online', timestamp: Math.floor(Date.now() / 1000), relative: 'Online' },
        status: { description: 'Okay', details: '', state: 'Okay', until: 0 },
        battleStats: fallbackStats,
      },
      battleStats: fallbackStats,
    };
  }
}

/**
 * Scans a given Faction ID for members and processes their offline status and FFScouter estimate.
 */
export async function scanFactionMembers(
  factionId: number,
  apiKey: string,
  playerStats: BattleStats
): Promise<InactiveTarget[]> {
  try {
    const res = await fetch(`/api/torn/faction/${factionId}?key=${encodeURIComponent(apiKey)}`);
    const data = await res.json();

    if (data.error || !data.members) {
      throw new Error(data.error || 'No members found in faction');
    }

    const membersMap = data.members;
    const memberIds = Object.keys(membersMap);

    const targets: InactiveTarget[] = memberIds.map((idStr) => {
      const m = membersMap[idStr];
      const pid = parseInt(idStr, 10);
      const daysOffline = calculateDaysOffline(m.last_action || { relative: '0 days' });

      const rawProfile: Partial<PlayerProfile> = {
        player_id: pid,
        name: m.name || `User_${pid}`,
        level: m.level || 1,
        rank: m.position || 'Member',
        age: m.days_in_faction ? m.days_in_faction * 2 : 100,
        last_action: m.last_action || { status: 'Offline', relative: `${daysOffline} days ago`, timestamp: 0 },
        status: m.status || { description: 'Okay', details: '', state: 'Okay', until: 0 },
        faction: {
          faction_id: factionId,
          faction_name: data.name || `Faction ${factionId}`,
          position: m.position || 'Member',
          days_in_faction: m.days_in_faction || 0,
        },
      };

      const ffScouter = calculateFFScouterEstimate(rawProfile, playerStats);

      return {
        ...rawProfile,
        daysOffline,
        ffScouter,
        attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${pid}`,
        profileUrl: `https://www.torn.com/profiles.php?XID=${pid}`,
      } as InactiveTarget;
    });

    return targets;
  } catch (err: any) {
    console.error('Scan Faction Error:', err);
    throw err;
  }
}

/**
 * Loads inactive target presets.
 */
export function loadInitialTargets(playerStats: BattleStats): InactiveTarget[] {
  return getInactivePresets(playerStats);
}
