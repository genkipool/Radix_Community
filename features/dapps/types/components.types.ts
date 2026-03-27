/**
 * features/dapps/types/components.types.ts
 * Component prop interfaces for the DApps feature.
 */

import { type Dictionary } from '@/types/i18n';
import { type DApp } from './data.types';

export interface RichDescriptionProps {
  text: string;
  keywords: string[];
  ctaPhrase: string;
  onCtaClick: () => void;
}

export interface PublishModalProps {
  onClose: () => void;
  onPublish: (dapp: Omit<DApp, 'id' | 'likes' | 'dislikes' | 'isUserAdded'>) => void;
  tagLabels: Record<string, string>;
  t: Dictionary;
  setShowUnderConstruction: (show: boolean) => void;
}

export interface DAppCardProps {
  dapp: DApp;
  index: number;
  searchQuery: string;
  liked: boolean;
  disliked: boolean;
  onLike: () => void;
  onDislike: () => void;
  t: Dictionary;
}

export interface DAppsClientProps {
  /** Dictionary resolved server-side (SSG pattern). */
  t: Dictionary;
  /** Initial DApp catalogue pre-rendered by the server. */
  initialDapps: DApp[];
}
