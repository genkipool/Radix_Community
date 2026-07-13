/**
 * Internal destinations referenced across the Radix Seal page.
 * All are locale-relative paths — prefix with `/${locale}` when linking.
 */
export const SEAL_LINKS = {
  console: '/console',
  sign: '/console/sign-document',
  encrypt: '/console/encrypt-document',
  chat: '/console/chat',
} as const;

/** Anchor id used by the hero CTA to scroll to the comparison section. */
export const COMPARISON_ID = 'comparison';
