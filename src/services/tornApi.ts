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
 * Fetches the authenticated user's profile and battle stats using their official Torn API key.
 */
export async function fetchSelfProfile(apiKey: string): Promise<{ profile: PlayerProfile | null; battleStats: BattleStats | null; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return {
      profile: null,
      battleStats: null,
      error: 'No API Key set. Please enter your Torn API Key to fetch your live player name, level, and battle stats.',
    };
  }

  try {
    const res = await fetch(`/api/torn/user?key=${encodeURIComponent(apiKey.trim())}`);
    const data = await res.json();

    if (data.error) {
      const msg = typeof data.error === 'string' ? data.error : (data.error.error || 'Invalid API Key or Torn API Error');
      return {
        profile: null,
        battleStats: null,
        error: msg,
      };
    }

    const battleStats: BattleStats = {
      strength: data.strength || 15000,
      defense: data.defense || 15000,
      speed: data.speed || 15000,
      dexterity: data.dexterity || 15000,
      total: (data.strength || 15000) + (data.defense || 15000) + (data.speed || 15000) + (data.dexterity || 15000),
    };

    const profile: PlayerProfile = {
      player_id: data.player_id || 0,
      name: data.name || (data.player_id ? `TornUser_${data.player_id}` : 'Torn Player'),
      level: data.level || 1,
      gender: data.gender || 'Unknown',
      age: data.age || 1,
      rank: data.rank || 'Citizen',
      faction: data.faction,
      last_action: data.last_action || { status: 'Online', timestamp: Math.floor(Date.now() / 1000), relative: 'Online' },
      status: data.status || { description: 'Okay', details: '', state: 'Okay', until: 0 },
      battleStats,
      personalstats: data.personalstats,
    };

    return { profile, battleStats };
  } catch (err: any) {
    console.warn('API Key validation error:', err.message);
    return {
      profile: null,
      battleStats: null,
      error: err.message || 'Failed to connect to Torn API. Please check your key.',
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
