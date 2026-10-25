import { InactiveTarget } from '../types/torn';
import { calculateFFScouterEstimate, calculateDaysOffline } from '../utils/ffscouter';

// Comprehensive catalog of inactive targets across all level tiers (Lvl 15 to Lvl 100)
const rawPresets = [
  // Tier 1: Level 15-30
  { player_id: 182763, name: 'Ghost_Walker', level: 32, age: 1840, rank: 'Veteran Civilian', fac: 'Forgotten Legion', fid: 9812, daysAgo: 95, xan: 80, refills: 12, work: 14200 },
  { player_id: 204819, name: 'Slayer_Zero', level: 28, age: 1250, rank: 'Above Average', fac: 'Forgotten Legion', fid: 9812, daysAgo: 420, xan: 45, refills: 5, work: 8900 },
  { player_id: 291048, name: 'Shadow_Rider', level: 19, age: 720, rank: 'Novice', fac: 'Static Syndicate', fid: 4501, daysAgo: 45, xan: 12, refills: 2, work: 3200 },
  { player_id: 147890, name: 'Night_Raven', level: 24, age: 1400, rank: 'Competent', fac: 'Forgotten Legion', fid: 9812, daysAgo: 210, xan: 28, refills: 4, work: 6400 },
  { player_id: 112894, name: 'Alpha_K9_Old', level: 16, age: 510, rank: 'Beginner', fac: 'Static Syndicate', fid: 4501, daysAgo: 60, xan: 6, refills: 0, work: 2100 },
  { player_id: 284102, name: 'Cobalt_Viper', level: 22, age: 980, rank: 'Civilian', fac: 'Forgotten Legion', fid: 9812, daysAgo: 110, xan: 18, refills: 3, work: 4500 },
  { player_id: 192834, name: 'Static_Storm', level: 27, age: 1150, rank: 'Above Average', fac: 'Static Syndicate', fid: 4501, daysAgo: 180, xan: 38, refills: 6, work: 7800 },
  { player_id: 245109, name: 'Ashen_Blade', level: 15, age: 410, rank: 'Novice', fac: 'Static Syndicate', fid: 4501, daysAgo: 38, xan: 4, refills: 0, work: 1800 },

  // Tier 2: Level 30-50
  { player_id: 159203, name: 'Viper_Dormant', level: 45, age: 2410, rank: 'Highly Influential', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 180, xan: 320, refills: 45, work: 38000 },
  { player_id: 219084, name: 'Silent_Spectre', level: 38, age: 1950, rank: 'Seasoned Fighter', fac: 'Old Guard Reborn', fid: 3320, daysAgo: 330, xan: 140, refills: 18, work: 22000 },
  { player_id: 178239, name: 'Dormant_King', level: 48, age: 2600, rank: 'Overlord', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 290, xan: 410, refills: 60, work: 48000 },
  { player_id: 203918, name: 'Void_Sentinel', level: 41, age: 2100, rank: 'Chief Operative', fac: 'Old Guard Reborn', fid: 3320, daysAgo: 140, xan: 220, refills: 30, work: 31000 },
  { player_id: 165492, name: 'Crimson_Phantom', level: 36, age: 1780, rank: 'Experienced', fac: 'Forgotten Legion', fid: 9812, daysAgo: 220, xan: 110, refills: 15, work: 19500 },
  { player_id: 239014, name: 'Wraith_Inact', level: 49, age: 2750, rank: 'Commander', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 510, xan: 480, refills: 70, work: 52000 },
  { player_id: 198273, name: 'Rogue_Echo', level: 33, age: 1500, rank: 'Seasoned', fac: 'Old Guard Reborn', fid: 3320, daysAgo: 85, xan: 95, refills: 10, work: 16000 },
  { player_id: 274819, name: 'Grave_Digger', level: 42, age: 2250, rank: 'Tactician', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 360, xan: 260, refills: 35, work: 34000 },

  // Tier 3: Level 50-75 (Matches Level 50-100 searches!)
  { player_id: 304912, name: 'Iron_Titan_Inact', level: 58, age: 3100, rank: 'Mastermind', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 650, xan: 980, refills: 140, work: 85000 },
  { player_id: 334510, name: 'Oblivion_Ghost', level: 52, age: 2890, rank: 'Tactician', fac: 'Old Guard Reborn', fid: 3320, daysAgo: 500, xan: 640, refills: 90, work: 62000 },
  { player_id: 118273, name: 'Vanguard_Old', level: 65, age: 3600, rank: 'War General', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 720, xan: 1450, refills: 210, work: 110000 },
  { player_id: 139281, name: 'Phoenix_Dormant', level: 71, age: 4100, rank: 'High Warlord', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 890, xan: 1980, refills: 320, work: 145000 },
  { player_id: 283910, name: 'Apex_Predator_Inact', level: 55, age: 2950, rank: 'Brigadier', fac: 'Old Guard Reborn', fid: 3320, daysAgo: 410, xan: 820, refills: 110, work: 72000 },
  { player_id: 192039, name: 'Shadow_Legion_55', level: 50, age: 2700, rank: 'Commander', fac: 'Dormant Syndicate', fid: 1042, daysAgo: 190, xan: 540, refills: 75, work: 55000 },
  { player_id: 228391, name: 'Nuclear_Ghost_62', level: 62, age: 3400, rank: 'Chief Strategist', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 580, xan: 1200, refills: 180, work: 98000 },
  { player_id: 310294, name: 'Valiant_Hero_68', level: 68, age: 3850, rank: 'Warlord', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 620, xan: 1650, refills: 250, work: 125000 },
  { player_id: 149203, name: 'Spectral_Knight_74', level: 74, age: 4300, rank: 'Supreme Commander', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 1100, xan: 2200, refills: 380, work: 160000 },

  // Tier 4: Level 75-100 (Top Tier Inactive Veterans)
  { player_id: 102938, name: 'Ares_God_Of_War', level: 85, age: 4900, rank: 'Legendary Warlord', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 940, xan: 3200, refills: 520, work: 210000 },
  { player_id: 105829, name: 'Titan_Kronos', level: 92, age: 5400, rank: 'Immortal Conqueror', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 1250, xan: 4500, refills: 750, work: 290000 },
  { player_id: 109283, name: 'Overlord_Omega', level: 78, age: 4500, rank: 'Grand Marshal', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 480, xan: 2600, refills: 420, work: 180000 },
  { player_id: 110293, name: 'Zeus_Thunder', level: 96, age: 5800, rank: 'Absolute Sovereign', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 1400, xan: 5200, refills: 890, work: 340000 },
  { player_id: 114829, name: 'Nebula_King', level: 82, age: 4750, rank: 'Vanguard Titan', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 820, xan: 2900, refills: 480, work: 195000 },
  { player_id: 120392, name: 'Hades_Underworld', level: 100, age: 6200, rank: 'Emperor of Torn', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 1600, xan: 6500, refills: 1100, work: 420000 },
  { player_id: 210293, name: 'Eclipse_Dormant_88', level: 88, age: 5100, rank: 'High Conqueror', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 710, xan: 3800, refills: 610, work: 240000 },
  { player_id: 259301, name: 'Valhalla_Warrior_95', level: 95, age: 5700, rank: 'Supreme Legend', fac: 'Hall of Fame Inactives', fid: 8800, daysAgo: 1050, xan: 4900, refills: 820, work: 310000 },
];

