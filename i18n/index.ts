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

export const mergeTranslations = (common: TranslationModule, features: TranslationModule[]) => {
  const isObject = (item: unknown): item is Record<string, unknown> => {
    return !!item && typeof item === 'object' && !Array.isArray(item);
  };

  const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = deepMerge(
              target[key] as Record<string, unknown>,
              source[key] as Record<string, unknown>
            );
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  };

  let result = { ...common } as Record<string, unknown>;
  features.forEach((feature) => {
    result = deepMerge(result, feature as Record<string, unknown>);
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

export type FeatureKey =
  | 'academy' | 'blog' | 'community' | 'dapps' | 'dashboard'
  | 'dashboardStaking' | 'dashboardExplorador' | 'docs' | 'forum'
  | 'games' | 'home' | 'infrastructure';

const featureLoaders: Record<'en' | 'es', Record<FeatureKey, () => Promise<{ default: Record<string, unknown> }>>> = {
  en: {
    academy: () => import('@/features/academy/locales/en.json'),
    blog: () => import('@/features/blog/locales/en.json'),
    community: () => import('@/features/community/locales/en.json'),
    dapps: () => import('@/features/dapps/locales/en.json'),
    dashboard: () => import('@/features/dashboard/locales/en.json'),
    dashboardStaking: () => import('@/features/dashboard/staking/locales/en.json'),
    dashboardExplorador: () => import('@/features/dashboard/explorador/locales/en.json'),
    docs: () => import('@/features/docs/locales/en.json'),
    forum: () => import('@/features/forum/locales/en.json'),
    games: () => import('@/features/games/locales/en.json'),
    home: () => import('@/features/home/locales/en.json'),
    infrastructure: () => import('@/features/infrastructure/locales/en.json'),
  },
  es: {
    academy: () => import('@/features/academy/locales/es.json'),
    blog: () => import('@/features/blog/locales/es.json'),
    community: () => import('@/features/community/locales/es.json'),
    dapps: () => import('@/features/dapps/locales/es.json'),
    dashboard: () => import('@/features/dashboard/locales/es.json'),
    dashboardStaking: () => import('@/features/dashboard/staking/locales/es.json'),
    dashboardExplorador: () => import('@/features/dashboard/explorador/locales/es.json'),
    docs: () => import('@/features/docs/locales/es.json'),
    forum: () => import('@/features/forum/locales/es.json'),
    games: () => import('@/features/games/locales/es.json'),
    home: () => import('@/features/home/locales/es.json'),
    infrastructure: () => import('@/features/infrastructure/locales/es.json'),
  }
};

export async function loadFeatureDictionaries(
  locale: 'en' | 'es',
  features: FeatureKey[],
): Promise<Dictionary> {
  const common = locale === 'es' ? commonEs : commonEn;
  if (features.length === 0) return common as unknown as Dictionary;
  
  const modules = await Promise.all(
    features.map(f => featureLoaders[locale][f]())
  );
  return mergeTranslations(common, modules.map(m => m.default)) as unknown as Dictionary;
}