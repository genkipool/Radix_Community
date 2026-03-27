/**
 * features/dapps/types/data.types.ts
 * Core data models for the DApps feature.
 */

export interface DApp {
  id: number;
  name: string;
  description: string;
  logoUrl: string;
  websiteUrl: string;
  tags: string[];
  likes: number;
  dislikes: number;
  isSponsored?: boolean;
  /** Added by user at runtime */
  isUserAdded?: boolean;
}