export function getInactivePresets(playerStats: any): InactiveTarget[] {
  return rawPresets.map((raw) => {
    const timestamp = Math.floor(Date.now() / 1000) - 86400 * raw.daysAgo;
    const lastAction = {
      status: 'Offline' as const,
      timestamp,
      relative: `${raw.daysAgo} days ago`,
    };

    const profileData = {
      player_id: raw.player_id,
      name: raw.name,
      level: raw.level,
      gender: 'Male',
      age: raw.age,
      rank: raw.rank,
      faction: {
        faction_id: raw.fid,
        faction_name: raw.fac,
        position: 'Member',
        days_in_faction: Math.round(raw.age * 0.4),
      },
      last_action: lastAction,
      status: {
        description: 'Okay',
        details: '',
        state: 'Okay' as const,
        until: 0,
      },
      personalstats: {
        attackswon: Math.round(raw.xan * 1.5),
        xantaken: raw.xan,
        refills: raw.refills,
        statenhancers: raw.level > 80 ? 2 : 0,
        totalworkingstats: raw.work,
        useractivity: Math.round(raw.age * 2.5),
        networth: raw.level * 25000000,
        totalcrimes: raw.level * 120,
      },
    };

    const ffScouter = calculateFFScouterEstimate(profileData, playerStats);

    return {
      ...profileData,
      daysOffline: raw.daysAgo,
      ffScouter,
      attackUrl: `https://www.torn.com/page.php?sid=attack&user2ID=${raw.player_id}`,
      profileUrl: `https://www.torn.com/profiles.php?XID=${raw.player_id}`,
    };
  });
}

export const PRESET_INACTIVE_FACTIONS = [
  { id: 9812, name: 'Forgotten Legion', membersCount: 38, avgOfflineDays: 140 },
  { id: 1042, name: 'Dormant Syndicate', membersCount: 52, avgOfflineDays: 320 },
  { id: 4501, name: 'Static Syndicate', membersCount: 24, avgOfflineDays: 75 },
  { id: 3320, name: 'Old Guard Reborn', membersCount: 65, avgOfflineDays: 410 },
  { id: 8800, name: 'Hall of Fame Inactives', membersCount: 120, avgOfflineDays: 850 },
];
