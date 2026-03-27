import type { GameItem, GameCategory, LeaderboardUser } from '../types';

/* ─── Game Categories ─────────────────────────────────── */
export const GAME_CATEGORIES: GameCategory[] = [
  {
    id: 'arcade',
    labelKey: 'arcade',
    iconName: 'Zap',
    gradient: 'from-yellow-500 to-orange-400',
    games: [
      {
        id: 'radix-invaders',
        titleKey: 'space_invaders',
        categoryId: 'arcade',
        embedUrl: 'https://freeinvaders.org/',
        thumbnailGradient: 'from-green-500 to-emerald-700',
        accentRgb: '34,197,94',
        featured: true,
      },
      {
        id: 'super-pang',
        titleKey: 'super_pang',
        categoryId: 'arcade',
        embedUrl: '',
        thumbnailGradient: 'from-blue-500 to-cyan-600',
        accentRgb: '59,130,246',
        featured: true,
      },
      {
        id: 'arkanoid',
        titleKey: 'arkanoid',
        categoryId: 'arcade',
        embedUrl: 'https://www.gameflare.com/embed/arkanoid/',
        thumbnailGradient: 'from-purple-500 to-violet-700',
        accentRgb: '168,85,247',
        featured: true,
      },
      {
        id: 'pac-man',
        titleKey: 'pac_man',
        categoryId: 'arcade',
        embedUrl: '',
        thumbnailGradient: 'from-yellow-400 to-amber-500',
        accentRgb: '251,191,36',
      },
    ],
  },
  {
    id: 'plataformas',
    labelKey: 'platforms',
    iconName: 'Layers',
    gradient: 'from-green-500 to-teal-400',
    games: [
      {
        id: 'super-mario-clone',
        titleKey: 'super_jump',
        categoryId: 'plataformas',
        embedUrl: '',
        thumbnailGradient: 'from-red-500 to-orange-600',
        accentRgb: '239,68,68',
      },
      {
        id: 'dino-run',
        titleKey: 'dino_run',
        categoryId: 'plataformas',
        embedUrl: '',
        thumbnailGradient: 'from-stone-500 to-gray-600',
        accentRgb: '120,113,108',
      },
    ],
  },
  {
    id: 'rol',
    labelKey: 'rpg',
    iconName: 'Sword',
    gradient: 'from-rose-500 to-pink-600',
    games: [
      {
        id: 'dungeon-quest',
        titleKey: 'dungeon_quest',
        categoryId: 'rol',
        embedUrl: '',
        thumbnailGradient: 'from-rose-600 to-red-800',
        accentRgb: '225,29,72',
      },
      {
        id: 'pixel-rpg',
        titleKey: 'pixel_rpg',
        categoryId: 'rol',
        embedUrl: '',
        thumbnailGradient: 'from-indigo-500 to-blue-700',
        accentRgb: '99,102,241',
      },
    ],
  },
  {
    id: 'estrategia',
    labelKey: 'strategy',
    iconName: 'Brain',
    gradient: 'from-blue-600 to-indigo-500',
    games: [
      {
        id: 'ajedrez',
        titleKey: 'chess',
        categoryId: 'estrategia',
        embedUrl: 'https://www.chess.com/play/computer',
        thumbnailGradient: 'from-slate-600 to-gray-800',
        accentRgb: '100,116,139',
        featured: true,
      },
      {
        id: 'tower-defense',
        titleKey: 'tower_defense',
        categoryId: 'estrategia',
        embedUrl: '',
        thumbnailGradient: 'from-cyan-500 to-blue-600',
        accentRgb: '6,182,212',
      },
    ],
  },
  {
    id: 'puzzle',
    labelKey: 'puzzle',
    iconName: 'Puzzle',
    gradient: 'from-fuchsia-500 to-pink-500',
    games: [
      {
        id: 'tetris-clone',
        titleKey: 'tetris',
        categoryId: 'puzzle',
        embedUrl: 'https://tetris.com/play-tetris',
        thumbnailGradient: 'from-fuchsia-500 to-violet-600',
        accentRgb: '217,70,239',
      },
      {
        id: 'match-three',
        titleKey: 'match_three',
        categoryId: 'puzzle',
        embedUrl: '',
        thumbnailGradient: 'from-pink-400 to-rose-500',
        accentRgb: '244,114,182',
      },
    ],
  },
  {
    id: 'deportes',
    labelKey: 'sports',
    iconName: 'Trophy',
    gradient: 'from-amber-500 to-orange-500',
    games: [
      {
        id: 'football',
        titleKey: 'football',
        categoryId: 'deportes',
        embedUrl: '',
        thumbnailGradient: 'from-green-600 to-emerald-800',
        accentRgb: '22,163,74',
      },
      {
        id: 'basketball',
        titleKey: 'basketball',
        categoryId: 'deportes',
        embedUrl: '',
        thumbnailGradient: 'from-orange-500 to-red-600',
        accentRgb: '249,115,22',
      },
    ],
  },
  {
    id: 'carreras',
    labelKey: 'racing',
    iconName: 'Car',
    gradient: 'from-red-500 to-orange-400',
    games: [
      {
        id: 'pixel-racer',
        titleKey: 'pixel_racer',
        categoryId: 'carreras',
        embedUrl: '',
        thumbnailGradient: 'from-red-600 to-rose-800',
        accentRgb: '220,38,38',
      },
      {
        id: 'speed-moto',
        titleKey: 'speed_moto',
        categoryId: 'carreras',
        embedUrl: '',
        thumbnailGradient: 'from-orange-400 to-yellow-500',
        accentRgb: '251,146,60',
      },
    ],
  },
  {
    id: 'aventura',
    labelKey: 'adventure',
    iconName: 'Map',
    gradient: 'from-teal-500 to-cyan-400',
    games: [
      {
        id: 'pirate-quest',
        titleKey: 'pirate_quest',
        categoryId: 'aventura',
        embedUrl: '',
        thumbnailGradient: 'from-teal-600 to-cyan-800',
        accentRgb: '20,184,166',
      },
      {
        id: 'space-explorer',
        titleKey: 'space_explorer',
        categoryId: 'aventura',
        embedUrl: '',
        thumbnailGradient: 'from-violet-600 to-purple-800',
        accentRgb: '124,58,237',
      },
    ],
  },
];

