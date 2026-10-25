import { InactiveTarget } from '../types/torn';
import { calculateFFScouterEstimate, calculateDaysOffline } from '../utils/ffscouter';

// Raw preset data for inactive targets
const rawPresets = [
  {
    player_id: 182763,
    name: 'Ghost_Walker',
    level: 32,
    gender: 'Male',
    age: 1840,
    rank: 'Veteran Civilian',
    faction: {
      faction_id: 9812,
      faction_name: 'Forgotten Legion',
      position: 'Member',
      days_in_faction: 420,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 95, // 95 days ago (~3 months)
      relative: '95 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 145,
      xantaken: 80,
      refills: 12,
      statenhancers: 0,
      totalworkingstats: 14200,
      useractivity: 1800,
      networth: 45000000,
      totalcrimes: 1200,
    },
  },
  {
    player_id: 204819,
    name: 'Slayer_Zero',
    level: 28,
    gender: 'Male',
    age: 1250,
    rank: 'Above Average',
    faction: {
      faction_id: 9812,
      faction_name: 'Forgotten Legion',
      position: 'Member',
      days_in_faction: 310,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 420, // 420 days ago (>1 year)
      relative: '420 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 92,
      xantaken: 45,
      refills: 5,
      statenhancers: 0,
      totalworkingstats: 8900,
      useractivity: 950,
      networth: 18000000,
      totalcrimes: 850,
    },
  },
  {
    player_id: 159203,
    name: 'Viper_Dormant',
    level: 45,
    gender: 'Female',
    age: 2410,
    rank: 'Highly Influential',
    faction: {
      faction_id: 1042,
      faction_name: 'Dormant Syndicate',
      position: 'Co-Leader',
      days_in_faction: 1100,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 180, // 6 months ago
      relative: '180 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 480,
      xantaken: 320,
      refills: 45,
      statenhancers: 0,
      totalworkingstats: 38000,
      useractivity: 4500,
      networth: 180000000,
      totalcrimes: 3400,
    },
  },
  {
    player_id: 291048,
    name: 'Shadow_Rider',
    level: 19,
    gender: 'Male',
    age: 720,
    rank: 'Novice',
    faction: {
      faction_id: 4501,
      faction_name: 'Static Syndicate',
      position: 'Recruit',
      days_in_faction: 180,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 45, // 45 days ago
      relative: '45 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 34,
      xantaken: 12,
      refills: 2,
      statenhancers: 0,
      totalworkingstats: 3200,
      useractivity: 410,
      networth: 5000000,
      totalcrimes: 310,
    },
  },
  {
    player_id: 304912,
    name: 'Iron_Titan_Inact',
    level: 58,
    gender: 'Male',
    age: 3100,
    rank: 'Mastermind',
    faction: {
      faction_id: 1042,
      faction_name: 'Dormant Syndicate',
      position: 'Member',
      days_in_faction: 1500,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 650, // 650 days ago
      relative: '650 days ago',
    },
    status: {
      description: 'In hospital for 42 minutes',
      details: '',
      state: 'Hospital' as const,
      until: Date.now() + 2500000,
    },
    personalstats: {
      attackswon: 1250,
      xantaken: 980,
      refills: 140,
      statenhancers: 1,
      totalworkingstats: 85000,
      useractivity: 12000,
      networth: 850000000,
      totalcrimes: 8900,
    },
  },
  {
    player_id: 147890,
    name: 'Night_Raven',
    level: 24,
    gender: 'Female',
    age: 1400,
    rank: 'Competent',
    faction: {
      faction_id: 9812,
      faction_name: 'Forgotten Legion',
      position: 'Member',
      days_in_faction: 500,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 210, // 210 days ago
      relative: '210 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 65,
      xantaken: 28,
      refills: 4,
      statenhancers: 0,
      totalworkingstats: 6400,
      useractivity: 800,
      networth: 12000000,
      totalcrimes: 520,
    },
  },
  {
    player_id: 219084,
    name: 'Silent_Spectre',
    level: 38,
    gender: 'Male',
    age: 1950,
    rank: 'Seasoned Fighter',
    faction: {
      faction_id: 3320,
      faction_name: 'Old Guard Reborn',
      position: 'Member',
      days_in_faction: 700,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 330, // 330 days ago
      relative: '330 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 210,
      xantaken: 140,
      refills: 18,
      statenhancers: 0,
      totalworkingstats: 22000,
      useractivity: 2800,
      networth: 62000000,
      totalcrimes: 2100,
    },
  },
  {
    player_id: 112894,
    name: 'Alpha_K9_Old',
    level: 16,
    gender: 'Male',
    age: 510,
    rank: 'Beginner',
    faction: {
      faction_id: 4501,
      faction_name: 'Static Syndicate',
      position: 'Member',
      days_in_faction: 120,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 60, // 60 days ago (~2 months)
      relative: '60 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 18,
      xantaken: 6,
      refills: 0,
      statenhancers: 0,
      totalworkingstats: 2100,
      useractivity: 220,
      networth: 2800000,
      totalcrimes: 180,
    },
  },
  {
    player_id: 334510,
    name: 'Oblivion_Ghost',
    level: 52,
    gender: 'Female',
    age: 2890,
    rank: 'Tactician',
    faction: {
      faction_id: 3320,
      faction_name: 'Old Guard Reborn',
      position: 'Member',
      days_in_faction: 950,
    },
    last_action: {
      status: 'Offline' as const,
      timestamp: Math.floor(Date.now() / 1000) - 86400 * 500, // 500 days ago
      relative: '500 days ago',
    },
    status: {
      description: 'Okay',
      details: '',
      state: 'Okay' as const,
      until: 0,
    },
    personalstats: {
      attackswon: 890,
      xantaken: 640,
      refills: 90,
      statenhancers: 0,
      totalworkingstats: 62000,
      useractivity: 9100,
      networth: 420000000,
      totalcrimes: 6400,
    },
  },
];

export function getInactivePresets(playerStats: any): InactiveTarget[] {
  return rawPresets.map((raw) => {
    const daysOffline = calculateDaysOffline(raw.last_action);
    const ffScouter = calculateFFScouterEstimate(raw, playerStats);

    return {
      ...raw,
      daysOffline,
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
];
