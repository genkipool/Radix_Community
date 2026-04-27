import commonEn from './locales/common/en.json';
import commonEs from './locales/common/es.json';

import academyEn from '@/features/academy/locales/en.json';
import academyEs from '@/features/academy/locales/es.json';

import blogEn from '@/features/blog/locales/en.json';
import blogEs from '@/features/blog/locales/es.json';

import communityEn from '@/features/community/locales/en.json';
import communityEs from '@/features/community/locales/es.json';

import dappsEn from '@/features/dapps/locales/en.json';
import dappsEs from '@/features/dapps/locales/es.json';

import dashboardEn from '@/features/dashboard/locales/en.json';
import dashboardEs from '@/features/dashboard/locales/es.json';

import dashboardStakingEn from '@/features/dashboard/staking/locales/en.json';
import dashboardStakingEs from '@/features/dashboard/staking/locales/es.json';

import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';
import dashboardExploradorEs from '@/features/dashboard/explorador/locales/es.json';

import docsEn from '@/features/docs/locales/en.json';
import docsEs from '@/features/docs/locales/es.json';

import forumEn from '@/features/forum/locales/en.json';
import forumEs from '@/features/forum/locales/es.json';

import gamesEn from '@/features/games/locales/en.json';
import gamesEs from '@/features/games/locales/es.json';

import homeEn from '@/features/home/locales/en.json';
import homeEs from '@/features/home/locales/es.json';

import infrastructureEn from '@/features/infrastructure/locales/en.json';
import infrastructureEs from '@/features/infrastructure/locales/es.json';

type TranslationModule = { seo?: Record<string, unknown> } & Record<string, unknown>;

const mergeTranslations = (common: TranslationModule, features: TranslationModule[]) => {
  const result = { ...common };
  features.forEach((feature) => {
    Object.keys(feature).forEach((key) => {
      const existing = result[key];
      const incoming = feature[key];
      // Deep merge objects one level (handles SEO, dashboard, etc.)
      if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing) &&
        incoming &&
        typeof incoming === 'object' &&
        !Array.isArray(incoming)
      ) {
        result[key] = { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) };
      } else {
        result[key] = incoming;
      }
    });
  });
  return result;
};

const en = mergeTranslations(commonEn, [
  academyEn,
  blogEn,
  communityEn,
  dappsEn,
  dashboardEn,
  dashboardStakingEn,
  dashboardExploradorEn,
  docsEn,
  forumEn,
  gamesEn,
  homeEn,
  infrastructureEn,
]);

const es = mergeTranslations(commonEs, [
  academyEs,
  blogEs,
  communityEs,
  dappsEs,
  dashboardEs,
  dashboardStakingEs,
  dashboardExploradorEs,
  docsEs,
  forumEs,
  gamesEs,
  homeEs,
  infrastructureEs,
]);

export type Dictionary = typeof commonEn &
  typeof academyEn &
  typeof blogEn &
  typeof communityEn &
  typeof dappsEn &
  typeof dashboardEn &
  typeof dashboardStakingEn &
  typeof dashboardExploradorEn &
  typeof docsEn &
  typeof forumEn &
  typeof gamesEn &
  typeof homeEn &
  typeof infrastructureEn;

export const translations = {
  en: en as unknown as Dictionary,
  es: es as unknown as Dictionary,
};