export const FEATURED_GAME_IDS = ['radix-invaders', 'super-pang', 'arkanoid', 'ajedrez'];

export const getAllGames = (): GameItem[] =>
  GAME_CATEGORIES.flatMap(cat => cat.games);

export const GAMES: GameItem[] = GAME_CATEGORIES.flatMap(cat => cat.games);

export const getGameById = (id: string): GameItem | undefined =>
  getAllGames().find(g => g.id === id);

export const getCategoryById = (id: string): GameCategory | undefined =>
  GAME_CATEGORIES.find(c => c.id === id);

/* ─── Mock leaderboard ─────────────────────────────────── */
export const MOCK_LEADERBOARD: LeaderboardUser[] = [
  { rank: 1, username: 'CryptoAce', score: 98_450, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoAce' },
  { rank: 2, username: 'XrdMaster', score: 87_300, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=XrdMaster' },
  { rank: 3, username: 'NebulaByte', score: 75_890, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NebulaByte' },
  { rank: 4, username: 'ShadowPixel', score: 64_210, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ShadowPixel' },
  { rank: 5, username: 'RadixHunter', score: 58_770, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=RadixHunter' },
  { rank: 6, username: 'StarForge', score: 52_300, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=StarForge' },
  { rank: 7, username: 'CosmicWave', score: 47_900, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CosmicWave' },
  { rank: 8, username: 'NeonViper', score: 43_120, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NeonViper' },
  { rank: 9, username: 'QuantumBolt', score: 38_560, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=QuantumBolt' },
  { rank: 10, username: 'BitBlaster', score: 34_900, avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BitBlaster' },
];
