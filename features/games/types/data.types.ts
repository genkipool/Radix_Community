/**
 * Core data models for the Games feature.
 */

export interface GameItem {
  id: string;
  titleKey: string;
  categoryId: string;
  embedUrl?: string;
  thumbnailGradient: string;
  accentRgb: string;
  featured?: boolean;
}

export interface GameCategory {
  id: string;
  labelKey: string;
  iconName: string;
  gradient: string;
  games: GameItem[];
}

export interface LeaderboardUser {
  rank: number;
  username: string;
  score: number;
  avatarUrl: string;
}

export interface PrizeRow {
  rank: string;
  players: number;
  prizeUSD: number;
  totalUSD: number;
  pct: string;
}

export type Currency = 'usd' | 'eur' | 'xrd';

export interface XRDPrice {
  usd: number;
  eur: number;
}
